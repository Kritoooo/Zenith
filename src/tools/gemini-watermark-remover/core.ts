import { BG_48_MASK_DATA_URL, BG_96_MASK_DATA_URL } from "./mask-data";

export type WatermarkMode = "auto" | "small" | "large";
export type WatermarkKey = Exclude<WatermarkMode, "auto">;

export type WatermarkSpec = {
  key: WatermarkKey;
  size: 48 | 96;
  margin: 32 | 64;
};

export type ClippedWatermarkRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  alphaOffsetX: number;
  alphaOffsetY: number;
};

export type RemovalResult = {
  blob: Blob;
  width: number;
  height: number;
  spec: WatermarkSpec;
  region: ClippedWatermarkRegion | null;
};

type AlphaMask = {
  size: 48 | 96;
  values: Float32Array;
};

const SMALL_SPEC: WatermarkSpec = {
  key: "small",
  size: 48,
  margin: 32,
};

const LARGE_SPEC: WatermarkSpec = {
  key: "large",
  size: 96,
  margin: 64,
};

const ALPHA_THRESHOLD = 0.002;
const MAX_ALPHA = 0.99;

const alphaMaskCache: Partial<Record<WatermarkKey, Promise<AlphaMask>>> = {};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("OUTPUT_BLOB_FAILED"));
        return;
      }
      resolve(blob);
    }, type);
  });
}

function decodeAlphaMask(dataUrl: string, expectedSize: 48 | 96) {
  return new Promise<AlphaMask>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = expectedSize;
      canvas.height = expectedSize;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("NO_CANVAS"));
        return;
      }

      context.clearRect(0, 0, expectedSize, expectedSize);
      context.drawImage(image, 0, 0, expectedSize, expectedSize);

      const { data } = context.getImageData(0, 0, expectedSize, expectedSize);
      const values = new Float32Array(expectedSize * expectedSize);

      for (let index = 0; index < values.length; index += 1) {
        const offset = index * 4;
        values[index] =
          Math.max(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0) / 255;
      }

      resolve({
        size: expectedSize,
        values,
      });
    };
    image.onerror = () => reject(new Error("MASK_LOAD_FAILED"));
    image.decoding = "async";
    image.src = dataUrl;
  });
}

function getAlphaMask(key: WatermarkKey) {
  if (!alphaMaskCache[key]) {
    alphaMaskCache[key] = decodeAlphaMask(
      key === "small" ? BG_48_MASK_DATA_URL : BG_96_MASK_DATA_URL,
      key === "small" ? 48 : 96
    );
  }

  return alphaMaskCache[key] as Promise<AlphaMask>;
}

export function resolveWatermarkSpec(
  width: number,
  height: number,
  mode: WatermarkMode = "auto"
): WatermarkSpec {
  if (mode === "small") return SMALL_SPEC;
  if (mode === "large") return LARGE_SPEC;
  return width > 1024 && height > 1024 ? LARGE_SPEC : SMALL_SPEC;
}

export function getWatermarkRegion(
  width: number,
  height: number,
  spec: WatermarkSpec
): ClippedWatermarkRegion | null {
  const originX = width - spec.margin - spec.size;
  const originY = height - spec.margin - spec.size;

  const x1 = Math.max(0, originX);
  const y1 = Math.max(0, originY);
  const x2 = Math.min(width, originX + spec.size);
  const y2 = Math.min(height, originY + spec.size);

  if (x1 >= x2 || y1 >= y2) {
    return null;
  }

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    alphaOffsetX: x1 - originX,
    alphaOffsetY: y1 - originY,
  };
}

function applyReverseAlphaBlend(
  pixels: Uint8ClampedArray,
  regionWidth: number,
  regionHeight: number,
  mask: AlphaMask,
  region: ClippedWatermarkRegion
) {
  for (let row = 0; row < regionHeight; row += 1) {
    for (let col = 0; col < regionWidth; col += 1) {
      const alphaIndex =
        (region.alphaOffsetY + row) * mask.size + (region.alphaOffsetX + col);
      let alpha = mask.values[alphaIndex] ?? 0;

      if (alpha < ALPHA_THRESHOLD) {
        continue;
      }

      alpha = Math.min(alpha, MAX_ALPHA);
      const inverseAlpha = 1 - alpha;
      const pixelIndex = (row * regionWidth + col) * 4;

      pixels[pixelIndex] = clamp((pixels[pixelIndex] - alpha * 255) / inverseAlpha, 0, 255);
      pixels[pixelIndex + 1] = clamp(
        (pixels[pixelIndex + 1] - alpha * 255) / inverseAlpha,
        0,
        255
      );
      pixels[pixelIndex + 2] = clamp(
        (pixels[pixelIndex + 2] - alpha * 255) / inverseAlpha,
        0,
        255
      );
    }
  }
}

export async function preloadWatermarkMasks() {
  await Promise.all([getAlphaMask("small"), getAlphaMask("large")]);
}

export async function removeGeminiVisibleWatermark(
  image: CanvasImageSource,
  width: number,
  height: number,
  mode: WatermarkMode = "auto"
): Promise<RemovalResult> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("NO_CANVAS");
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const spec = resolveWatermarkSpec(width, height, mode);
  const region = getWatermarkRegion(width, height, spec);

  if (region) {
    const alphaMask = await getAlphaMask(spec.key);
    const imageData = context.getImageData(region.x, region.y, region.width, region.height);
    applyReverseAlphaBlend(imageData.data, region.width, region.height, alphaMask, region);
    context.putImageData(imageData, region.x, region.y);
  }

  const blob = await canvasToBlob(canvas, "image/png");

  return {
    blob,
    width,
    height,
    spec,
    region,
  };
}
