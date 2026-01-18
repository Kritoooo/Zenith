"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button, GhostButton, PrimaryButton, SecondaryButton } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";
import { useClipboard } from "@/lib/useClipboard";

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

type PathSegment =
  | { type: "property"; key: string }
  | { type: "index"; index: number }
  | { type: "wildcard" };

type ExtractionItem = {
  path: string;
  values: JsonValue[];
};

type RunSummary = {
  total: number;
  missing: number;
  usedScript: boolean;
};

type DetectSummary = {
  count: number;
  truncated: boolean;
  reason: "paths" | "nodes" | null;
};

type SavedScript = {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  updatedAt: number;
};

type ScriptNotice = {
  message: string;
  tone: "normal" | "error";
};

const DEFAULT_SAMPLE_JSON = `{
  "order": {
    "id": "ORD-2025-0192",
    "customer": {
      "name": "Ava Chen",
      "email": "ava@zenith.dev"
    },
    "items": [
      { "sku": "S-1001", "title": "Aurora Lamp", "price": 129 },
      { "sku": "S-1002", "title": "Nimbus Stand", "price": 89 }
    ]
  }
}`;

const DEFAULT_SAMPLE_PATHS = `order.id
order.customer.name
order.items[*].sku`;

const DEFAULT_SAMPLE_SCRIPT = `return items
  .flatMap((item) =>
    item.values.map((value) => item.path + ": " + helpers.toText(value))
  )
  .join("\\n");`;

const DETECT_PATH_LIMIT = 1500;
const DETECT_NODE_LIMIT = 20000;
const SCRIPT_LIST_STORAGE_KEY = "zenith.json-field-extractor.scripts";
const SCRIPT_ACTIVE_STORAGE_KEY = "zenith.json-field-extractor.active-script";
const LEGACY_SCRIPT_STORAGE_KEY = "zenith.json-field-extractor.script";

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIdentifierKey = (value: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);

const escapeQuotedKey = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

const appendPropertyPath = (base: string, key: string) => {
  if (isIdentifierKey(key)) {
    return base ? `${base}.${key}` : key;
  }
  const token = `["${escapeQuotedKey(key)}"]`;
  return base ? `${base}${token}` : token;
};

const appendArrayPath = (base: string) => (base ? `${base}[*]` : "[*]");

const parseQuotedKey = (token: string) => {
  if (token.startsWith("\"") && token.endsWith("\"")) {
    try {
      return JSON.parse(token) as string;
    } catch {
      return token.slice(1, -1);
    }
  }
  const raw = token.slice(1, -1);
  return raw.replace(/\\\\/g, "\\").replace(/\\'/g, "'");
};

const parsePathSegments = (rawPath: string): PathSegment[] => {
  const trimmed = rawPath.trim();
  if (!trimmed) return [];
  let value = trimmed;
  if (value.startsWith("$")) {
    value = value.slice(1);
    if (value.startsWith(".")) value = value.slice(1);
  }

  const segments: PathSegment[] = [];
  let buffer = "";
  const pushBuffer = () => {
    if (buffer) {
      segments.push({ type: "property", key: buffer });
      buffer = "";
    }
  };

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === ".") {
      pushBuffer();
      continue;
    }
    if (char === "[") {
      pushBuffer();
      const closing = value.indexOf("]", i);
      if (closing === -1) {
        throw new Error("Missing closing bracket");
      }
      const token = value.slice(i + 1, closing).trim();
      if (!token || token === "*") {
        segments.push({ type: "wildcard" });
      } else if (/^\d+$/.test(token)) {
        segments.push({ type: "index", index: Number(token) });
      } else if (
        (token.startsWith("\"") && token.endsWith("\"")) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        segments.push({ type: "property", key: parseQuotedKey(token) });
      } else {
        throw new Error("Invalid bracket token");
      }
      i = closing;
      continue;
    }
    buffer += char;
  }
  pushBuffer();
  return segments;
};

const detectPaths = (value: JsonValue) => {
  const paths = new Set<string>();
  let nodeCount = 0;
  let truncated = false;
  let reason: DetectSummary["reason"] = null;

  const addPath = (path: string) => {
    if (truncated) return;
    const normalized = path || "$";
    if (paths.has(normalized)) return;
    if (paths.size >= DETECT_PATH_LIMIT) {
      truncated = true;
      reason = "paths";
      return;
    }
    paths.add(normalized);
  };

  const walk = (node: JsonValue, current: string) => {
    if (truncated) return;
    nodeCount += 1;
    if (nodeCount > DETECT_NODE_LIMIT) {
      truncated = true;
      reason = "nodes";
      return;
    }

    if (Array.isArray(node)) {
      const arrayPath = appendArrayPath(current);
      if (node.length === 0) {
        addPath(arrayPath);
        return;
      }
      let sawPrimitive = false;
      for (const item of node) {
        if (item === null || typeof item !== "object") {
          sawPrimitive = true;
          continue;
        }
        walk(item as JsonValue, arrayPath);
        if (truncated) return;
      }
      if (sawPrimitive) addPath(arrayPath);
      return;
    }

    if (isObject(node)) {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        addPath(current);
        return;
      }
      for (const [key, child] of entries) {
        walk(child as JsonValue, appendPropertyPath(current, key));
        if (truncated) return;
      }
      return;
    }

    addPath(current);
  };

  walk(value, "");
  return { paths: Array.from(paths).sort(), truncated, reason };
};

const resolvePath = (value: JsonValue, segments: PathSegment[]): JsonValue[] => {
  let current: JsonValue[] = [value];
  for (const segment of segments) {
    const next: JsonValue[] = [];
    for (const entry of current) {
      if (segment.type === "property") {
        if (isObject(entry) && Object.prototype.hasOwnProperty.call(entry, segment.key)) {
          next.push(entry[segment.key]);
        }
        continue;
      }
      if (segment.type === "index") {
        if (Array.isArray(entry)) {
          const candidate = entry[segment.index];
          if (candidate !== undefined) next.push(candidate as JsonValue);
        }
        continue;
      }
      if (Array.isArray(entry)) {
        next.push(...(entry as JsonValue[]));
      } else if (isObject(entry)) {
        next.push(...(Object.values(entry) as JsonValue[]));
      }
    }
    current = next;
    if (current.length === 0) break;
  }
  return current;
};

const toText = (value: JsonValue) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  return JSON.stringify(value);
};

const buildDefaultOutput = (items: ExtractionItem[]) =>
  items.flatMap((item) => item.values.map((value) => toText(value))).join("\n");

const normalizeScriptResult = (result: unknown) => {
  if (result === null || result === undefined) return "";
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
};

const parsePathList = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"));

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `script-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeScripts = (value: unknown, fallbackName: string): SavedScript[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const nameRaw = typeof record.name === "string" ? record.name.trim() : "";
      const name = nameRaw || fallbackName;
      const code = typeof record.code === "string" ? record.code : "";
      const id = typeof record.id === "string" && record.id.trim() ? record.id : createId();
      const createdAt =
        typeof record.createdAt === "number" ? record.createdAt : Date.now();
      const updatedAt =
        typeof record.updatedAt === "number" ? record.updatedAt : createdAt;
      return { id, name, code, createdAt, updatedAt } as SavedScript;
    })
    .filter((entry): entry is SavedScript => Boolean(entry));
};

const readStoredScripts = (fallbackName: string): SavedScript[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCRIPT_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const normalized = normalizeScripts(parsed, fallbackName);
      if (normalized.length) return normalized;
    }
    const legacy = window.localStorage.getItem(LEGACY_SCRIPT_STORAGE_KEY);
    if (legacy && legacy.trim()) {
      const now = Date.now();
      const migrated: SavedScript = {
        id: createId(),
        name: fallbackName,
        code: legacy,
        createdAt: now,
        updatedAt: now,
      };
      window.localStorage.setItem(
        SCRIPT_LIST_STORAGE_KEY,
        JSON.stringify([migrated])
      );
      window.localStorage.removeItem(LEGACY_SCRIPT_STORAGE_KEY);
      window.localStorage.setItem(SCRIPT_ACTIVE_STORAGE_KEY, migrated.id);
      return [migrated];
    }
  } catch {
    return [];
  }
  return [];
};

const readStoredActiveScriptId = () => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SCRIPT_ACTIVE_STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    return null;
  }
};

export default function JsonFieldExtractorTool() {
  const t = useTranslations("tools.json-field-extractor.ui");
  const sampleJson = useMemo(() => {
    const value = t("sample.json");
    if (value === "tools.json-field-extractor.ui.sample.json") {
      return DEFAULT_SAMPLE_JSON;
    }
    return value;
  }, [t]);
  const samplePaths = useMemo(() => {
    const value = t("sample.paths");
    if (value === "tools.json-field-extractor.ui.sample.paths") {
      return DEFAULT_SAMPLE_PATHS;
    }
    return value;
  }, [t]);
  const sampleScript = useMemo(() => {
    const value = t("sample.script");
    if (value === "tools.json-field-extractor.ui.sample.script") {
      return DEFAULT_SAMPLE_SCRIPT;
    }
    return value;
  }, [t]);
  const defaultScriptName = t("defaults.scriptName");
  const initialScripts = useMemo(
    () => readStoredScripts(defaultScriptName),
    [defaultScriptName]
  );
  const initialActiveId = useMemo(() => readStoredActiveScriptId(), []);
  const initialActiveScript = useMemo(() => {
    if (!initialScripts.length) return null;
    if (initialActiveId) {
      return (
        initialScripts.find((script) => script.id === initialActiveId) ?? null
      );
    }
    return initialScripts[0] ?? null;
  }, [initialActiveId, initialScripts]);

  const initialDetection = useMemo(() => {
    try {
      const parsed = JSON.parse(sampleJson) as JsonValue;
      return detectPaths(parsed);
    } catch {
      return { paths: [], truncated: false, reason: null };
    }
  }, [sampleJson]);

  const [input, setInput] = useState(sampleJson);
  const [manualPathsInput, setManualPathsInput] = useState("");
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>(() => initialScripts);
  const [activeScriptId, setActiveScriptId] = useState<string | null>(
    () => initialActiveScript?.id ?? null
  );
  const [scriptName, setScriptName] = useState(
    () => initialActiveScript?.name ?? ""
  );
  const [scriptInput, setScriptInput] = useState(
    () => initialActiveScript?.code ?? sampleScript
  );
  const [useScript, setUseScript] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [scriptNotice, setScriptNotice] = useState<ScriptNotice | null>(null);
  const [isScriptManagerOpen, setIsScriptManagerOpen] = useState(false);
  const [detectedPaths, setDetectedPaths] = useState<string[]>(
    () => initialDetection.paths
  );
  const [detectSummary, setDetectSummary] = useState<DetectSummary | null>(() =>
    initialDetection.paths.length
      ? {
          count: initialDetection.paths.length,
          truncated: initialDetection.truncated,
          reason: initialDetection.reason,
        }
      : null
  );
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { copied, copy, reset } = useClipboard({
    onError: () => setError(t("errors.clipboard")),
  });

  const status = useMemo(() => {
    if (error) return error;
    if (copied) return t("status.copied");
    if (!summary) return t("status.ready");
    if (summary.usedScript) {
      if (summary.missing > 0) {
        return t("status.scriptedMissing", {
          count: summary.total,
          missing: summary.missing,
        });
      }
      return t("status.scripted", { count: summary.total });
    }
    if (summary.missing > 0) {
      return t("status.extractedMissing", {
        count: summary.total,
        missing: summary.missing,
      });
    }
    return t("status.extracted", { count: summary.total });
  }, [copied, error, summary, t]);

  const filteredPaths = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return detectedPaths;
    return detectedPaths.filter((path) => path.toLowerCase().includes(query));
  }, [detectedPaths, searchQuery]);

  const detectedLabel = useMemo(() => {
    if (!detectSummary) return t("status.noDetected");
    if (detectSummary.truncated) {
      return t("status.detectedTruncated", { count: detectSummary.count });
    }
    return t("status.detected", { count: detectSummary.count });
  }, [detectSummary, t]);

  const selectedCount = selectedPaths.size;
  const selectedLabel = useMemo(
    () => t("status.selected", { count: selectedCount }),
    [selectedCount, t]
  );

  const resetStatus = () => {
    setError(null);
    setSummary(null);
    setScriptNotice(null);
    reset();
  };

  const activeScript = useMemo(
    () => savedScripts.find((script) => script.id === activeScriptId) ?? null,
    [activeScriptId, savedScripts]
  );

  const persistScripts = (nextScripts: SavedScript[], nextActiveId: string | null) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCRIPT_LIST_STORAGE_KEY, JSON.stringify(nextScripts));
    if (nextActiveId) {
      window.localStorage.setItem(SCRIPT_ACTIVE_STORAGE_KEY, nextActiveId);
    } else {
      window.localStorage.removeItem(SCRIPT_ACTIVE_STORAGE_KEY);
    }
  };

  const ensureScriptPayload = () => {
    const trimmedName = scriptName.trim();
    if (!trimmedName) {
      setScriptNotice({ message: t("errors.scriptNameRequired"), tone: "error" });
      return null;
    }
    const trimmedScript = scriptInput.trim();
    if (!trimmedScript) {
      setScriptNotice({ message: t("errors.scriptEmpty"), tone: "error" });
      return null;
    }
    return { name: trimmedName, code: scriptInput };
  };

  const saveScriptEntry = (mode: "update" | "new") => {
    const payload = ensureScriptPayload();
    if (!payload) return;

    const now = Date.now();
    if (mode === "update" && activeScriptId && activeScript) {
      const nextScripts = savedScripts.map((script) =>
        script.id === activeScriptId
          ? {
              ...script,
              name: payload.name,
              code: payload.code,
              updatedAt: now,
            }
          : script
      );
      setSavedScripts(nextScripts);
      setScriptName(payload.name);
      setScriptNotice({
        message: t("status.scriptUpdated", { name: payload.name }),
        tone: "normal",
      });
      try {
        persistScripts(nextScripts, activeScriptId);
      } catch {
        setScriptNotice({ message: t("errors.storage"), tone: "error" });
      }
      return;
    }

    const entry: SavedScript = {
      id: createId(),
      name: payload.name,
      code: payload.code,
      createdAt: now,
      updatedAt: now,
    };
    const nextScripts = [entry, ...savedScripts];
    setSavedScripts(nextScripts);
    setActiveScriptId(entry.id);
    setScriptName(entry.name);
    setScriptNotice({
      message: t("status.scriptSaved", { name: entry.name }),
      tone: "normal",
    });
    try {
      persistScripts(nextScripts, entry.id);
    } catch {
      setScriptNotice({ message: t("errors.storage"), tone: "error" });
    }
  };

  const deleteScript = () => {
    if (!activeScriptId) return;
    const target = savedScripts.find((script) => script.id === activeScriptId);
    const nextScripts = savedScripts.filter((script) => script.id !== activeScriptId);
    setSavedScripts(nextScripts);
    setActiveScriptId(null);
    setScriptNotice({
      message: t("status.scriptDeleted", { name: target?.name ?? "" }),
      tone: "normal",
    });
    try {
      persistScripts(nextScripts, null);
    } catch {
      setScriptNotice({ message: t("errors.storage"), tone: "error" });
    }
  };

  const loadScript = (scriptId: string) => {
    const target = savedScripts.find((script) => script.id === scriptId);
    if (!target) {
      setScriptNotice({ message: t("errors.scriptMissing"), tone: "error" });
      return;
    }
    setActiveScriptId(target.id);
    setScriptName(target.name);
    setScriptInput(target.code);
    setScriptNotice({
      message: t("status.scriptLoaded", { name: target.name }),
      tone: "normal",
    });
    try {
      persistScripts(savedScripts, target.id);
    } catch {
      setScriptNotice({ message: t("errors.storage"), tone: "error" });
    }
  };

  const handleDetect = () => {
    resetStatus();
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(input) as JsonValue;
    } catch {
      setError(t("errors.invalidJson"));
      setOutput("");
      return;
    }

    const result = detectPaths(parsed);
    setDetectedPaths(result.paths);
    setDetectSummary({
      count: result.paths.length,
      truncated: result.truncated,
      reason: result.reason,
    });
    setSelectedPaths((prev) => {
      if (prev.size === 0) return new Set();
      const next = new Set(
        result.paths.filter((path) => prev.has(path))
      );
      return next;
    });
  };

  const toggleSelection = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    resetStatus();
  };

  const selectAll = () => {
    const scope = searchQuery.trim() ? filteredPaths : detectedPaths;
    if (scope.length === 0) return;
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      scope.forEach((path) => next.add(path));
      return next;
    });
    resetStatus();
  };

  const clearSelection = () => {
    if (selectedPaths.size === 0) return;
    setSelectedPaths(new Set());
    resetStatus();
  };

  const handleExtract = () => {
    resetStatus();

    let parsed: JsonValue;
    try {
      parsed = JSON.parse(input) as JsonValue;
    } catch {
      setError(t("errors.invalidJson"));
      setOutput("");
      return;
    }

    const selectedList = detectedPaths.filter((path) => selectedPaths.has(path));
    const manualPaths = parsePathList(manualPathsInput);
    const combinedPaths = [...selectedList, ...manualPaths];
    const paths = Array.from(new Set(combinedPaths));
    if (paths.length === 0) {
      setError(t("errors.noPaths"));
      setOutput("");
      return;
    }

    const items: ExtractionItem[] = [];
    for (const path of paths) {
      let segments: PathSegment[];
      try {
        segments = parsePathSegments(path);
      } catch (err) {
        const detail = err instanceof Error ? ` (${err.message})` : "";
        setError(t("errors.invalidPath", { path: `${path}${detail}` }));
        setOutput("");
        return;
      }
      const values = resolvePath(parsed, segments);
      items.push({ path, values });
    }

    const total = items.reduce((count, item) => count + item.values.length, 0);
    const missing = items.filter((item) => item.values.length === 0).length;
    const baseOutput = buildDefaultOutput(items);

    let usedScript = false;
    let nextOutput = baseOutput;

    if (useScript && scriptInput.trim()) {
      try {
        const helpers = {
          toText,
          join: (values: JsonValue[], separator = "\n") =>
            values.map((value) => toText(value)).join(separator),
          flatten: (values: ExtractionItem[]) =>
            values.flatMap((item) => item.values),
        };
        const runner = new Function(
          "items",
          "raw",
          "helpers",
          `"use strict";\n${scriptInput}`
        );
        const result = runner(items, parsed, helpers);
        nextOutput = normalizeScriptResult(result);
        usedScript = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(t("errors.scriptFailed", { message }));
      }
    }

    setOutput(nextOutput);
    setSummary({ total, missing, usedScript });
  };

  const copyOutput = async () => {
    if (!output) return;
    await copy(output);
  };

  const applySample = () => {
    setInput(sampleJson);
    setManualPathsInput(samplePaths);
    setScriptInput(sampleScript);
    setScriptName("");
    setActiveScriptId(null);
    setUseScript(false);
    setOutput("");
    setSummary(null);
    setError(null);
    setScriptNotice(null);
    setSearchQuery("");
    reset();

    try {
      const parsed = JSON.parse(sampleJson) as JsonValue;
      const result = detectPaths(parsed);
      setDetectedPaths(result.paths);
      setDetectSummary({
        count: result.paths.length,
        truncated: result.truncated,
        reason: result.reason,
      });
      setSelectedPaths(new Set());
    } catch {
      setDetectedPaths([]);
      setDetectSummary(null);
      setSelectedPaths(new Set());
    }
  };

  const clearAll = () => {
    setInput("");
    setManualPathsInput("");
    setScriptInput("");
    setScriptName("");
    setActiveScriptId(null);
    setUseScript(false);
    setOutput("");
    setSummary(null);
    setError(null);
    setScriptNotice(null);
    setDetectedPaths([]);
    setDetectSummary(null);
    setSelectedPaths(new Set());
    setSearchQuery("");
    reset();
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={handleExtract}>{t("actions.extract")}</PrimaryButton>
          <SecondaryButton onClick={copyOutput} disabled={!output}>
            {t("actions.copy")}
          </SecondaryButton>
          <GhostButton onClick={applySample}>{t("actions.sample")}</GhostButton>
          <GhostButton onClick={clearAll}>{t("actions.clear")}</GhostButton>
        </div>
      </div>

      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          error ? "text-rose-500/80" : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {status}
      </p>

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ToolPanel title={t("labels.input")} className="min-h-[280px]">
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              resetStatus();
            }}
            placeholder={t("placeholders.input")}
            spellCheck={false}
            className="mt-3 min-h-[220px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </ToolPanel>

        <div className="flex flex-col gap-4">
          <ToolPanel
            title={t("labels.paths")}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton size="sm" onClick={handleDetect}>
                  {t("actions.detect")}
                </SecondaryButton>
                <SecondaryButton
                  size="sm"
                  onClick={selectAll}
                  disabled={detectedPaths.length === 0}
                >
                  {searchQuery.trim()
                    ? t("actions.selectFiltered")
                    : t("actions.selectAll")}
                </SecondaryButton>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedCount === 0}
                >
                  {t("actions.clearSelection")}
                </Button>
              </div>
            }
            headerClassName="flex flex-wrap items-center justify-between gap-2"
            actionsClassName="flex flex-wrap items-center gap-2"
          >
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("placeholders.search")}
              spellCheck={false}
              className="mt-3 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
              <span>{detectedLabel}</span>
              <span>{selectedLabel}</span>
            </div>
            <div className="mt-3 max-h-[220px] overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-2">
              {filteredPaths.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[color:var(--text-secondary)]">
                  {searchQuery.trim()
                    ? t("emptyState.noMatches")
                    : t("emptyState.noPaths")}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredPaths.map((path) => (
                    <label
                      key={path}
                      className="flex items-start gap-2 rounded-[10px] px-2 py-1 text-xs text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPaths.has(path)}
                        onChange={() => toggleSelection(path)}
                        className="mt-0.5 h-4 w-4 accent-[color:var(--accent-blue)]"
                      />
                      <span className="font-mono leading-relaxed">{path}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                {t("labels.manual")}
              </p>
              <textarea
                value={manualPathsInput}
                onChange={(event) => {
                  setManualPathsInput(event.target.value);
                  resetStatus();
                }}
                placeholder={t("placeholders.manual")}
                spellCheck={false}
                className="mt-2 min-h-[110px] w-full resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm font-mono leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
              />
            </div>
            <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
              {t("hints.paths")}
            </p>
          </ToolPanel>

          <ToolPanel
            title={t("labels.script")}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={useScript}
                    onChange={(event) => setUseScript(event.target.checked)}
                    className="h-4 w-4 accent-[color:var(--accent-blue)]"
                  />
                  <span>{t("toggles.script")}</span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsScriptManagerOpen(true)}
                >
                  {t("actions.manageScripts")}
                </Button>
              </div>
            }
            headerClassName="flex flex-wrap items-center justify-between gap-2"
            actionsClassName="flex flex-wrap items-center gap-2"
          >
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
              <span>
                {activeScript
                  ? t("status.activeScript", { name: activeScript.name })
                  : t("status.noActiveScript")}
              </span>
              <span>{t("status.savedCount", { count: savedScripts.length })}</span>
            </div>
            <textarea
              value={scriptInput}
              onChange={(event) => {
                setScriptInput(event.target.value);
                resetStatus();
              }}
              placeholder={t("placeholders.script")}
              spellCheck={false}
              className="mt-3 min-h-[140px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm font-mono leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
            <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
              {t("hints.script")}
            </p>
            {scriptNotice ? (
              <p
                className={cn(
                  "mt-1 text-xs",
                  scriptNotice.tone === "error"
                    ? "text-rose-500/80"
                    : "text-[color:var(--text-secondary)]"
                )}
              >
                {scriptNotice.message}
              </p>
            ) : null}
          </ToolPanel>
        </div>
      </div>

      <ToolPanel title={t("labels.output")} className="min-h-[240px]">
        <textarea
          value={output}
          readOnly
          spellCheck={false}
          placeholder={t("placeholders.output")}
          className="mt-3 min-h-[200px] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
        />
      </ToolPanel>

      <Modal
        open={isScriptManagerOpen}
        onClose={() => setIsScriptManagerOpen(false)}
        title={t("labels.manageScripts")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsScriptManagerOpen(false)}
          >
            {t("actions.close")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
              {t("labels.scriptName")}
            </p>
            <input
              value={scriptName}
              onChange={(event) => {
                setScriptName(event.target.value);
                resetStatus();
              }}
              placeholder={t("placeholders.scriptName")}
              spellCheck={false}
              className="mt-2 w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveScriptEntry("update")}
            >
              {t("actions.saveScript")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => saveScriptEntry("new")}
            >
              {t("actions.saveAsNew")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteScript}
              disabled={!activeScriptId}
            >
              {t("actions.deleteScript")}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
            <span>{t("labels.savedScripts")}</span>
            <span>{t("status.savedCount", { count: savedScripts.length })}</span>
          </div>
          <div className="max-h-[220px] overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-2">
            {savedScripts.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[color:var(--text-secondary)]">
                {t("emptyState.noScripts")}
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {savedScripts.map((script) => {
                  const isActive = script.id === activeScriptId;
                  return (
                    <button
                      key={script.id}
                      type="button"
                      onClick={() => loadScript(script.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-[10px] px-2 py-1 text-xs text-[color:var(--text-primary)] transition-colors",
                        isActive
                          ? "bg-[color:var(--glass-hover-bg)]"
                          : "hover:bg-[color:var(--glass-hover-bg)]"
                      )}
                    >
                      <span className="truncate font-medium">{script.name}</span>
                      {isActive ? (
                        <span className="text-[color:var(--text-secondary)]">
                          {t("status.active")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
