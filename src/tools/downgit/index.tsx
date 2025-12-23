"use client";

import { useMemo, useState } from "react";

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
  modified?: Date;
};

const textEncoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16LE = (buffer: Uint8Array, offset: number, value: number) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32LE = (buffer: Uint8Array, offset: number, value: number) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
};

const toDosDateTime = (date: Date) => {
  const safeDate = date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  const year = safeDate.getFullYear() - 1980;
  const month = safeDate.getMonth() + 1;
  const day = safeDate.getDate();
  const hours = safeDate.getHours();
  const minutes = safeDate.getMinutes();
  const seconds = Math.floor(safeDate.getSeconds() / 2);
  const dosDate = (year << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
};

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

const fetchJson = async (url: string, token?: string) => {
  const response = await fetch(url, {
    headers: buildHeaders(token),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.message === "string"
        ? payload.message
        : `GitHub API error (${response.status}).`;
    throw new Error(message);
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

const toArrayBuffer = (value: Uint8Array) => {
  const buffer = value.buffer;
  if (buffer instanceof ArrayBuffer) {
    if (value.byteOffset === 0 && value.byteLength === buffer.byteLength) {
      return buffer;
    }
    return buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return new Uint8Array(value).buffer;
};

const createZip = (entries: ZipEntry[]) => {
  const localParts: ArrayBuffer[] = [];
  const centralParts: ArrayBuffer[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const name = entry.isDirectory && !entry.name.endsWith("/")
      ? `${entry.name}/`
      : entry.name;
    const nameBytes = textEncoder.encode(name);
    const data = entry.data;
    const size = data.length;
    const crc = crc32(data);
    const { dosDate, dosTime } = toDosDateTime(entry.modified ?? new Date());
    const localHeader = new Uint8Array(30);

    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 6, 0x0800);
    writeUint16LE(localHeader, 8, 0);
    writeUint16LE(localHeader, 10, dosTime);
    writeUint16LE(localHeader, 12, dosDate);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, size);
    writeUint32LE(localHeader, 22, size);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);

    localParts.push(
      toArrayBuffer(localHeader),
      toArrayBuffer(nameBytes),
      toArrayBuffer(data)
    );

    const centralHeader = new Uint8Array(46);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0x0800);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, dosTime);
    writeUint16LE(centralHeader, 14, dosDate);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(centralHeader, 20, size);
    writeUint32LE(centralHeader, 24, size);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, entry.isDirectory ? 0x10 : 0);
    writeUint32LE(centralHeader, 42, offset);

    centralParts.push(
      toArrayBuffer(centralHeader),
      toArrayBuffer(nameBytes)
    );

    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce(
    (sum, part) => sum + part.byteLength,
    0
  );
  const endRecord = new Uint8Array(22);

  writeUint32LE(endRecord, 0, 0x06054b50);
  writeUint16LE(endRecord, 4, 0);
  writeUint16LE(endRecord, 6, 0);
  writeUint16LE(endRecord, 8, entries.length);
  writeUint16LE(endRecord, 10, entries.length);
  writeUint32LE(endRecord, 12, centralSize);
  writeUint32LE(endRecord, 16, centralOffset);
  writeUint16LE(endRecord, 20, 0);

  return new Blob([...localParts, ...centralParts, toArrayBuffer(endRecord)], {
    type: "application/zip",
  });
};

const sanitizeFileName = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, "-");

export default function DownGitTool() {
  const [input, setInput] = useState(SAMPLE_URL);
  const [refOverride, setRefOverride] = useState("");
  const [token, setToken] = useState("");
  const [outputName, setOutputName] = useState("");
  const [resolved, setResolved] = useState<ResolvedTarget | null>(null);
  const [status, setStatus] = useState("Ready to download from GitHub.");
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  const parseResult = useMemo(() => parseGithubUrl(input), [input]);
  const parsedTarget = parseResult.target;
  const parseError = parseResult.error;

  const effectiveRef =
    refOverride.trim() || parsedTarget?.ref || undefined;

  const displayPath = parsedTarget?.path ? `/${parsedTarget.path}` : "/";

  const primaryButtonClass =
    "rounded-full bg-[color:var(--accent-blue)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)] transition-colors";
  const secondaryButtonClass =
    "rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-4 py-2 text-sm text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] transition-colors hover:bg-[color:var(--glass-hover-bg)]";

  const reset = () => {
    setInput("");
    setRefOverride("");
    setToken("");
    setOutputName("");
    setResolved(null);
    setStatus("Ready to download from GitHub.");
    setError(null);
    setProgress(null);
  };

  const resolveTarget = async () => {
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

    const data = await fetchJson(apiUrl, token.trim() || undefined);

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
    ref?: string
  ) => {
    const apiUrl = buildContentsUrl(owner, repo, path, ref);
    const data = await fetchJson(apiUrl, token.trim() || undefined);
    if (!Array.isArray(data)) {
      throw new Error("Expected a directory but found a file.");
    }
    return data as GithubContent[];
  };

  const collectFiles = async (target: ResolvedTarget) => {
    const queue = [target.path];
    const files: GithubContent[] = [];

    while (queue.length > 0) {
      const current = queue.shift() ?? "";
      const entries = await fetchDirectory(
        target.owner,
        target.repo,
        current,
        target.ref
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
    ref?: string
  ) => {
    if (entry.download_url) {
      try {
        const response = await fetch(entry.download_url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return new Uint8Array(buffer);
        }
      } catch {
        // Fallback to contents API.
      }
    }

    const apiUrl = buildContentsUrl(owner, repo, entry.path, ref);
    const data = await fetchJson(apiUrl, token.trim() || undefined);
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

  const updateResolved = (next: ResolvedTarget) => {
    setResolved(next);
    setOutputName(
      next.type === "file" ? next.name : `${next.name}.zip`
    );
  };

  const handleAnalyze = async () => {
    setError(null);
    setProgress(null);
    if (!parsedTarget) {
      setStatus("Paste a valid GitHub URL.");
      return;
    }
    setIsWorking(true);
    setStatus("Checking the target on GitHub...");
    try {
      const next = await resolveTarget();
      updateResolved(next);
      setStatus(`Ready to download ${next.type}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reach GitHub.";
      setError(message);
      setStatus("Check failed.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownload = async () => {
    setError(null);
    setProgress(null);
    if (!parsedTarget) {
      setStatus("Paste a valid GitHub URL.");
      return;
    }
    setIsWorking(true);
    try {
      setStatus("Resolving download target...");
      const target = resolved ?? (await resolveTarget());
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
          target.ref
        );
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const filename = buildFileName(target);
        triggerDownload(blob, filename);
        setStatus(`Downloaded ${filename}.`);
        return;
      }

      setStatus("Scanning folders...");
      const { files } = await collectFiles(target);
      if (files.length === 0) {
        throw new Error("No files found in this directory.");
      }
      if (files.length > 65000) {
        throw new Error("This folder is too large to package as a zip.");
      }

      setProgress({ current: 0, total: files.length });
      const baseName = sanitizeFileName(target.name);
      const prefix = target.path ? `${trimSlashes(target.path)}/` : "";
      const entries: ZipEntry[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const bytes = await fetchFileBytes(
          file,
          target.owner,
          target.repo,
          target.ref
        );
        const relative = prefix ? file.path.slice(prefix.length) : file.path;
        const entryName = `${baseName}/${relative}`;
        entries.push({ name: entryName, data: bytes });
        setProgress({ current: i + 1, total: files.length });
        setStatus(`Downloading ${i + 1}/${files.length} files...`);
      }

      setStatus("Building zip...");
      const zipBlob = createZip(entries);
      const filename = buildFileName(target);
      triggerDownload(zipBlob, filename);
      setStatus(`Downloaded ${filename}.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Download failed.";
      setError(message);
      setStatus("Download failed.");
    } finally {
      setIsWorking(false);
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
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={disableActions || !input.trim()}
              className={cn(
                secondaryButtonClass,
                disableActions || !input.trim()
                  ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)]"
                  : ""
              )}
            >
              Check
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={disableActions || !input.trim()}
              className={cn(
                primaryButtonClass,
                disableActions || !input.trim()
                  ? "cursor-not-allowed bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] shadow-none"
                  : ""
              )}
            >
              Download
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-full px-3 py-2 text-sm text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
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
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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
