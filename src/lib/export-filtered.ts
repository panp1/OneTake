import archiver from 'archiver';
import { Writable } from 'stream';
import { getIntakeRequest } from '@/lib/db/intake';
import { getBriefByRequestId } from '@/lib/db/briefs';
import { getAssetsByRequestId } from '@/lib/db/assets';

type FilteredExportType = 'characters' | 'cutouts' | 'raw' | 'composed' | 'brand_kit';

/**
 * Generates a filtered ZIP archive containing a subset of assets for an intake request.
 *
 * Types:
 *   characters — only base_image assets
 *   cutouts    — only base_image assets (same as characters; actual rembg processing is external)
 *   raw        — only base_image assets without overlay data
 *   composed   — only composed_creative assets
 *   brand_kit  — OneForma brand specs, color palette, font info
 */
export async function generateFilteredExportZip(
  requestId: string,
  type: FilteredExportType
): Promise<Buffer> {
  const request = await getIntakeRequest(requestId);
  if (!request) {
    throw new Error(`Intake request not found: ${requestId}`);
  }

  const brief = await getBriefByRequestId(requestId);
  const allAssets = await getAssetsByRequestId(requestId);

  const chunks: Buffer[] = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(writable);

  const folderName = `oneforma-${type}-${request.title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')}`;

  if (type === 'brand_kit') {
    // Export brand specs as JSON
    const brandKit = {
      brand: 'OneForma',
      parent_company: 'Centific',
      colors: {
        charcoal: '#32373c',
        gradient_start: 'rgb(6, 147, 227)',
        gradient_end: 'rgb(155, 81, 224)',
        white: '#ffffff',
        error: '#bf1722',
      },
      fonts: {
        primary: '-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        heading_weight: 600,
        body_weight: 400,
      },
      radii: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        pill: '9999px',
      },
      design_direction: brief?.design_direction ?? null,
      brief_summary: brief?.brief_data ?? null,
    };

    archive.append(JSON.stringify(brandKit, null, 2), {
      name: `${folderName}/brand-kit.json`,
    });

    archive.append(
      [
        'OneForma Brand Kit',
        '==================',
        '',
        'Primary Color: #32373c (Charcoal)',
        'Gradient: rgb(6,147,227) -> rgb(155,81,224)',
        'Font: System font stack (-apple-system, system-ui, ...)',
        'Heading Weight: 600 (Semibold)',
        'Body Weight: 400 (Regular)',
        '',
        'Border Radii: 8/12/16/9999px',
        '',
        'See brand-kit.json for full specs including design direction.',
      ].join('\n'),
      { name: `${folderName}/README.txt` }
    );
  } else {
    // Filter assets by type
    let filtered = allAssets;

    switch (type) {
      case 'characters':
      case 'cutouts':
      case 'raw':
        filtered = allAssets.filter((a) => a.asset_type === 'base_image');
        break;
      case 'composed':
        filtered = allAssets.filter((a) => a.asset_type === 'composed_creative');
        break;
    }

    // Download and add each asset
    for (const asset of filtered) {
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
          const urlPath = new URL(asset.blob_url).pathname;
          const ext = urlPath.split('.').pop() ?? 'png';
          const safeName = `${asset.asset_type}-${asset.id.slice(0, 8)}.${ext}`;
          const path = `${folderName}/${asset.platform}/${safeName}`;
          archive.append(buffer, { name: path });
        } catch (e) {
          console.error(`Failed to download asset ${asset.id}:`, e);
        }
      }
    }

    // Add a manifest
    const manifest = filtered.map((a) => ({
      id: a.id,
      platform: a.platform,
      format: a.format,
      asset_type: a.asset_type,
      score: a.evaluation_score,
      language: a.language,
    }));
    archive.append(JSON.stringify(manifest, null, 2), {
      name: `${folderName}/manifest.json`,
    });
  }

  await archive.finalize();
  await new Promise<void>((resolve) => writable.on('finish', resolve));

  return Buffer.concat(chunks);
}
