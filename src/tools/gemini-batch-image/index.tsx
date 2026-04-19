"use client";

import type { ChangeEvent, DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import NextImage from "next/image";

import {
  DangerButton,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/Button";
import { UploadIcon } from "@/components/Icons";
import { Select } from "@/components/Select";
import { ToolInput } from "@/components/ToolInput";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";
import { cn } from "@/lib/cn";
import { createId } from "@/lib/createId";
import { formatBytes } from "@/lib/formatBytes";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  GEMINI_ERROR_CODES,
  SUPPORTED_INPUT_MIMES,
  buildOutputFilename,
  editImageWithGemini,
  isSupportedInputMime,
  type GeminiErrorCode,
} from "@/tools/gemini-batch-image/core";

type FileItemStatus =
  | "pending"
  | "processing"
  | "done"
  | "error"
  | "cancelled"
  | "skipped";

type FileItem = {
  id: string;
  file: File;
  displayName: string;
  relativePath?: string;
  inputMimeType: string;
  inputSize: number;
  inputUrl: string;
  status: FileItemStatus;
  resultBlob?: Blob;
  resultUrl?: string;
  resultMimeType?: string;
  resultSize?: number;
  outputFilename: string;
  errorCode?: GeminiErrorCode;
  abortController?: AbortController;
};

type ZipWorkerProgressMessage = {
  type: "progress";
  id: number;
  completed: number;
  total: number;
};
type ZipWorkerResultMessage = {
  type: "result";
  id: number;
  buffer: ArrayBuffer;
};
type ZipWorkerErrorMessage = {
  type: "error";
  id: number;
  message: string;
};
type ZipWorkerMessage =
  | ZipWorkerProgressMessage
  | ZipWorkerResultMessage
  | ZipWorkerErrorMessage;

const API_KEY_STORAGE = "zenith.gemini-batch-image.apiKey";
const API_KEY_REMEMBER_STORAGE = "zenith.gemini-batch-image.rememberKey";
const BASE_URL_STORAGE = "zenith.gemini-batch-image.baseUrl";
const PROMPT_STORAGE = "zenith.gemini-batch-image.prompt";
const SUFFIX_STORAGE = "zenith.gemini-batch-image.suffix";
const MODEL_STORAGE = "zenith.gemini-batch-image.model";
const CONCURRENCY_STORAGE = "zenith.gemini-batch-image.concurrency";

const DEFAULT_SUFFIX = "-gemini";
const DEFAULT_CONCURRENCY = 2;
const CONCURRENCY_OPTIONS = [1, 2, 3, 4] as const;
const ZIP_WARN_BYTES = 150 * 1024 * 1024;

const ACCEPT_ATTR = SUPPORTED_INPUT_MIMES.join(",");

const isGeminiErrorCode = (value: unknown): value is GeminiErrorCode =>
  typeof value === "string" && (GEMINI_ERROR_CODES as readonly string[]).includes(value);

const padTwo = (n: number) => n.toString().padStart(2, "0");
const zipStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}${padTwo(d.getMonth() + 1)}${padTwo(d.getDate())}${padTwo(d.getHours())}${padTwo(d.getMinutes())}`;
};

const readFileFromEntry = (entry: FileSystemFileEntry) =>
  new Promise<File | null>((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });

const readAllEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve) => {
    const collected: FileSystemEntry[] = [];
    const step = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(collected);
            return;
          }
          collected.push(...batch);
          step();
        },
        () => resolve(collected)
      );
    };
    step();
  });

async function walkEntry(entry: FileSystemEntry, collected: File[], parentPath: string) {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await readFileFromEntry(fileEntry);
    if (!file) return;
    const withPath = file as File & { webkitRelativePath?: string };
    if (!withPath.webkitRelativePath) {
      try {
        Object.defineProperty(file, "webkitRelativePath", {
          value: parentPath ? `${parentPath}/${file.name}` : file.name,
          configurable: true,
        });
      } catch {
        /* ignore — browsers that freeze File */
      }
    }
    collected.push(file);
    return;
  }
  if (entry.isDirectory) {
    const dir = entry as FileSystemDirectoryEntry;
    const reader = dir.createReader();
    const children = await readAllEntries(reader);
    const nextPath = parentPath ? `${parentPath}/${dir.name}` : dir.name;
    for (const child of children) {
      await walkEntry(child, collected, nextPath);
    }
  }
}

async function collectFilesFromDataTransfer(list: DataTransferItemList): Promise<File[]> {
  const collected: File[] = [];
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item) continue;
    const maybeEntry =
      typeof (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null })
        .webkitGetAsEntry === "function"
        ? (item as DataTransferItem & { webkitGetAsEntry: () => FileSystemEntry | null }).webkitGetAsEntry()
        : null;
    if (maybeEntry) entries.push(maybeEntry);
  }
  if (entries.length > 0) {
    for (const entry of entries) {
      await walkEntry(entry, collected, "");
    }
  }
  return collected;
}

function fileDedupKey(file: File) {
  const withPath = file as File & { webkitRelativePath?: string };
  return `${withPath.webkitRelativePath || file.name}|${file.size}|${file.lastModified}`;
}

type PreviewThumbProps = {
  src: string | null;
  alt: string;
  emptyLabel: string;
  zoomLabel?: string;
  onZoom?: () => void;
};

function PreviewThumb({ src, alt, emptyLabel, zoomLabel, onZoom }: PreviewThumbProps) {
  const interactive = Boolean(src && onZoom);
  return (
    <button
      type="button"
      onClick={interactive ? onZoom : undefined}
      disabled={!interactive}
      aria-label={interactive ? zoomLabel ?? alt : undefined}
      className={cn(
        "group relative block aspect-square w-full overflow-hidden rounded-[12px] bg-[color:var(--glass-recessed-bg)] text-left",
        interactive
          ? "cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-blue)]"
          : "cursor-default"
      )}
    >
      {src ? (
        <NextImage
          src={src}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] text-[color:var(--text-secondary)]">
          {emptyLabel}
        </div>
      )}
      {interactive ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-1 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {zoomLabel}
        </span>
      ) : null}
    </button>
  );
}

type LightboxProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  kindLabel: string;
  src: string | null;
  alt: string;
  onClose: () => void;
  kind: "original" | "result";
  onSwitchKind?: (kind: "original" | "result") => void;
  hasOriginal: boolean;
  hasResult: boolean;
  labels: {
    original: string;
    result: string;
    close: string;
    viewOriginal: string;
    viewResult: string;
    empty: string;
  };
};

function Lightbox({
  open,
  title,
  subtitle,
  kindLabel,
  src,
  alt,
  onClose,
  kind,
  onSwitchKind,
  hasOriginal,
  hasResult,
  labels,
}: LightboxProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (
        onSwitchKind &&
        (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Tab")
      ) {
        const next = kind === "original" ? "result" : "original";
        if ((next === "original" && hasOriginal) || (next === "result" && hasResult)) {
          event.preventDefault();
          onSwitchKind(next);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, onSwitchKind, kind, hasOriginal, hasResult]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-white/80"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={title}>
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-[11px] text-white/60" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSwitchKind ? (
            <div className="flex items-center rounded-full border border-white/20 bg-white/5 p-0.5 text-[11px]">
              <button
                type="button"
                disabled={!hasOriginal}
                onClick={() => onSwitchKind("original")}
                aria-label={labels.viewOriginal}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  kind === "original"
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:text-white",
                  !hasOriginal && "cursor-not-allowed opacity-40"
                )}
              >
                {labels.original}
              </button>
              <button
                type="button"
                disabled={!hasResult}
                onClick={() => onSwitchKind("result")}
                aria-label={labels.viewResult}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  kind === "result"
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:text-white",
                  !hasResult && "cursor-not-allowed opacity-40"
                )}
              >
                {labels.result}
              </button>
            </div>
          ) : (
            <span className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
              {kindLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 text-base text-white transition-colors hover:bg-white/15"
          >
            ×
          </button>
        </div>
      </div>
      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-6"
        onClick={onClose}
      >
        {src ? (
          <div
            className="relative h-full w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <NextImage
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized
              priority
            />
          </div>
        ) : (
          <p className="text-sm text-white/70">{labels.empty}</p>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function GeminiBatchImageTool() {
  const t = useTranslations("tools.gemini-batch-image.ui");

  const [items, setItems] = useState<FileItem[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyRemember, setApiKeyRemember] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [prompt, setPrompt] = useState("");
  const [suffix, setSuffix] = useState(DEFAULT_SUFFIX);
  const [concurrency, setConcurrency] = useState<number>(DEFAULT_CONCURRENCY);
  const [isRunning, setIsRunning] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [preview, setPreview] = useState<{ itemId: string; kind: "original" | "result" } | null>(
    null
  );

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<FileItem[]>([]);
  const runIdRef = useRef(0);
  const inFlightRef = useRef<Set<string>>(new Set());
  const zipIdRef = useRef(0);
  const zipWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const remember = window.localStorage.getItem(API_KEY_REMEMBER_STORAGE) === "1";
    setApiKeyRemember(remember);
    const stored = remember
      ? window.localStorage.getItem(API_KEY_STORAGE)
      : window.sessionStorage.getItem(API_KEY_STORAGE);
    if (stored) setApiKey(stored);
    const storedBaseUrl = window.localStorage.getItem(BASE_URL_STORAGE);
    if (storedBaseUrl) setBaseUrl(storedBaseUrl);
    const storedPrompt = window.localStorage.getItem(PROMPT_STORAGE);
    if (storedPrompt) setPrompt(storedPrompt);
    const storedSuffix = window.localStorage.getItem(SUFFIX_STORAGE);
    if (storedSuffix) setSuffix(storedSuffix);
    const storedModel = window.localStorage.getItem(MODEL_STORAGE);
    if (storedModel) setModel(storedModel);
    const storedConcurrency = window.localStorage.getItem(CONCURRENCY_STORAGE);
    const parsed = storedConcurrency ? Number.parseInt(storedConcurrency, 10) : NaN;
    if (Number.isFinite(parsed) && CONCURRENCY_OPTIONS.includes(parsed as (typeof CONCURRENCY_OPTIONS)[number])) {
      setConcurrency(parsed);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (apiKeyRemember) {
      window.localStorage.setItem(API_KEY_REMEMBER_STORAGE, "1");
      if (apiKey) {
        window.localStorage.setItem(API_KEY_STORAGE, apiKey);
      } else {
        window.localStorage.removeItem(API_KEY_STORAGE);
      }
      window.sessionStorage.removeItem(API_KEY_STORAGE);
    } else {
      window.localStorage.removeItem(API_KEY_REMEMBER_STORAGE);
      window.localStorage.removeItem(API_KEY_STORAGE);
      if (apiKey) {
        window.sessionStorage.setItem(API_KEY_STORAGE, apiKey);
      } else {
        window.sessionStorage.removeItem(API_KEY_STORAGE);
      }
    }
  }, [apiKey, apiKeyRemember]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (baseUrl) {
      window.localStorage.setItem(BASE_URL_STORAGE, baseUrl);
    } else {
      window.localStorage.removeItem(BASE_URL_STORAGE);
    }
  }, [baseUrl]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROMPT_STORAGE, prompt);
  }, [prompt]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SUFFIX_STORAGE, suffix);
  }, [suffix]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MODEL_STORAGE, model);
  }, [model]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CONCURRENCY_STORAGE, concurrency.toString());
  }, [concurrency]);

  useEffect(() => {
    const node = folderInputRef.current;
    if (!node) return;
    node.setAttribute("webkitdirectory", "");
    node.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.inputUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
      zipWorkerRef.current?.terminate();
      zipWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const expected = buildOutputFilename(
          { displayName: item.displayName, relativePath: item.relativePath },
          suffix
        );
        if (expected !== item.outputFilename) {
          changed = true;
          return { ...item, outputFilename: expected };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [suffix]);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) => item.status === "done").length;
    const failed = items.filter((item) => item.status === "error").length;
    const skipped = items.filter((item) => item.status === "skipped").length;
    const queued = items.filter((item) => item.status === "pending" || item.status === "processing").length;
    const totalSize = items.reduce((sum, item) => sum + (item.resultSize ?? 0), 0);
    return { total, done, failed, skipped, queued, totalSize };
  }, [items]);

  const updateItem = useCallback(
    (id: string, updater: (item: FileItem) => FileItem) => {
      setItems((prev) => {
        const index = prev.findIndex((item) => item.id === id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = updater(next[index]);
        return next;
      });
    },
    []
  );

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setGlobalError(null);
      setItems((prev) => {
        const existing = new Set(
          prev.map((item) =>
            `${item.relativePath || item.displayName}|${item.inputSize}|${item.file.lastModified}`
          )
        );
        const additions: FileItem[] = [];
        for (const file of files) {
          const key = fileDedupKey(file);
          if (existing.has(key)) continue;
          existing.add(key);
          const withPath = file as File & { webkitRelativePath?: string };
          const relativePath = withPath.webkitRelativePath || undefined;
          const mime = file.type;
          const supported = isSupportedInputMime(mime);
          const outputFilename = buildOutputFilename(
            { displayName: file.name, relativePath },
            suffix
          );
          let inputUrl = "";
          try {
            inputUrl = URL.createObjectURL(file);
          } catch {
            /* noop */
          }
          additions.push({
            id: createId("gbi"),
            file,
            displayName: file.name,
            relativePath,
            inputMimeType: mime,
            inputSize: file.size,
            inputUrl,
            status: supported ? "pending" : "skipped",
            errorCode: supported ? undefined : "UNSUPPORTED_MIME",
            outputFilename,
          });
        }
        if (additions.length === 0) return prev;
        return [...prev, ...additions];
      });
    },
    [suffix]
  );

  const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addFiles(files);
    event.target.value = "";
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    addFiles(files);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      try {
        const walked = await collectFilesFromDataTransfer(event.dataTransfer.items);
        if (walked.length > 0) {
          addFiles(walked);
          return;
        }
      } catch {
        /* fall through to flat files */
      }
    }
    const flat = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [];
    addFiles(flat);
  };

  const clearAll = () => {
    runIdRef.current += 1;
    itemsRef.current.forEach((item) => {
      item.abortController?.abort();
      URL.revokeObjectURL(item.inputUrl);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    inFlightRef.current.clear();
    setItems([]);
    setIsRunning(false);
    setGlobalError(null);
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeItem = (id: string) => {
    const existing = itemsRef.current.find((item) => item.id === id);
    if (existing) {
      existing.abortController?.abort();
      URL.revokeObjectURL(existing.inputUrl);
      if (existing.resultUrl) URL.revokeObjectURL(existing.resultUrl);
    }
    inFlightRef.current.delete(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleDownloadOne = (item: FileItem) => {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, item.outputFilename);
  };

  const ensureZipWorker = () => {
    if (zipWorkerRef.current) return zipWorkerRef.current;
    const worker = new Worker(new URL("./worker.ts", import.meta.url));
    zipWorkerRef.current = worker;
    return worker;
  };

  const handleDownloadAll = async () => {
    const done = itemsRef.current.filter(
      (item) => item.status === "done" && item.resultBlob
    );
    if (done.length === 0) return;
    setIsZipping(true);
    setGlobalError(null);
    try {
      const worker = ensureZipWorker();
      const id = ++zipIdRef.current;
      const entries: { name: string; data: Uint8Array }[] = [];
      const seenNames = new Set<string>();
      for (const item of done) {
        if (!item.resultBlob) continue;
        let name = item.outputFilename;
        if (seenNames.has(name)) {
          const ext = name.match(/\.[^.]+$/)?.[0] ?? "";
          const stem = ext ? name.slice(0, -ext.length) : name;
          let counter = 2;
          while (seenNames.has(`${stem}-${counter}${ext}`)) counter += 1;
          name = `${stem}-${counter}${ext}`;
        }
        seenNames.add(name);
        const buffer = await item.resultBlob.arrayBuffer();
        entries.push({ name, data: new Uint8Array(buffer) });
      }
      const zipBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const onMessage = (event: MessageEvent<ZipWorkerMessage>) => {
          const data = event.data;
          if (!data || data.id !== id) return;
          if (data.type === "result") {
            worker.removeEventListener("message", onMessage);
            resolve(data.buffer);
          } else if (data.type === "error") {
            worker.removeEventListener("message", onMessage);
            reject(new Error(data.message));
          }
        };
        worker.addEventListener("message", onMessage);
        worker.postMessage({ type: "zip", id, entries });
      });
      const blob = new Blob([zipBuffer], { type: "application/zip" });
      downloadBlob(blob, `gemini-batch-${zipStamp()}.zip`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "zip";
      setGlobalError(t("errors.zip") + (message ? ` · ${message}` : ""));
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadSequential = async () => {
    const done = itemsRef.current.filter(
      (item) => item.status === "done" && item.resultBlob
    );
    for (const item of done) {
      if (!item.resultBlob) continue;
      downloadBlob(item.resultBlob, item.outputFilename);
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }
  };

  const processItem = useCallback(
    async (id: string, runId: number) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      if (runId !== runIdRef.current) return;

      const controller = new AbortController();
      inFlightRef.current.add(id);
      updateItem(id, (item) => ({
        ...item,
        status: "processing",
        abortController: controller,
        errorCode: undefined,
      }));

      try {
        const result = await editImageWithGemini({
          apiKey,
          baseUrl,
          model,
          prompt,
          image: current.file,
          inputMimeType: current.inputMimeType,
          signal: controller.signal,
        });
        if (runId !== runIdRef.current) return;
        const resultUrl = URL.createObjectURL(result.blob);
        updateItem(id, (item) => {
          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
          return {
            ...item,
            status: "done",
            resultBlob: result.blob,
            resultUrl,
            resultMimeType: result.mimeType,
            resultSize: result.blob.size,
            abortController: undefined,
            errorCode: undefined,
          };
        });
      } catch (err) {
        const code: GeminiErrorCode =
          err instanceof Error && isGeminiErrorCode(err.message) ? err.message : "UNKNOWN";
        updateItem(id, (item) => ({
          ...item,
          status: code === "ABORTED" ? "cancelled" : "error",
          errorCode: code,
          abortController: undefined,
        }));
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [apiKey, baseUrl, model, prompt, updateItem]
  );

  const runQueue = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current) return;
      const limit = concurrency;
      while (inFlightRef.current.size < limit) {
        const next = itemsRef.current.find(
          (item) => item.status === "pending" && !inFlightRef.current.has(item.id)
        );
        if (!next) break;
        inFlightRef.current.add(next.id);
        void processItem(next.id, runId).finally(() => {
          if (runId !== runIdRef.current) {
            setIsRunning(false);
            return;
          }
          const stillQueued = itemsRef.current.some(
            (item) => item.status === "pending" || inFlightRef.current.has(item.id)
          );
          if (stillQueued) {
            runQueue(runId);
          } else {
            setIsRunning(false);
          }
        });
      }
    },
    [concurrency, processItem]
  );

  const handleRun = () => {
    if (!apiKey.trim()) {
      setGlobalError(t("errors.missingApiKey"));
      return;
    }
    if (!prompt.trim()) {
      setGlobalError(t("errors.missingPrompt"));
      return;
    }
    if (items.length === 0) {
      setGlobalError(t("status.noFiles"));
      return;
    }
    setGlobalError(null);

    runIdRef.current += 1;
    const runId = runIdRef.current;
    inFlightRef.current.clear();

    setItems((prev) =>
      prev.map((item) => {
        if (item.status === "done" || item.status === "skipped") return item;
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        return {
          ...item,
          status: "pending",
          resultBlob: undefined,
          resultUrl: undefined,
          resultMimeType: undefined,
          resultSize: undefined,
          errorCode: undefined,
          abortController: undefined,
        };
      })
    );

    setIsRunning(true);
    window.setTimeout(() => runQueue(runId), 0);
  };

  const handleStop = () => {
    runIdRef.current += 1;
    itemsRef.current.forEach((item) => {
      item.abortController?.abort();
    });
    inFlightRef.current.clear();
    setItems((prev) =>
      prev.map((item) => {
        if (item.status === "processing" || item.status === "pending") {
          return { ...item, status: "cancelled", abortController: undefined };
        }
        return item;
      })
    );
    setIsRunning(false);
  };

  const handleRetry = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item) return;
    if (item.status === "skipped" || item.status === "done") return;
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "pending",
              errorCode: undefined,
              abortController: undefined,
              resultBlob: undefined,
              resultUrl: entry.resultUrl
                ? (URL.revokeObjectURL(entry.resultUrl), undefined)
                : undefined,
              resultMimeType: undefined,
              resultSize: undefined,
            }
          : entry
      )
    );
    if (!isRunning) {
      if (!apiKey.trim()) {
        setGlobalError(t("errors.missingApiKey"));
        return;
      }
      if (!prompt.trim()) {
        setGlobalError(t("errors.missingPrompt"));
        return;
      }
      runIdRef.current += 1;
      const runId = runIdRef.current;
      setIsRunning(true);
      window.setTimeout(() => runQueue(runId), 0);
    }
  };

  const dropTitle = isDragActive
    ? t("drop.dropHere")
    : items.length > 0
      ? t("drop.replace")
      : t("drop.choose");
  const dropSubtitle = isDragActive ? t("drop.release") : t("drop.formatsHint");

  const totalResultSize = stats.totalSize;
  const zipWarn = totalResultSize > ZIP_WARN_BYTES;

  const statusMessage = (() => {
    if (globalError) return globalError;
    if (isRunning) {
      return t("status.runningSummary", {
        done: stats.done,
        total: stats.total,
        queued: stats.queued,
      });
    }
    if (items.length === 0) return t("status.noFiles");
    if (!apiKey.trim()) return t("status.noKey");
    if (!prompt.trim()) return t("status.noPrompt");
    return t("status.idle");
  })();

  const getStatusLabel = (item: FileItem) => {
    if (item.status === "error" && item.errorCode) {
      return t(`errors.${errorCodeToI18nKey(item.errorCode)}`);
    }
    return t(`status.${item.status}`);
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <ToolPanel
          title={t("labels.source")}
          actions={
            <button
              type="button"
              onClick={clearAll}
              disabled={items.length === 0 && !globalError}
              className="text-xs text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)] disabled:opacity-40"
            >
              {t("actions.clear")}
            </button>
          }
          headerClassName="flex items-center justify-between"
          className="flex flex-col gap-4"
        >
          <div
            className={cn(
              "group flex min-h-[140px] flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-4 py-4 text-center text-sm text-[color:var(--text-secondary)] transition-colors",
              items.length > 0 && "border-solid",
              isDragActive &&
                "border-[color:var(--accent-blue)] bg-[color:var(--glass-hover-bg)] text-[color:var(--text-primary)]"
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div
                className={cn(
                  "absolute -inset-1 rounded-[18px] border border-[color:var(--glass-border)] opacity-40",
                  items.length === 0 && "zenith-pulse",
                  isDragActive && "border-[color:var(--accent-blue)] opacity-70"
                )}
              />
              <div
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]",
                  items.length === 0 && "zenith-float",
                  isDragActive &&
                    "border-[color:var(--accent-blue)] text-[color:var(--accent-blue)]"
                )}
              >
                <UploadIcon className="h-5 w-5" />
              </div>
            </div>
            <span className="text-sm font-semibold text-[color:var(--text-primary)]">
              {dropTitle}
            </span>
            <span className="text-xs text-[color:var(--text-secondary)]">{dropSubtitle}</span>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <SecondaryButton
                size="sm"
                onClick={() => folderInputRef.current?.click()}
              >
                {t("actions.chooseFolder")}
              </SecondaryButton>
              <SecondaryButton
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("actions.chooseFiles")}
              </SecondaryButton>
            </div>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              onChange={handleFolderChange}
              className="sr-only"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              onChange={handleFilesChange}
              className="sr-only"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-[color:var(--text-secondary)] sm:grid-cols-4">
            <span>
              {t("stats.total")}: {stats.total}
            </span>
            <span>
              {t("stats.queued")}: {stats.queued}
            </span>
            <span>
              {t("stats.done")}: {stats.done}
            </span>
            <span>
              {t("stats.failed")}: {stats.failed}
            </span>
          </div>

          <p
            className={cn(
              "text-xs",
              globalError
                ? "text-rose-500/80"
                : "text-[color:var(--text-secondary)]"
            )}
          >
            {statusMessage}
          </p>
        </ToolPanel>

        <ToolPanel
          title={t("labels.settings")}
          headerClassName="flex items-center justify-between"
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.apiKey")}
            </label>
            <div className="flex items-center gap-2">
              <ToolInput
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={t("placeholders.apiKey")}
                className="font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <SecondaryButton
                size="sm"
                onClick={() => setShowApiKey((value) => !value)}
                aria-label={t("aria.toggleApiKey")}
              >
                {showApiKey ? "••" : "AA"}
              </SecondaryButton>
            </div>
            <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
              <input
                type="checkbox"
                checked={apiKeyRemember}
                onChange={(event) => setApiKeyRemember(event.target.checked)}
                className="accent-[color:var(--accent-blue)]"
              />
              <span>{t("labels.rememberKey")}</span>
            </label>
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              {t("helpers.byokDetail")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.baseUrl")}
            </label>
            <ToolInput
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={t("placeholders.baseUrl")}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              {t("helpers.baseUrlDetail")}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-xs text-[color:var(--text-secondary)]">
              <span id="gemini-batch-image-model-label" className="block">
                {t("labels.model")}
              </span>
              <Select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2"
                buttonClassName="rounded-[12px]"
                aria-labelledby="gemini-batch-image-model-label"
              >
                {AVAILABLE_MODELS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="text-xs text-[color:var(--text-secondary)]">
              <span id="gemini-batch-image-concurrency-label" className="block">
                {t("labels.concurrency")}
              </span>
              <Select
                value={concurrency.toString()}
                onChange={(event) => setConcurrency(Number(event.target.value))}
                className="mt-2"
                buttonClassName="rounded-[12px]"
                aria-labelledby="gemini-batch-image-concurrency-label"
              >
                {CONCURRENCY_OPTIONS.map((value) => (
                  <option key={value} value={value.toString()}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.prompt")}
            </label>
            <ToolTextarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={t("placeholders.prompt")}
              rows={3}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.suffix")}
            </label>
            <ToolInput
              value={suffix}
              onChange={(event) => setSuffix(event.target.value)}
              placeholder={t("placeholders.suffix")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isRunning ? (
              <DangerButton size="md" onClick={handleStop}>
                {t("actions.stop")}
              </DangerButton>
            ) : (
              <PrimaryButton onClick={handleRun} disabled={items.length === 0}>
                {t("actions.run")}
              </PrimaryButton>
            )}
            <SecondaryButton
              onClick={handleDownloadAll}
              disabled={isZipping || stats.done === 0}
            >
              {isZipping ? t("actions.zipping") : t("actions.downloadZip")}
            </SecondaryButton>
            {zipWarn ? (
              <GhostButton
                size="sm"
                onClick={handleDownloadSequential}
                disabled={stats.done === 0}
              >
                {t("actions.downloadAll")}
              </GhostButton>
            ) : null}
            {zipWarn ? (
              <span className="text-[11px] text-amber-500/80">
                {t("status.zipWarn", { size: formatBytes(totalResultSize) })}
              </span>
            ) : null}
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        title={t("labels.results")}
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
            <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
              {t("stats.done")}: {stats.done}
            </span>
            <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
              {t("stats.failed")}: {stats.failed}
            </span>
            <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
              {t("stats.skipped")}: {stats.skipped}
            </span>
            <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1">
              {t("stats.totalSize")}: {totalResultSize ? formatBytes(totalResultSize) : t("stats.empty")}
            </span>
          </div>
        }
        headerClassName="flex flex-wrap items-center justify-between gap-2"
        className="min-h-[240px]"
      >
        {items.length === 0 ? (
          <p className="mt-4 text-sm text-[color:var(--text-secondary)]">
            {t("helpers.empty")}
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                      {t("labels.original")}
                    </span>
                    <PreviewThumb
                      src={item.inputUrl}
                      alt={item.displayName}
                      emptyLabel={t("helpers.original")}
                      zoomLabel={t("actions.zoom")}
                      onZoom={
                        item.inputUrl
                          ? () => setPreview({ itemId: item.id, kind: "original" })
                          : undefined
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                      {t("labels.result")}
                    </span>
                    <PreviewThumb
                      src={item.resultUrl ?? null}
                      alt={item.outputFilename}
                      emptyLabel={t("helpers.result")}
                      zoomLabel={t("actions.zoom")}
                      onZoom={
                        item.resultUrl
                          ? () => setPreview({ itemId: item.id, kind: "result" })
                          : undefined
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="truncate text-xs font-medium text-[color:var(--text-primary)]" title={item.outputFilename}>
                    {item.outputFilename}
                  </p>
                  <p className="truncate text-[11px] text-[color:var(--text-secondary)]" title={item.relativePath || item.displayName}>
                    {item.relativePath || item.displayName} · {formatBytes(item.inputSize)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px]",
                      item.status === "done" &&
                        "bg-[color:var(--accent-green)]/15 text-[color:var(--accent-green)]",
                      item.status === "processing" &&
                        "bg-[color:var(--accent-blue)]/15 text-[color:var(--accent-blue)]",
                      item.status === "pending" &&
                        "bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)]",
                      item.status === "error" &&
                        "bg-rose-500/15 text-rose-500",
                      item.status === "cancelled" &&
                        "bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)]",
                      item.status === "skipped" &&
                        "bg-amber-500/15 text-amber-500"
                    )}
                  >
                    {getStatusLabel(item)}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.status === "done" ? (
                      <SecondaryButton
                        size="sm"
                        onClick={() => handleDownloadOne(item)}
                        aria-label={t("aria.downloadItem")}
                      >
                        {t("actions.downloadOne")}
                      </SecondaryButton>
                    ) : null}
                    {item.status === "error" || item.status === "cancelled" ? (
                      <SecondaryButton
                        size="sm"
                        onClick={() => handleRetry(item.id)}
                        aria-label={t("aria.retryItem")}
                      >
                        {t("actions.retry")}
                      </SecondaryButton>
                    ) : null}
                    <GhostButton
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      aria-label={t("aria.removeItem")}
                    >
                      {t("actions.removeItem")}
                    </GhostButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ToolPanel>
      {(() => {
        if (!preview) return null;
        const item = items.find((entry) => entry.id === preview.itemId);
        if (!item) return null;
        const hasOriginal = Boolean(item.inputUrl);
        const hasResult = Boolean(item.resultUrl);
        const kind = preview.kind === "result" && !hasResult ? "original" : preview.kind;
        const src = kind === "result" ? item.resultUrl ?? null : item.inputUrl;
        const kindLabel = kind === "result" ? t("labels.result") : t("labels.original");
        const title =
          kind === "result" ? item.outputFilename : item.displayName;
        return (
          <Lightbox
            open
            onClose={() => setPreview(null)}
            title={title}
            subtitle={item.relativePath && item.relativePath !== item.displayName ? item.relativePath : undefined}
            kindLabel={kindLabel}
            src={src}
            alt={title}
            kind={kind}
            hasOriginal={hasOriginal}
            hasResult={hasResult}
            onSwitchKind={
              hasOriginal && hasResult
                ? (nextKind) => setPreview({ itemId: item.id, kind: nextKind })
                : undefined
            }
            labels={{
              original: t("labels.original"),
              result: t("labels.result"),
              close: t("actions.close"),
              viewOriginal: t("aria.viewOriginal"),
              viewResult: t("aria.viewResult"),
              empty: t("helpers.result"),
            }}
          />
        );
      })()}
    </div>
  );
}

function errorCodeToI18nKey(code: GeminiErrorCode) {
  switch (code) {
    case "MISSING_API_KEY":
      return "missingApiKey";
    case "MISSING_PROMPT":
      return "missingPrompt";
    case "UNSUPPORTED_MIME":
      return "unsupportedMime";
    case "NO_INLINE_DATA":
      return "noInlineData";
    case "ABORTED":
      return "aborted";
    case "RATE_LIMITED":
      return "rateLimited";
    case "AUTH_FAILED":
      return "authFailed";
    case "NETWORK":
      return "network";
    case "UNKNOWN":
    default:
      return "unknown";
  }
}
