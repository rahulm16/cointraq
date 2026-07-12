import { ICON_MAX_BYTES } from "./constants";

/**
 * Client-side icon pipeline (SPEC §9): load file → center-crop square →
 * resize to 128×128 → encode WebP q~0.8 (PNG fallback) → base64 data URL.
 * Rejects if the encoded string exceeds 80 KB. Browser-only (uses canvas/Image).
 */
export async function processIconFile(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    throw new Error("Use a PNG, JPG, or WebP image.");
  }

  const bitmap = await loadImage(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 128, 128);

  let dataUrl = canvas.toDataURL("image/webp", 0.8);
  if (!dataUrl.startsWith("data:image/webp")) {
    // Browser doesn't support WebP encode — fall back to PNG.
    dataUrl = canvas.toDataURL("image/png");
  }

  if (dataUrl.length > ICON_MAX_BYTES) {
    throw new Error("Icon is too large after compression. Try a simpler image.");
  }
  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
