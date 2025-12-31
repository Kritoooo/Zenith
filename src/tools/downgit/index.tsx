"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DangerButton,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/Button";
import { cn } from "@/lib/cn";

const SAMPLE_URL = "https://github.com/Kritoooo/Zenith";

type ParsedTarget = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  hint: "file" | "dir";
  source: "github" | "raw" | "api";
};

type ResolvedTarget = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  type: "file" | "dir";
  name: string;
  downloadUrl?: string | null;
  htmlUrl?: string;
};

type GithubContent = {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  url: string;
  download_url: string | null;
};

type ParseResult = {
  target?: ParsedTarget;
  error?: string;
};

type ZipEntry = {
  name: string;
  data: Uint8Array;
  isDirectory?: boolean;
  modified?: number | null;
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

const createZipWorker = () => new Worker(new URL("./worker.ts", import.meta.url));

const normalizeRepo = (value: string) =>
  value.endsWith(".git") ? value.slice(0, -4) : value;

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const parseGithubUrl = (value: string): ParseResult => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Paste a GitHub URL to get started." };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: "Enter a valid URL." };
  }

  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "github.com") {
    if (parts.length < 2) {
      return { error: "GitHub URLs must include owner and repo." };
    }
    const owner = parts[0];
    const repo = normalizeRepo(parts[1]);
    if (parts.length === 2) {
      return {
        target: { owner, repo, path: "", hint: "dir", source: "github" },
      };
    }

    const marker = parts[2];
    if (marker === "tree" || marker === "blob") {
      const ref = parts[3];
      const path = parts.slice(4).join("/");
      if (!ref) {
        return { error: "This URL is missing a branch or tag name." };
      }
      if (marker === "blob" && !path) {
        return { error: "Blob URLs must include a file path." };
      }
      return {
        target: {
          owner,
          repo,
          path,
          ref,
          hint: marker === "blob" ? "file" : "dir",
          source: "github",
        },
      };
    }

    const path = parts.slice(2).join("/");
    return {
      target: { owner, repo, path, hint: "dir", source: "github" },
    };
  }

  if (host === "raw.githubusercontent.com") {
    if (parts.length < 4) {
      return { error: "Raw URLs must include owner, repo, ref, and path." };
    }
    const owner = parts[0];
    const repo = normalizeRepo(parts[1]);
    const ref = parts[2];
    const path = parts.slice(3).join("/");
    if (!path) {
      return { error: "Raw URLs must point to a file." };
    }
    return {
      target: { owner, repo, path, ref, hint: "file", source: "raw" },
    };
  }

  if (host === "api.github.com") {
    if (parts[0] !== "repos" || parts.length < 4) {
      return { error: "Unsupported GitHub API URL." };
    }
    const owner = parts[1];
    const repo = normalizeRepo(parts[2]);
    if (parts[3] !== "contents") {
      return { error: "Only contents API URLs are supported." };
    }
    const path = parts.slice(4).join("/");
    const ref = url.searchParams.get("ref") ?? undefined;
    return {
      target: { owner, repo, path, ref, hint: path ? "file" : "dir", source: "api" },
    };
  }

  return { error: "Only github.com URLs are supported right now." };
};

const buildHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const buildContentsUrl = (
  owner: string,
  repo: string,
  path: string,
  ref?: string
) => {
  const basePath = path ? `/contents/${path}` : "/contents";
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}${basePath}`);
  if (ref) {
    url.searchParams.set("ref", ref);
  }
  return url.toString();
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseHeaderInt = (value: string | null) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  if (totalSeconds <= 1) return "a moment";
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
};

const formatRetryTime = (date: Date, waitMs: number) => {
  if (waitMs >= DAY_MS) {
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildRateLimitHint = (response: Response) => {
  const retryAfterSeconds = parseHeaderInt(response.headers.get("retry-after"));
  const resetEpochSeconds = parseHeaderInt(
    response.headers.get("x-ratelimit-reset")
  );
  const remaining = parseHeaderInt(
    response.headers.get("x-ratelimit-remaining")
  );

  const hasRetryAfter = typeof retryAfterSeconds === "number";
  const hasReset = typeof resetEpochSeconds === "number";
  const isRateLimited =
    response.status === 429 ||
    hasRetryAfter ||
    (hasReset && remaining === 0);

  if (!isRateLimited) return null;

  let waitMs: number | null = null;
  let retryTime: Date | null = null;

  if (hasRetryAfter && retryAfterSeconds) {
    waitMs = Math.max(0, retryAfterSeconds * 1000);
    retryTime = new Date(Date.now() + waitMs);
  } else if (hasReset && resetEpochSeconds) {
    retryTime = new Date(resetEpochSeconds * 1000);
    waitMs = retryTime.getTime() - Date.now();
  }

  if (waitMs === null || !retryTime) {
    return "Rate limit reached. Please wait and try again.";
  }

  const durationLabel = formatDuration(waitMs);
  const timeLabel = formatRetryTime(retryTime, waitMs);
  return `Rate limit reached. Try again in about ${durationLabel} (around ${timeLabel}).`;
};

const fetchJson = async (url: string, token?: string, signal?: AbortSignal) => {
  const response = await fetch(url, {
    headers: buildHeaders(token),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : `GitHub API error (${response.status}).`;
    const rateHint = buildRateLimitHint(response);
    throw new Error(rateHint ? `${message} ${rateHint}` : message);
  }
  return response.json();
};

const decodeBase64 = (value: string) => {
  const cleaned = value.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, "-");

const DEFAULT_CONCURRENCY = 6;
const MIN_CONCURRENCY = 2;
const MAX_CONCURRENCY = 8;

const parseConcurrency = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, parsed));
};

const getConcurrentDownloads = () => {
  if (typeof navigator === "undefined") return DEFAULT_CONCURRENCY;
  const cores = navigator.hardwareConcurrency ?? DEFAULT_CONCURRENCY;
  const scaled = Math.round(cores * 0.75);
  const clamped = Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, scaled));
  return Number.isFinite(clamped) && clamped > 0 ? clamped : DEFAULT_CONCURRENCY;
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";

export default function DownGitTool() {
  const [input, setInput] = useState(SAMPLE_URL);
  const [refOverride, setRefOverride] = useState("");
  const [token, setToken] = useState("");
  const [outputName, setOutputName] = useState("");
  const [concurrencyInput, setConcurrencyInput] = useState("");
  const [resolved, setResolved] = useState<ResolvedTarget | null>(null);
  const [status, setStatus] = useState("Ready to download from GitHub.");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const zipWorkerRef = useRef<Worker | null>(null);
  const zipRunIdRef = useRef(0);
  const zipRejectRef = useRef<((error: unknown) => void) | null>(null);

  const parseResult = useMemo(() => parseGithubUrl(input), [input]);
  const parsedTarget = parseResult.target;
  const parseError = parseResult.error;
  const autoConcurrency = useMemo(() => getConcurrentDownloads(), []);
  const manualConcurrency = useMemo(
    () => parseConcurrency(concurrencyInput.trim()),
    [concurrencyInput]
  );
  const effectiveConcurrency = manualConcurrency ?? autoConcurrency;

  const effectiveRef =
    refOverride.trim() || parsedTarget?.ref || undefined;

  const displayPath = parsedTarget?.path ? `/${parsedTarget.path}` : "/";
  const concurrencyLabel = manualConcurrency
    ? `Manual (${manualConcurrency})`
    : `Auto (${autoConcurrency})`;
  const tokenStatus = token.trim() ? "Token provided" : "No token";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (zipWorkerRef.current) {
        zipWorkerRef.current.terminate();
        zipWorkerRef.current = null;
      }
      zipRejectRef.current = null;
    };
  }, []);

  const terminateZipWorker = () => {
    if (!zipWorkerRef.current) return;
    zipWorkerRef.current.terminate();
    zipWorkerRef.current = null;
    if (zipRejectRef.current) {
      zipRejectRef.current(new DOMException("Aborted", "AbortError"));
      zipRejectRef.current = null;
    }
  };

  const getZipTransferList = (entries: ZipEntry[]) => {
    const buffers = new Set<ArrayBuffer>();
    entries.forEach((entry) => {
      if (entry.data?.buffer instanceof ArrayBuffer) {
        buffers.add(entry.data.buffer);
      }
    });
    return Array.from(buffers);
  };

  const createZipInWorker = (entries: ZipEntry[]) => {
    terminateZipWorker();
    const worker = createZipWorker();
    zipWorkerRef.current = worker;
    const runId = (zipRunIdRef.current += 1);

    return new Promise<ArrayBuffer>((resolve, reject) => {
      zipRejectRef.current = reject;
      const handleMessage = (event: MessageEvent<ZipWorkerMessage>) => {
        const data = event.data;
        if (!data || data.id !== runId) return;
        if (data.type === "progress") {
          setProgress({ current: data.completed, total: data.total });
          setStatus(`Building zip ${data.completed}/${data.total}...`);
          return;
        }
        if (data.type === "result") {
          cleanup();
          resolve(data.buffer);
          return;
        }
        if (data.type === "error") {
          cleanup();
          reject(new Error(data.message));
        }
      };

      const handleError = (event: Event | ErrorEvent) => {
        cleanup();
        const errorEvent = event as ErrorEvent;
        const message = errorEvent?.message
          ? `Zip worker error: ${errorEvent.message}`
          : "Zip worker failed.";
        reject(new Error(message));
      };

      const handleMessageError = () => {
        cleanup();
        reject(new Error("Zip worker message could not be deserialized."));
      };

      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        worker.removeEventListener("messageerror", handleMessageError);
        if (zipRejectRef.current === reject) {
          zipRejectRef.current = null;
        }
        if (zipWorkerRef.current === worker) {
          zipWorkerRef.current = null;
        }
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.addEventListener("messageerror", handleMessageError);

      const transferables = getZipTransferList(entries);
      worker.postMessage({ type: "zip", id: runId, entries }, transferables);
    });
  };

  const reset = () => {
    terminateZipWorker();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setInput("");
    setRefOverride("");
    setToken("");
    setOutputName("");
    setConcurrencyInput("");
    setResolved(null);
    setStatus("Ready to download from GitHub.");
    setError(null);
    setProgress(null);
  };

  const resolveTarget = async (signal?: AbortSignal) => {
    if (!parsedTarget) {
      throw new Error(parseError ?? "Enter a valid GitHub URL.");
    }

    const ref = effectiveRef;
    const apiUrl = buildContentsUrl(
      parsedTarget.owner,
      parsedTarget.repo,
      parsedTarget.path,
      ref
    );

    const data = await fetchJson(apiUrl, token.trim() || undefined, signal);

    if (Array.isArray(data)) {
      const name = parsedTarget.path
        ? parsedTarget.path.split("/").filter(Boolean).pop() ?? parsedTarget.repo
        : parsedTarget.repo;
      return {
        owner: parsedTarget.owner,
        repo: parsedTarget.repo,
        path: parsedTarget.path,
        ref,
        type: "dir",
        name,
      } satisfies ResolvedTarget;
    }

    if (data?.type === "file") {
      return {
        owner: parsedTarget.owner,
        repo: parsedTarget.repo,
        path: parsedTarget.path,
        ref,
        type: "file",
        name: data.name ?? parsedTarget.path.split("/").pop() ?? parsedTarget.repo,
        downloadUrl: data.download_url,
        htmlUrl: data.html_url,
      } satisfies ResolvedTarget;
    }

    if (data?.type === "dir") {
      return {
        owner: parsedTarget.owner,
        repo: parsedTarget.repo,
        path: parsedTarget.path,
        ref,
        type: "dir",
        name: data.name ?? parsedTarget.path.split("/").pop() ?? parsedTarget.repo,
      } satisfies ResolvedTarget;
    }

    throw new Error("Unsupported target type (symlink or submodule).");
  };

  const fetchDirectory = async (
    owner: string,
    repo: string,
    path: string,
    ref?: string,
    signal?: AbortSignal
  ) => {
    const apiUrl = buildContentsUrl(owner, repo, path, ref);
    const data = await fetchJson(apiUrl, token.trim() || undefined, signal);
    if (!Array.isArray(data)) {
      throw new Error("Expected a directory but found a file.");
    }
    return data as GithubContent[];
  };

  const collectFiles = async (target: ResolvedTarget, signal?: AbortSignal) => {
    const queue = [target.path];
    const files: GithubContent[] = [];

    while (queue.length > 0) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const current = queue.shift() ?? "";
      const entries = await fetchDirectory(
        target.owner,
        target.repo,
        current,
        target.ref,
        signal
      );

      entries.forEach((entry) => {
        if (entry.type === "dir") {
          queue.push(entry.path);
        } else if (entry.type === "file") {
          files.push(entry);
        }
      });
    }

    return { files };
  };

  const fetchFileBytes = async (
    entry: GithubContent,
    owner: string,
    repo: string,
    ref?: string,
    signal?: AbortSignal
  ) => {
    if (entry.download_url) {
      try {
        const response = await fetch(entry.download_url, { signal });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        }
      } catch {
        // Fallback to contents API.
      }
    }

    const apiUrl = buildContentsUrl(owner, repo, entry.path, ref);
    const data = await fetchJson(apiUrl, token.trim() || undefined, signal);
    if (!data?.content || data.encoding !== "base64") {
      throw new Error(`Unable to download ${entry.path}.`);
    }
    return decodeBase64(data.content);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const buildFileName = (target: ResolvedTarget) => {
    const fallback =
      target.type === "file" ? target.name : `${target.name}.zip`;
    const trimmed = outputName.trim();
    const candidate = trimmed ? sanitizeFileName(trimmed) : fallback;
    if (target.type === "dir" && !candidate.toLowerCase().endsWith(".zip")) {
      return `${candidate}.zip`;
    }
    return candidate;
  };

  const outputPreview = resolved
    ? buildFileName(resolved)
    : outputName.trim() || "—";

  const updateResolved = (next: ResolvedTarget) => {
    setResolved(next);
    setOutputName(
      next.type === "file" ? next.name : `${next.name}.zip`
    );
  };

  const cancelWork = () => {
    terminateZipWorker();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("Cancelling...");
    setProgress(null);
  };

  const handleAnalyze = async () => {
    setError(null);
    setProgress(null);
    if (!parsedTarget) {
      setStatus("Paste a valid GitHub URL.");
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsWorking(true);
    setStatus("Checking the target on GitHub...");
    try {
      const next = await resolveTarget(controller.signal);
      updateResolved(next);
      setStatus(`Ready to download ${next.type}.`);
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("Check canceled.");
      } else {
        const message =
          err instanceof Error ? err.message : "Unable to reach GitHub.";
        setError(message);
        setStatus("Check failed.");
      }
    } finally {
      setIsWorking(false);
      abortControllerRef.current = null;
    }
  };

  const handleDownload = async () => {
    setError(null);
    setProgress(null);
    if (!parsedTarget) {
      setStatus("Paste a valid GitHub URL.");
      return;
    }
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;
    setIsWorking(true);
    try {
      setStatus("Resolving download target...");
      const target = resolved ?? (await resolveTarget(signal));
      if (!resolved) {
        updateResolved(target);
      }

      if (target.type === "file") {
        setStatus("Downloading file...");
        const entry: GithubContent = {
          name: target.name,
          path: target.path,
          type: "file",
          url: buildContentsUrl(
            target.owner,
            target.repo,
            target.path,
            target.ref
          ),
          download_url: target.downloadUrl ?? null,
        };
        const bytes = await fetchFileBytes(
          entry,
          target.owner,
          target.repo,
          target.ref,
          signal
        );
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const filename = buildFileName(target);
        triggerDownload(blob, filename);
        setStatus(`Downloaded ${filename}.`);
        return;
      }

      setStatus("Scanning folders...");
      const { files } = await collectFiles(target, signal);
      if (files.length === 0) {
        throw new Error("No files found in this directory.");
      }
      if (files.length > 65000) {
        throw new Error("This folder is too large to package as a zip.");
      }

      setProgress({ current: 0, total: files.length });
      const baseName = sanitizeFileName(target.name);
      const prefix = target.path ? `${trimSlashes(target.path)}/` : "";
      const concurrentDownloads = manualConcurrency ?? autoConcurrency;
      const entries = await (async () => {
        const results: ZipEntry[] = new Array(files.length);
        let completed = 0;
        const inflight = new Set<Promise<void>>();

        const runTask = async (index: number) => {
          if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }
          const file = files[index];
          const bytes = await fetchFileBytes(
            file,
            target.owner,
            target.repo,
            target.ref,
            signal
          );
          const relative = prefix ? file.path.slice(prefix.length) : file.path;
          const entryName = `${baseName}/${relative}`;
          results[index] = { name: entryName, data: bytes };
          completed += 1;
          setProgress({ current: completed, total: files.length });
          setStatus(`Downloading ${completed}/${files.length} files...`);
        };

        try {
          for (let i = 0; i < files.length; i += 1) {
            const task = runTask(i);
            inflight.add(task);
            task.finally(() => inflight.delete(task));
          if (inflight.size >= concurrentDownloads) {
            await Promise.race(inflight);
          }
        }

          await Promise.all(inflight);
          return results;
        } catch (err) {
          await Promise.allSettled(inflight);
          throw err;
        }
      })();

      setStatus("Building zip...");
      setProgress({ current: 0, total: entries.length });
      const zipBuffer = await createZipInWorker(entries);
      const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
      const filename = buildFileName(target);
      triggerDownload(zipBlob, filename);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("Download canceled.");
        setProgress(null);
      } else {
        const message =
          err instanceof Error ? err.message : "Download failed.";
        setError(message);
        setStatus("Download failed.");
      }
    } finally {
      setIsWorking(false);
      abortControllerRef.current = null;
    }
  };

  const statusMessage =
    error ?? (parseError && input.trim() ? parseError : status);

  const disableActions = isWorking || !!parseError;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          GitHub URL
        </p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setRefOverride("");
              setResolved(null);
              setOutputName("");
              setError(null);
              setProgress(null);
              setStatus("Ready to download from GitHub.");
            }}
            placeholder={SAMPLE_URL}
            spellCheck={false}
            className="w-full flex-1 rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              onClick={handleAnalyze}
              disabled={disableActions || !input.trim()}
            >
              Check
            </SecondaryButton>
            <PrimaryButton
              onClick={handleDownload}
              disabled={disableActions || !input.trim()}
            >
              Download
            </PrimaryButton>
            {isWorking ? (
              <DangerButton onClick={cancelWork}>Cancel</DangerButton>
            ) : null}
            <GhostButton onClick={reset}>Clear</GhostButton>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                Target
              </p>
              <p className="mt-2 text-sm text-[color:var(--text-primary)]">
                {parsedTarget
                  ? `${parsedTarget.owner}/${parsedTarget.repo}${displayPath}`
                  : "Waiting for a GitHub URL."}
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                {parsedTarget
                  ? `Source: ${parsedTarget.source.toUpperCase()}`
                  : "Paste a repo, file, or folder link."}
              </p>
              {parsedTarget ? (
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                  Ref: {effectiveRef ?? "default branch"}
                </p>
              ) : null}
            </div>
            <div className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-xs text-[color:var(--text-secondary)]">
              {resolved
                ? `Resolved as a ${resolved.type} (${resolved.name}).`
                : "Check the URL to confirm file or folder before downloading."}
            </div>
            {resolved?.htmlUrl ? (
              <a
                href={resolved.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[color:var(--accent-blue)] hover:underline"
              >
                View on GitHub
              </a>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                Status
              </p>
              <span className="text-[11px] text-[color:var(--text-secondary)]">
                {concurrencyLabel}
              </span>
            </div>
            <p
              className={cn(
                "min-h-[1.25rem] text-xs",
                error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
              )}
              aria-live="polite"
            >
              {statusMessage}
            </p>
            {progress ? (
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--glass-recessed-bg)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-blue)] transition-all"
                  style={{
                    width: `${Math.round(
                      (progress.current / progress.total) * 100
                    )}%`,
                  }}
                />
              </div>
            ) : null}
            <div className="grid gap-2 text-xs text-[color:var(--text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Output</span>
                <span className="text-[color:var(--text-primary)]">{outputPreview}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Auth</span>
                <span className="text-[color:var(--text-primary)]">
                  {tokenStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              Options
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label className="text-xs text-[color:var(--text-secondary)]">
                  Ref override (branch, tag, commit)
                </label>
                <input
                  value={refOverride}
                  onChange={(event) => {
                    setRefOverride(event.target.value);
                    setResolved(null);
                    setError(null);
                    setStatus("Ready to download from GitHub.");
                  }}
                  placeholder={parsedTarget?.ref ?? "main"}
                  className="mt-2 w-full rounded-[12px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="text-xs text-[color:var(--text-secondary)]">
                  Output filename
                </label>
                <input
                  value={outputName}
                  onChange={(event) => setOutputName(event.target.value)}
                  placeholder={resolved ? buildFileName(resolved) : "example.zip"}
                  className="mt-2 w-full rounded-[12px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="text-xs text-[color:var(--text-secondary)]">
                  Concurrent downloads
                </label>
                <input
                  value={concurrencyInput}
                  onChange={(event) => setConcurrencyInput(event.target.value)}
                  placeholder={`Auto (${autoConcurrency})`}
                  inputMode="numeric"
                  className="mt-2 w-full rounded-[12px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
                <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                  Auto uses ~75% of CPU cores (min {MIN_CONCURRENCY}, max {MAX_CONCURRENCY}).
                  Effective: {effectiveConcurrency}.
                </p>
              </div>
              <div>
                <label className="text-xs text-[color:var(--text-secondary)]">
                  GitHub token (optional)
                </label>
                <input
                  value={token}
                  onChange={(event) => {
                    setToken(event.target.value);
                    setError(null);
                    setStatus("Ready to download from GitHub.");
                  }}
                  placeholder="Optional for private repos"
                  type="password"
                  className="mt-2 w-full rounded-[12px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-xs text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
                />
                <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                  Token stays in your browser session and is never stored.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Supports files or folders",
            detail: "Paste a GitHub link with /blob/ or /tree/ paths.",
          },
          {
            title: "Public repos work best",
            detail: "Use a token when hitting rate limits or private repos.",
          },
          {
            title: "Keeps folder structure",
            detail: "Downloads as a zip with the selected path.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 text-xs text-[color:var(--text-secondary)]"
          >
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {item.title}
            </p>
            <p className="mt-2">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
