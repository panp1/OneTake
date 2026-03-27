import archiver from 'archiver';
import { Writable } from 'stream';
import { getIntakeRequest } from '@/lib/db/intake';
import { getBriefByRequestId } from '@/lib/db/briefs';
import { getAssetsByRequestId } from '@/lib/db/assets';

/**
 * Generates a ZIP archive containing all approved creatives for an intake request.
 *
 * Package structure:
 *   oneforma-package-{title}/
 *   ├── creatives/{platform}/{format}/{asset_type}-{id}.{ext}
 *   ├── brief.json
 *   ├── copy.csv
 *   ├── targeting.json
 *   ├── evaluation-report.json
 *   └── README.txt
 */
export async function generateExportZip(requestId: string): Promise<Buffer> {
  const request = await getIntakeRequest(requestId);
  if (!request) {
    throw new Error(`Intake request not found: ${requestId}`);
  }

  const brief = await getBriefByRequestId(requestId);
  const assets = await getAssetsByRequestId(requestId);

  // Build the ZIP into memory
  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(writable);

  const folderName = `oneforma-package-${request.title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`;

  // ── brief.json ────────────────────────────────────────────
  archive.append(JSON.stringify(brief?.brief_data ?? {}, null, 2), {
    name: `${folderName}/brief.json`,
  });

  // ── targeting.json (channel research from the brief) ──────
  archive.append(JSON.stringify(brief?.channel_research ?? {}, null, 2), {
    name: `${folderName}/targeting.json`,
  });

  // ── evaluation-report.json ────────────────────────────────
  const evalReport = assets.map((a) => ({
    id: a.id,
    platform: a.platform,
    format: a.format,
    score: a.evaluation_score,
    passed: a.evaluation_passed,
    dimensions: a.evaluation_data,
  }));
  archive.append(JSON.stringify(evalReport, null, 2), {
    name: `${folderName}/evaluation-report.json`,
  });

  // ── copy.csv ──────────────────────────────────────────────
  const csvHeader =
    'channel,format,language,headline,description,primary_text,cta_text\n';
  const csvRows = assets
    .filter((a) => a.copy_data)
    .map((a) => {
      const copy = a.copy_data as Record<string, string>;
      return [
        a.platform,
        a.format,
        a.language,
        copy.headline ?? '',
        copy.description ?? '',
        copy.primary_text ?? '',
        copy.cta_text ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    })
    .join('\n');
  archive.append(csvHeader + csvRows, { name: `${folderName}/copy.csv` });

  // ── README.txt ────────────────────────────────────────────
  const channels = [...new Set(assets.map((a) => a.platform))];
  const readme = [
    'OneForma Creative Package',
    '========================',
    `Project: ${request.title}`,
    `Generated: ${new Date().toISOString()}`,
    `Creatives: ${assets.length} variants`,
    `Channels: ${channels.join(', ')}`,
    '',
    'Contents:',
    '  brief.json             — Creative brief from Stage 1',
    '  targeting.json         — Audience definition, channel recommendations',
    '  evaluation-report.json — Scores per creative, dimension breakdown',
    '  copy.csv               — Headlines, descriptions, CTAs per channel/language',
    '  creatives/             — Generated creative images by channel and format',
    '',
  ].join('\n');
  archive.append(readme, { name: `${folderName}/README.txt` });

  // ── Creative images ───────────────────────────────────────
  for (const asset of assets) {
    if (asset.blob_url) {
      try {
        const response = await fetch(asset.blob_url);
        if (!response.ok) {
          console.error(
            `Failed to download asset ${asset.id}: HTTP ${response.status}`
          );
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        // Extract extension from URL, falling back to png
        const urlPath = new URL(asset.blob_url).pathname;
        const ext = urlPath.split('.').pop() ?? 'png';
        const safeName = `${asset.asset_type}-${asset.id.slice(0, 8)}.${ext}`;
        const path = `${folderName}/creatives/${asset.platform}/${asset.format}/${safeName}`;
        archive.append(buffer, { name: path });
      } catch (e) {
        console.error(`Failed to download asset ${asset.id}:`, e);
      }
    }
  }

  await archive.finalize();

  // Wait for the writable stream to finish collecting chunks
  await new Promise<void>((resolve) => writable.on('finish', resolve));

  return Buffer.concat(chunks);
}
