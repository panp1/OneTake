// ============================================================
// VYRA Creative API Client
// Communicates with the local VYRA Creative API (FastAPI on Mac)
// ============================================================

const VYRA_API_URL = process.env.VYRA_API_URL || 'http://localhost:8000';

export class VyraApiError extends Error {
  constructor(
    message: string,
    public statusCode: number | null,
    public path: string,
  ) {
    super(message);
    this.name = 'VyraApiError';
  }
}

async function vyraFetch<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${VYRA_API_URL}${path}`;

  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new VyraApiError(
      `VYRA API error ${response.status}: ${errorText}`,
      response.status,
      path,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export async function vyraHealthCheck(): Promise<boolean> {
  try {
    await vyraFetch('/health');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Stage 1a: Brief Generation (Qwen3.5-9B)
// ---------------------------------------------------------------------------

export async function generateBrief(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/brief', data);
}

// ---------------------------------------------------------------------------
// Stage 1 Gate: Brief Evaluation
// ---------------------------------------------------------------------------

export async function evaluateBrief(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/evaluate-brief', data);
}

// ---------------------------------------------------------------------------
// Stage 1c: Design Direction
// ---------------------------------------------------------------------------

export async function generateDesignDirection(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/design-direction', data);
}

// ---------------------------------------------------------------------------
// Stage 2a: Actor Identity Card Generation
// ---------------------------------------------------------------------------

export async function generateActors(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/actors', data);
}

// ---------------------------------------------------------------------------
// Stage 2b: Image Generation (Seedream 4.5)
// ---------------------------------------------------------------------------

export async function generateImages(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/generate', data);
}

// ---------------------------------------------------------------------------
// Stage 2c: Visual QA (Qwen3-VL)
// ---------------------------------------------------------------------------

export async function validateImage(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/validate-image', data);
}

// ---------------------------------------------------------------------------
// Stage 3: Copy Generation (Gemma 3 12B)
// ---------------------------------------------------------------------------

export async function generateCopy(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/copy', data);
}

// ---------------------------------------------------------------------------
// Stage 3 Gate: Copy Evaluation
// ---------------------------------------------------------------------------

export async function evaluateCopy(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/evaluate-copy', data);
}

// ---------------------------------------------------------------------------
// Stage 4: Creative Composition (compositor + Playwright)
// ---------------------------------------------------------------------------

export async function composeCreatives(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/compose', data);
}

// ---------------------------------------------------------------------------
// Stage 4: Carousel Generation
// ---------------------------------------------------------------------------

export async function generateCarousel(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/carousel', data);
}

// ---------------------------------------------------------------------------
// Stage 4 Gate: Creative Evaluation (7 dimensions)
// ---------------------------------------------------------------------------

export async function evaluateCreative(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return vyraFetch('/creative/evaluate', data);
}
