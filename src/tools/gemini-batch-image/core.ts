import { ApiError, GoogleGenAI } from "@google/genai";

export const SUPPORTED_INPUT_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SupportedInputMime = (typeof SUPPORTED_INPUT_MIMES)[number];

export const DEFAULT_MODEL = "gemini-2.5-flash-image";
export const AVAILABLE_MODELS = ["gemini-2.5-flash-image"] as const;

export const GEMINI_ERROR_CODES = [
  "MISSING_API_KEY",
  "MISSING_PROMPT",
  "UNSUPPORTED_MIME",
  "NO_INLINE_DATA",
  "ABORTED",
  "RATE_LIMITED",
  "AUTH_FAILED",
  "NETWORK",
  "UNKNOWN",
] as const;
export type GeminiErrorCode = (typeof GEMINI_ERROR_CODES)[number];

export type EditImageRequest = {
  apiKey: string;
  model: string;
  prompt: string;
  image: File | Blob;
  inputMimeType: string;
  baseUrl?: string;
  signal?: AbortSignal;
};

export function normalizeBaseUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}

export type EditImageResult = {
  blob: Blob;
  mimeType: string;
};

const MAX_FILENAME_SEGMENT = 120;

export function isSupportedInputMime(mime: string): mime is SupportedInputMime {
  return (SUPPORTED_INPUT_MIMES as readonly string[]).includes(mime);
}

export function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("NETWORK"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("NETWORK"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "image/png" });
}

function sanitizeFilenameSegment(value: string) {
  const cleaned = value
    .replace(/[\\/]+/g, "_")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return "image";
  return cleaned.length > MAX_FILENAME_SEGMENT
    ? cleaned.slice(0, MAX_FILENAME_SEGMENT)
    : cleaned;
}

export function buildOutputFilename(
  source: { displayName: string; relativePath?: string },
  suffix: string
): string {
  const rawSource = source.relativePath && source.relativePath.trim()
    ? source.relativePath
    : source.displayName;
  const withoutExt = rawSource.replace(/\.[^./\\]+$/, "");
  const base = sanitizeFilenameSegment(withoutExt || source.displayName || "image");
  const sanitizedSuffix = suffix
    .trim()
    .replace(/[\\/]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/[^\w.\-]/g, "");
  const resolvedSuffix = sanitizedSuffix || "-gemini";
  const normalizedSuffix = resolvedSuffix.startsWith("-") || resolvedSuffix.startsWith("_")
    ? resolvedSuffix
    : `-${resolvedSuffix}`;
  return `${base}${normalizedSuffix}.png`;
}

function normalizeErrorCode(err: unknown): GeminiErrorCode {
  if (err instanceof DOMException && err.name === "AbortError") return "ABORTED";
  if (err instanceof Error && err.name === "AbortError") return "ABORTED";

  if (err instanceof ApiError) {
    if (err.status === 429) return "RATE_LIMITED";
    if (err.status === 401 || err.status === 403) return "AUTH_FAILED";
    if (err.status === 400) return "UNKNOWN";
    if (err.status >= 500) return "NETWORK";
    return "UNKNOWN";
  }

  if (err instanceof Error) {
    if ((GEMINI_ERROR_CODES as readonly string[]).includes(err.message)) {
      return err.message as GeminiErrorCode;
    }
    const message = err.message.toLowerCase();
    if (message.includes("aborted") || message.includes("cancel")) return "ABORTED";
    if (message.includes("api key") || message.includes("unauthenticated")) return "AUTH_FAILED";
    if (message.includes("quota") || message.includes("rate")) return "RATE_LIMITED";
    if (message.includes("network") || message.includes("fetch")) return "NETWORK";
  }

  return "UNKNOWN";
}

type InlineDataPart = {
  inlineData?: { data?: string; mimeType?: string };
};

function extractFirstInlineData(parts: InlineDataPart[] | undefined) {
  if (!parts) return null;
  for (const part of parts) {
    const data = part.inlineData?.data;
    if (data) {
      return {
        data,
        mimeType: part.inlineData?.mimeType ?? "image/png",
      };
    }
  }
  return null;
}

export async function editImageWithGemini(
  request: EditImageRequest
): Promise<EditImageResult> {
  if (!request.apiKey.trim()) {
    throw new Error("MISSING_API_KEY");
  }
  if (!request.prompt.trim()) {
    throw new Error("MISSING_PROMPT");
  }
  if (!isSupportedInputMime(request.inputMimeType)) {
    throw new Error("UNSUPPORTED_MIME");
  }
  if (request.signal?.aborted) {
    throw new Error("ABORTED");
  }

  let base64: string;
  try {
    base64 = await readBlobAsBase64(request.image);
  } catch (err) {
    const code = normalizeErrorCode(err);
    throw new Error(code);
  }

  if (request.signal?.aborted) {
    throw new Error("ABORTED");
  }

  const baseUrl = normalizeBaseUrl(request.baseUrl);
  const ai = new GoogleGenAI({
    apiKey: request.apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });

  try {
    const response = await ai.models.generateContent({
      model: request.model || DEFAULT_MODEL,
      contents: [
        { inlineData: { mimeType: request.inputMimeType, data: base64 } },
        { text: request.prompt },
      ],
      config: request.signal ? { abortSignal: request.signal } : undefined,
    });

    const parts = response.candidates?.[0]?.content?.parts as InlineDataPart[] | undefined;
    const inline = extractFirstInlineData(parts);
    if (!inline) {
      throw new Error("NO_INLINE_DATA");
    }

    const blob = base64ToBlob(inline.data, inline.mimeType);
    return { blob, mimeType: inline.mimeType };
  } catch (err) {
    const code = normalizeErrorCode(err);
    throw new Error(code);
  }
}
