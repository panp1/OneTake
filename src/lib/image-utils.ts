import sharp from "sharp";
import { put } from "@vercel/blob";

/**
 * Download an image from a URL, convert to AVIF, upload to Vercel Blob.
 * Returns the new Blob URL.
 *
 * AVIF achieves 50-70% smaller file sizes than PNG/JPEG
 * while maintaining visual quality at q=65.
 */
export async function convertAndUploadAvif(
  imageUrl: string,
  filename: string,
  options: {
    quality?: number;
    folder?: string;
  } = {}
): Promise<string> {
  const { quality = 65, folder } = options;

  // Download the image
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // Convert to AVIF
  let avifBuffer: Buffer;
  try {
    avifBuffer = await sharp(buffer)
      .avif({ quality, effort: 4 })
      .toBuffer();
  } catch {
    // If AVIF conversion fails (unsupported format), return original URL
    console.warn("AVIF conversion failed, using original image");
    return imageUrl;
  }

  // Only use AVIF if it's actually smaller
  if (avifBuffer.length >= buffer.length) {
    // AVIF is larger — upload the original as PNG
    const path = folder ? `${folder}/${filename}.png` : `${filename}.png`;
    const blob = await put(path, buffer, {
      access: "public",
      contentType: "image/png",
    });
    return blob.url;
  }

  // Upload AVIF to Vercel Blob
  const path = folder ? `${folder}/${filename}.avif` : `${filename}.avif`;
  const blob = await put(path, avifBuffer, {
    access: "public",
    contentType: "image/avif",
  });

  return blob.url;
}
