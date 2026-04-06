import { auth } from '@clerk/nextjs/server';
import { uploadToBlob } from '@/lib/blob';
import { callKimiK25 } from '@/lib/openrouter';
import { buildExtractionSystemPrompt } from '@/lib/extraction-prompt';
import type { ExtractionResult } from '@/lib/types';

// Use Gemma 4 vision (NIM, free) to OCR PDF pages as images
async function ocrWithGemma4(imageBase64: string, systemPrompt: string): Promise<string> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) throw new Error('No NIM key for Gemma 4 vision OCR');

  const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nimKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemma-4-31b-it',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 8192,
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemma 4 OCR failed: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Convert PDF buffer to PNG images using canvas-free approach
// We send the raw PDF bytes as a data URL to Gemma 4 — it can read PDFs directly
async function extractFromPdfViaVision(buffer: Buffer, systemPrompt: string): Promise<string> {
  const base64 = buffer.toString('base64');

  // Gemma 4 can accept PDFs as images — send the first page
  // If that fails, we'll convert to a simpler format
  const ocrPrompt = `${systemPrompt}

IMPORTANT: This is a PDF document rendered as an image. Please:
1. Read ALL text from the document carefully
2. Extract every field you can identify
3. Return the structured JSON extraction

Read the entire document and extract ALL information.`;

  return ocrWithGemma4(base64, ocrPrompt);
}

async function extractTextFromFile(file: File, systemPrompt: string): Promise<{ text: string; usedVision: boolean }> {
  const fileType = file.type.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // PDF — use Gemma 4 vision for OCR extraction
  if (fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      console.log(`[extract/rfp] PDF detected: ${file.name} (${buffer.length} bytes) — using Gemma 4 vision`);
      const result = await extractFromPdfViaVision(buffer, systemPrompt);
      if (result && result.length > 50) {
        return { text: result, usedVision: true };
      }
    } catch (e) {
      console.error('[extract/rfp] Gemma 4 vision extraction failed:', e);
    }

    // Fallback: try raw text extraction
    const rawText = buffer.toString('latin1');
    const readable = rawText.match(/[\x20-\x7E]{20,}/g) || [];
    const filtered = readable.filter(r => !/^[A-Za-z0-9+/=]+$/.test(r));
    if (filtered.length > 5) {
      return { text: filtered.join('\n'), usedVision: false };
    }

    return { text: `[PDF: ${file.name} — could not extract text. Please use the paste option.]`, usedVision: false };
  }

  // Images — send directly to Gemma 4 vision
  if (fileType.startsWith('image/')) {
    try {
      const base64 = buffer.toString('base64');
      const result = await ocrWithGemma4(base64, systemPrompt);
      if (result && result.length > 20) {
        return { text: result, usedVision: true };
      }
    } catch (e) {
      console.error('[extract/rfp] Image OCR failed:', e);
    }
    return { text: `[Image: ${file.name} — OCR failed. Please use the paste option.]`, usedVision: false };
  }

  // DOCX — basic text extraction
  if (file.name.endsWith('.docx')) {
    const text = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 100) {
      return { text, usedVision: false };
    }
  }

  // Plain text, CSV, etc
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const text = textDecoder.decode(arrayBuffer);
  const printableRatio = text.replace(/[^\x20-\x7E\n\r\t]/g, '').length / Math.max(text.length, 1);

  if (printableRatio > 0.5) {
    return { text, usedVision: false };
  }

  return { text: `[File: ${file.name} (${fileType}) — could not extract text.]`, usedVision: false };
}

async function callLLMForExtraction(systemPrompt: string, userPrompt: string): Promise<string> {
  // Try NIM K2.5 first (free), fallback to OpenRouter
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (nimKey) {
    try {
      const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nimKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'moonshotai/kimi-k2.5',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        if (content.length > 10) {
          console.log('[extract/rfp] Used NIM K2.5 for extraction');
          return content;
        }
      }
    } catch (e) {
      console.warn('[extract/rfp] NIM K2.5 failed, falling back to OpenRouter:', e);
    }
  }

  return callKimiK25(systemPrompt, userPrompt);
}

function parseJsonFromResponse(raw: string): ExtractionResult {
  // Strip markdown fences
  let cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned) as ExtractionResult;
  } catch {}

  // Brace-depth search
  let depth = 0, start = -1, last = '';
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = cleaned.slice(start, i + 1);
        try { JSON.parse(candidate); last = candidate; } catch {}
        start = -1;
      }
    }
  }
  if (last) return JSON.parse(last) as ExtractionResult;

  throw new Error('No valid JSON found');
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ error: 'No file provided.' }, { status: 400 });
    }

    // Upload to Blob
    const blobUrl = await uploadToBlob(file, 'rfp-uploads');

    // Build extraction prompt
    const systemPrompt = await buildExtractionSystemPrompt();

    // Extract content (Gemma 4 vision for PDFs/images, text parsing for others)
    const { text: extractedContent, usedVision } = await extractTextFromFile(file, systemPrompt);
    console.log(`[extract/rfp] Extracted ${extractedContent.length} chars from ${file.name} (vision=${usedVision})`);

    let extraction: ExtractionResult;

    if (usedVision) {
      // Gemma 4 already returned structured data — try to parse directly
      try {
        extraction = parseJsonFromResponse(extractedContent);
      } catch {
        // Gemma returned text, not JSON — send to K2.5 to structure it
        const rawResponse = await callLLMForExtraction(
          systemPrompt,
          `Extract structured data from this document content:\n\n${extractedContent}`
        );
        extraction = parseJsonFromResponse(rawResponse);
      }
    } else {
      // Text extraction — send to K2.5
      const rawResponse = await callLLMForExtraction(
        systemPrompt,
        `Please analyze the following RFP/project document and extract structured data:\n\n${extractedContent}`
      );
      extraction = parseJsonFromResponse(rawResponse);
    }

    return Response.json({
      extraction,
      blob_url: blobUrl,
      file_name: file.name,
      file_type: file.type,
    });
  } catch (error) {
    console.error('[api/extract/rfp] Extraction failed:', error);
    return Response.json(
      { error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
