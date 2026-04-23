/**
 * Blob storage abstraction — supports Vercel Blob and Azure Blob Storage.
 *
 * Set BLOB_PROVIDER=azure to use Azure Blob Storage.
 * Default: vercel (current behavior, no changes needed).
 *
 * Azure requires:
 *   AZURE_STORAGE_CONNECTION_STRING — connection string from Azure portal
 *   AZURE_STORAGE_CONTAINER — container name (default: "assets")
 */

const BLOB_PROVIDER = process.env.BLOB_PROVIDER || 'vercel';

// ── Vercel Blob implementation ──────────────────────────────

async function uploadToVercelBlob(path: string, body: File | Buffer, options: { access: string; addRandomSuffix: boolean }): Promise<string> {
  const { put } = await import('@vercel/blob');
  const blob = await put(path, body, options as any);
  return blob.url;
}

// ── Azure Blob implementation ───────────────────────────────

async function uploadToAzureBlob(path: string, body: File | Buffer): Promise<string> {
  const { BlobServiceClient } = await import('@azure/storage-blob');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required when BLOB_PROVIDER=azure');
  }

  const containerName = process.env.AZURE_STORAGE_CONTAINER || 'assets';
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Add random suffix to prevent collisions (matching Vercel behavior)
  const suffix = Math.random().toString(36).substring(2, 8);
  const parts = path.split('.');
  const ext = parts.length > 1 ? `.${parts.pop()}` : '';
  const blobName = `${parts.join('.')}-${suffix}${ext}`;

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Convert File to Buffer if needed
  let buffer: Buffer;
  if (body instanceof Buffer) {
    buffer = body;
  } else {
    const arrayBuffer = await (body as File).arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  }

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: guessContentType(blobName),
    },
  });

  return blockBlobClient.url;
}

function guessContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    pdf: 'application/pdf',
    html: 'text/html',
    json: 'application/json',
  };
  return types[ext || ''] || 'application/octet-stream';
}

// ── Public API (unchanged interface) ────────────────────────

export async function uploadToBlob(file: File, folder: string): Promise<string> {
  const path = `${folder}/${file.name}`;
  if (BLOB_PROVIDER === 'azure') {
    return uploadToAzureBlob(path, file);
  }
  return uploadToVercelBlob(path, file, { access: 'public', addRandomSuffix: true });
}

export async function uploadBufferToBlob(buffer: Buffer, filename: string, folder: string): Promise<string> {
  const path = `${folder}/${filename}`;
  if (BLOB_PROVIDER === 'azure') {
    return uploadToAzureBlob(path, buffer);
  }
  return uploadToVercelBlob(path, buffer, { access: 'public', addRandomSuffix: true });
}
