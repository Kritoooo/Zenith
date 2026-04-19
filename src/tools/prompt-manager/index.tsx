"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";

import {
  DangerButton,
  GhostButton,
  PrimaryButton,
  SecondaryButton,
} from "@/components/Button";
import { StatusLine } from "@/components/StatusLine";
import { ToolInput } from "@/components/ToolInput";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";
import { PinIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";
import { createId } from "@/lib/createId";
import { resolveRawTranslationFallback } from "@/lib/i18n";
import { useClipboard } from "@/lib/useClipboard";

type PromptItem = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type PromptSnapshot = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  savedAt: number;
};

type PromptHistoryMap = Record<string, PromptSnapshot[]>;

type StatusNotice = {
  tone: "normal" | "error";
  text: string;
};

const PROMPT_LIST_STORAGE_KEY = "zenith.prompt-manager.items";
const ACTIVE_PROMPT_STORAGE_KEY = "zenith.prompt-manager.active";
const PROMPT_HISTORY_STORAGE_KEY = "zenith.prompt-manager.histories";
const SAVE_DELAY_MS = 220;
const SNAPSHOT_DEBOUNCE_MS = 1200;
const MAX_HISTORY_PER_PROMPT = 30;
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g;
const DEFAULT_SAMPLE_PROMPT = `You are a senior product analyst.

Context:
- Product: {{product_name}}
- Audience: {{audience}}
- Goal: {{goal}}

Please provide:
1) A concise summary.
2) 3 actionable recommendations.
3) Potential risks and mitigations.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const normalizeTagList = (value: string[] | null | undefined): string[] => {
  if (!value) return [];
  const unique = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
};

const parseTagInput = (value: string): string[] => {
  const raw = value.split(/[\n,，]/g);
  return normalizeTagList(raw);
};

const createPromptItem = (title: string, content: string): PromptItem => {
  const now = Date.now();
  return {
    id: createId("prompt"),
    title,
    content,
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
};

const normalizePromptItem = (
  value: unknown,
  fallbackTitle: string
): PromptItem | null => {
  if (!isRecord(value)) return null;

  const now = Date.now();
  const titleRaw = typeof value.title === "string" ? value.title.trim() : "";
  const title = titleRaw || fallbackTitle;
  const content = typeof value.content === "string" ? value.content : "";
  const tags = Array.isArray(value.tags)
    ? normalizeTagList(value.tags as string[])
    : [];
  const pinned = Boolean(value.pinned);
  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id
      : createId("prompt");
  const createdAt =
    typeof value.createdAt === "number" ? value.createdAt : now;
  const updatedAt =
    typeof value.updatedAt === "number" ? value.updatedAt : createdAt;

  return {
    id,
    title,
    content,
    tags,
    pinned,
    createdAt,
    updatedAt,
  };
};

const normalizePromptSnapshot = (
  value: unknown,
  fallbackTitle: string
): PromptSnapshot | null => {
  if (!isRecord(value)) return null;

  const titleRaw = typeof value.title === "string" ? value.title.trim() : "";
  const title = titleRaw || fallbackTitle;
  const content = typeof value.content === "string" ? value.content : "";
  const tags = Array.isArray(value.tags)
    ? normalizeTagList(value.tags as string[])
    : [];
  const savedAt = typeof value.savedAt === "number" ? value.savedAt : Date.now();

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : createId("prompt-history"),
    title,
    content,
    tags,
    savedAt,
  };
};

const normalizePromptList = (
  value: unknown,
  fallbackTitle: string
): PromptItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizePromptItem(item, fallbackTitle))
    .filter((item): item is PromptItem => Boolean(item));
};

const normalizePromptHistoryMap = (
  value: unknown,
  fallbackTitle: string
): PromptHistoryMap => {
  if (!isRecord(value)) return {};

  const normalized: PromptHistoryMap = {};
  for (const [promptId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) continue;
    const list = entries
      .map((entry) => normalizePromptSnapshot(entry, fallbackTitle))
      .filter((entry): entry is PromptSnapshot => Boolean(entry))
      .slice(0, MAX_HISTORY_PER_PROMPT);
    if (list.length > 0) {
      normalized[promptId] = list;
    }
  }
  return normalized;
};

const parseImportedPrompts = (
  value: unknown,
  fallbackTitle: string
): PromptItem[] => {
  if (Array.isArray(value)) {
    return normalizePromptList(value, fallbackTitle);
  }
  if (isRecord(value) && Array.isArray(value.prompts)) {
    return normalizePromptList(value.prompts, fallbackTitle);
  }
  return [];
};

const readPromptList = (fallbackTitle: string): PromptItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROMPT_LIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return normalizePromptList(parsed, fallbackTitle);
  } catch {
    return [];
  }
};

const readActivePromptId = () => {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_PROMPT_STORAGE_KEY);
    if (!value || !value.trim()) return null;
    return value;
  } catch {
    return null;
  }
};

const readPromptHistoryMap = (fallbackTitle: string): PromptHistoryMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return normalizePromptHistoryMap(parsed, fallbackTitle);
  } catch {
    return {};
  }
};

const persistPromptState = (
  promptItems: PromptItem[],
  activePromptId: string | null,
  historyMap: PromptHistoryMap
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROMPT_LIST_STORAGE_KEY, JSON.stringify(promptItems));
  if (activePromptId) {
    window.localStorage.setItem(ACTIVE_PROMPT_STORAGE_KEY, activePromptId);
  } else {
    window.localStorage.removeItem(ACTIVE_PROMPT_STORAGE_KEY);
  }
  window.localStorage.setItem(PROMPT_HISTORY_STORAGE_KEY, JSON.stringify(historyMap));
};

const extractVariables = (content: string): string[] => {
  if (!content) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  const matcher = new RegExp(VARIABLE_PATTERN.source, "g");
  let matched = matcher.exec(content);
  while (matched) {
    const variable = matched[1];
    if (variable && !seen.has(variable)) {
      seen.add(variable);
      names.push(variable);
    }
    matched = matcher.exec(content);
  }
  return names;
};

const replaceVariables = (content: string, values: Record<string, string>) => {
  if (!content) return "";
  const matcher = new RegExp(VARIABLE_PATTERN.source, "g");
  return content.replace(matcher, (_, name: string) => {
    const value = values[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    return `{{${name}}}`;
  });
};

const summarizeContent = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "-";
  return trimmed.replace(/\s+/g, " ").slice(0, 96);
};

const hasSamePromptBody = (left: PromptSnapshot, right: PromptItem) =>
  left.title === right.title &&
  left.content === right.content &&
  left.tags.length === right.tags.length &&
  left.tags.every((tag, index) => tag === right.tags[index]);

const addSnapshotForPrompt = (
  historyMap: PromptHistoryMap,
  prompt: PromptItem
): PromptHistoryMap => {
  const current = historyMap[prompt.id] ?? [];
  const latest = current[0];
  if (latest && hasSamePromptBody(latest, prompt)) {
    return historyMap;
  }
  const snapshot: PromptSnapshot = {
    id: createId("prompt-history"),
    title: prompt.title,
    content: prompt.content,
    tags: [...prompt.tags],
    savedAt: Date.now(),
  };
  return {
    ...historyMap,
    [prompt.id]: [snapshot, ...current].slice(0, MAX_HISTORY_PER_PROMPT),
  };
};

export default function PromptManagerTool() {
  const t = useTranslations("tools.prompt-manager.ui");
  const defaultTitle = t("defaults.promptTitle");
  const defaultNewTitle = t("defaults.newPromptTitle");
  const samplePrompt = useMemo(
    () =>
      resolveRawTranslationFallback(
        t,
        "sample.prompt",
        DEFAULT_SAMPLE_PROMPT,
        "tools.prompt-manager.ui.sample.prompt"
      ),
    [t]
  );

  const initialPrompt = useMemo(
    () => createPromptItem(defaultTitle, samplePrompt),
    [defaultTitle, samplePrompt]
  );

  const [promptItems, setPromptItems] = useState<PromptItem[]>(() => [initialPrompt]);
  const [activePromptId, setActivePromptId] = useState<string | null>(() => initialPrompt.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [tagInput, setTagInput] = useState("");
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [saveState, setSaveState] = useState<"ready" | "unsaved" | "saving" | "saved">(
    "ready"
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [historyMap, setHistoryMap] = useState<PromptHistoryMap>({});
  const importRef = useRef<HTMLInputElement>(null);
  const snapshotTimerRef = useRef<Map<string, number>>(new Map());
  const lastChangedPromptIdRef = useRef<string | null>(null);
  const previousSaveStateRef = useRef<"ready" | "unsaved" | "saving" | "saved">("ready");

  const activePrompt = useMemo(
    () => promptItems.find((item) => item.id === activePromptId) ?? null,
    [activePromptId, promptItems]
  );

  const sortedPromptItems = useMemo(() => {
    const pinned = promptItems
      .filter((item) => item.pinned)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const normal = promptItems
      .filter((item) => !item.pinned)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return [...pinned, ...normal];
  }, [promptItems]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of promptItems) {
      for (const tag of item.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((left, right) => left.localeCompare(right));
  }, [promptItems]);

  const filteredPrompts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return sortedPromptItems.filter((item) => {
      if (activeTag !== "all" && !item.tags.includes(activeTag)) {
        return false;
      }
      if (!normalizedQuery) return true;
      const searchSpace = `${item.title} ${item.content} ${item.tags.join(" ")}`.toLowerCase();
      return searchSpace.includes(normalizedQuery);
    });
  }, [activeTag, searchQuery, sortedPromptItems]);

  const detectedVariables = useMemo(
    () => extractVariables(activePrompt?.content ?? ""),
    [activePrompt?.content]
  );

  const activeHistory = useMemo(
    () => (activePromptId ? historyMap[activePromptId] ?? [] : []),
    [activePromptId, historyMap]
  );

  const clearSnapshotTimer = useCallback((promptId: string) => {
    const timerId = snapshotTimerRef.current.get(promptId);
    if (typeof timerId === "undefined") return;
    window.clearTimeout(timerId);
    snapshotTimerRef.current.delete(promptId);
  }, []);

  const clearAllSnapshotTimers = useCallback(() => {
    for (const timerId of snapshotTimerRef.current.values()) {
      window.clearTimeout(timerId);
    }
    snapshotTimerRef.current.clear();
  }, []);

  const queueSnapshotForPrompt = useCallback(
    (prompt: PromptItem) => {
      clearSnapshotTimer(prompt.id);
      const timerId = window.setTimeout(() => {
        setHistoryMap((previous) => addSnapshotForPrompt(previous, prompt));
        snapshotTimerRef.current.delete(prompt.id);
      }, SNAPSHOT_DEBOUNCE_MS);
      snapshotTimerRef.current.set(prompt.id, timerId);
    },
    [clearSnapshotTimer]
  );

  useEffect(() => {
    setVariableValues({});
  }, [activePromptId]);

  useEffect(() => {
    setVariableValues((previous) => {
      const next: Record<string, string> = {};
      for (const variable of detectedVariables) {
        next[variable] = previous[variable] ?? "";
      }
      const unchanged =
        Object.keys(previous).length === Object.keys(next).length &&
        Object.entries(next).every(([key, value]) => previous[key] === value);
      return unchanged ? previous : next;
    });
  }, [detectedVariables]);

  useEffect(() => {
    const storedPrompts = readPromptList(defaultTitle);
    const storedHistories = readPromptHistoryMap(defaultTitle);
    if (storedPrompts.length > 0) {
      setPromptItems(storedPrompts);
      const storedActivePromptId = readActivePromptId();
      const resolvedActivePromptId =
        storedActivePromptId && storedPrompts.some((item) => item.id === storedActivePromptId)
          ? storedActivePromptId
          : storedPrompts[0].id;
      setActivePromptId(resolvedActivePromptId);
    }
    setHistoryMap(storedHistories);
    setHasLoaded(true);
  }, [defaultTitle]);

  useEffect(() => {
    if (!activePrompt && promptItems.length > 0) {
      setActivePromptId(promptItems[0].id);
      return;
    }
    if (!activePrompt && promptItems.length === 0) {
      setActivePromptId(null);
    }
  }, [activePrompt, promptItems]);

  useEffect(() => {
    if (!activePrompt) {
      setTagInput("");
      return;
    }
    setTagInput(activePrompt.tags.join(", "));
  }, [activePrompt]);

  useEffect(() => {
    if (activeTag !== "all" && !allTags.includes(activeTag)) {
      setActiveTag("all");
    }
  }, [activeTag, allTags]);

  useEffect(() => {
    if (!hasLoaded) return;
    setSaveState("saving");

    const timerId = window.setTimeout(() => {
      try {
        persistPromptState(promptItems, activePromptId, historyMap);
        setSaveState("saved");
      } catch {
        setSaveState("ready");
        setStatusNotice({ tone: "error", text: t("errors.storage") });
      }
    }, SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activePromptId, hasLoaded, historyMap, promptItems, t]);

  useEffect(() => {
    const previousSaveState = previousSaveStateRef.current;
    if (saveState === "saved" && previousSaveState !== "saved") {
      const promptId = lastChangedPromptIdRef.current;
      if (promptId) {
        const promptToSnapshot = promptItems.find((item) => item.id === promptId);
        if (promptToSnapshot) {
          queueSnapshotForPrompt(promptToSnapshot);
        }
      }
    }
    previousSaveStateRef.current = saveState;
  }, [promptItems, queueSnapshotForPrompt, saveState]);

  useEffect(() => () => {
    clearAllSnapshotTimers();
  }, [clearAllSnapshotTimers]);

  const { copied, copy, reset } = useClipboard<"prompt" | "preview">({
    onError: () => setStatusNotice({ tone: "error", text: t("errors.clipboard") }),
  });

  const renderedPrompt = useMemo(
    () => replaceVariables(activePrompt?.content ?? "", variableValues),
    [activePrompt?.content, variableValues]
  );

  const status = useMemo<StatusNotice>(() => {
    if (statusNotice) return statusNotice;
    if (copied === "prompt") return { tone: "normal", text: t("status.promptCopied") };
    if (copied === "preview") return { tone: "normal", text: t("status.previewCopied") };
    if (saveState === "unsaved") return { tone: "normal", text: t("status.unsaved") };
    if (saveState === "saving") return { tone: "normal", text: t("status.saving") };
    if (saveState === "saved") return { tone: "normal", text: t("status.saved") };
    return { tone: "normal", text: t("status.ready") };
  }, [copied, saveState, statusNotice, t]);

  const clearTransientStatus = useCallback(() => {
    if (statusNotice) {
      setStatusNotice(null);
    }
    if (copied) {
      reset();
    }
  }, [copied, reset, statusNotice]);

  const patchPromptItem = useCallback(
    (promptId: string, updater: (current: PromptItem) => PromptItem) => {
      lastChangedPromptIdRef.current = promptId;
      setPromptItems((previous) =>
        previous.map((item) => {
          if (item.id !== promptId) return item;
          return updater(item);
        })
      );
      setSaveState("unsaved");
      clearTransientStatus();
    },
    [clearTransientStatus]
  );

  const createPrompt = () => {
    lastChangedPromptIdRef.current = null;
    const created = createPromptItem(defaultNewTitle, "");
    setPromptItems((previous) => [created, ...previous]);
    setActivePromptId(created.id);
    setSearchQuery("");
    setActiveTag("all");
    setSaveState("unsaved");
    setStatusNotice({ tone: "normal", text: t("status.created") });
  };

  const duplicatePrompt = () => {
    if (!activePrompt) return;
    lastChangedPromptIdRef.current = null;
    const now = Date.now();
    const duplicated: PromptItem = {
      ...activePrompt,
      id: createId("prompt"),
      title: t("defaults.duplicateTitle", { title: activePrompt.title }),
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setPromptItems((previous) => [duplicated, ...previous]);
    setActivePromptId(duplicated.id);
    setSaveState("unsaved");
    setStatusNotice({ tone: "normal", text: t("status.duplicated") });
  };

  const togglePinPrompt = (promptId: string) => {
    const target = promptItems.find((item) => item.id === promptId);
    if (!target) return;
    patchPromptItem(promptId, (current) => ({
      ...current,
      pinned: !current.pinned,
      updatedAt: Date.now(),
    }));
    setStatusNotice({
      tone: "normal",
      text: target.pinned ? t("status.unpinned") : t("status.pinned"),
    });
  };

  const deletePrompt = () => {
    if (!activePrompt) return;
    const confirmed = window.confirm(
      t("confirm.delete", { title: activePrompt.title })
    );
    if (!confirmed) return;

    clearSnapshotTimer(activePrompt.id);
    if (lastChangedPromptIdRef.current === activePrompt.id) {
      lastChangedPromptIdRef.current = null;
    }

    const currentIndex = promptItems.findIndex((item) => item.id === activePrompt.id);
    const nextItems = promptItems.filter((item) => item.id !== activePrompt.id);
    const nextActivePrompt = nextItems[currentIndex] ?? nextItems[currentIndex - 1] ?? null;

    setPromptItems(nextItems);
    setActivePromptId(nextActivePrompt?.id ?? null);
    setVariableValues({});
    setHistoryMap((previous) => {
      const next = { ...previous };
      delete next[activePrompt.id];
      return next;
    });
    setSaveState("unsaved");
    setStatusNotice({ tone: "normal", text: t("status.deleted") });
  };

  const restoreSnapshot = (snapshotId: string) => {
    if (!activePrompt) return;
    const snapshot = activeHistory.find((entry) => entry.id === snapshotId);
    if (!snapshot) return;

    patchPromptItem(activePrompt.id, (current) => ({
      ...current,
      title: snapshot.title,
      content: snapshot.content,
      tags: [...snapshot.tags],
      updatedAt: Date.now(),
    }));
    setStatusNotice({ tone: "normal", text: t("status.snapshotRestored") });
  };

  const exportPrompts = () => {
    if (promptItems.length === 0) {
      setStatusNotice({ tone: "error", text: t("errors.emptyExport") });
      return;
    }

    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      prompts: promptItems,
      histories: historyMap,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zenith-prompts-${Date.now()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setStatusNotice({
      tone: "normal",
      text: t("status.exported", { count: promptItems.length }),
    });
  };

  const triggerImport = () => {
    importRef.current?.click();
  };

  const importPrompts = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const imported = parseImportedPrompts(parsed, defaultTitle);
      if (imported.length === 0) {
        setStatusNotice({ tone: "error", text: t("errors.invalidImport") });
        return;
      }

      const importedHistories =
        isRecord(parsed) && parsed.histories
          ? normalizePromptHistoryMap(parsed.histories, defaultTitle)
          : {};

      clearAllSnapshotTimers();
      lastChangedPromptIdRef.current = null;
      setPromptItems(imported);
      setActivePromptId(imported[0].id);
      setSearchQuery("");
      setActiveTag("all");
      setVariableValues({});
      setHistoryMap(importedHistories);
      setSaveState("unsaved");
      setStatusNotice({ tone: "normal", text: t("status.imported", { count: imported.length }) });
    } catch {
      setStatusNotice({ tone: "error", text: t("errors.invalidImport") });
    } finally {
      event.target.value = "";
    }
  };

  const copyPrompt = async () => {
    if (!activePrompt?.content) return;
    await copy(activePrompt.content, "prompt");
    setStatusNotice(null);
  };

  const copyPreview = async () => {
    if (!renderedPrompt) return;
    await copy(renderedPrompt, "preview");
    setStatusNotice(null);
  };

  const clearVariables = () => {
    if (detectedVariables.length === 0) return;
    const nextValues = detectedVariables.reduce<Record<string, string>>((acc, variable) => {
      acc[variable] = "";
      return acc;
    }, {});
    setVariableValues(nextValues);
    clearTransientStatus();
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton size="sm" onClick={createPrompt}>
          {t("actions.create")}
        </PrimaryButton>
        <SecondaryButton size="sm" onClick={duplicatePrompt} disabled={!activePrompt}>
          {t("actions.duplicate")}
        </SecondaryButton>
        <DangerButton onClick={deletePrompt} disabled={!activePrompt}>
          {t("actions.delete")}
        </DangerButton>
        <SecondaryButton size="sm" onClick={triggerImport}>
          {t("actions.import")}
        </SecondaryButton>
        <SecondaryButton size="sm" onClick={exportPrompts}>
          {t("actions.export")}
        </SecondaryButton>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={importPrompts}
        />
      </div>

      <StatusLine text={status.text} tone={status.tone} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <ToolPanel
          title={t("labels.library")}
          className="min-h-0 gap-3"
          actions={
            <span className="text-xs text-[color:var(--text-secondary)]">
              {t("labels.promptCount", { count: promptItems.length })}
            </span>
          }
        >
          <ToolInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("placeholders.search")}
            className="mt-3"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTag("all")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                activeTag === "all"
                  ? "border-transparent bg-[color:var(--accent-blue)] text-white"
                  : "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]"
              )}
            >
              {t("labels.allTags")}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  activeTag === tag
                    ? "border-transparent bg-[color:var(--accent-blue)] text-white"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="mt-1 min-h-0 flex-1 overflow-auto pr-1">
            {filteredPrompts.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-[color:var(--glass-border)] p-3 text-xs text-[color:var(--text-secondary)]">
                {promptItems.length === 0
                  ? t("emptyState.noPrompts")
                  : t("emptyState.noMatches")}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredPrompts.map((item) => {
                  const active = item.id === activePromptId;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "w-full rounded-[12px] border px-3 py-2 transition-colors",
                        active
                          ? "border-transparent bg-[color:var(--glass-hover-bg)]"
                          : "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] hover:bg-[color:var(--glass-hover-bg)]"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePromptId(item.id);
                            clearTransientStatus();
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                            {summarizeContent(item.content)}
                          </p>
                          {item.tags.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <span
                                  key={`${item.id}-${tag}`}
                                  className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinPrompt(item.id)}
                          aria-label={item.pinned ? t("actions.unpin") : t("actions.pin")}
                          title={item.pinned ? t("actions.unpin") : t("actions.pin")}
                          className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                            item.pinned
                              ? "border-transparent bg-[color:var(--accent-blue)] text-white"
                              : "border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]"
                          )}
                        >
                          <PinIcon className={cn("h-3.5 w-3.5", item.pinned && "-rotate-12")} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ToolPanel>

        <ToolPanel
          title={t("labels.editor")}
          className="min-h-0 gap-3"
          actions={
            <div className="flex items-center gap-2">
              <GhostButton size="sm" onClick={copyPrompt} disabled={!activePrompt?.content}>
                {t("actions.copyPrompt")}
              </GhostButton>
            </div>
          }
        >
          {!activePrompt ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[color:var(--glass-border)] p-5 text-center text-[color:var(--text-secondary)]">
              <p className="text-sm">{t("emptyState.noActivePrompt")}</p>
              <PrimaryButton size="sm" onClick={createPrompt}>
                {t("actions.create")}
              </PrimaryButton>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {t("labels.title")}
                </p>
                <ToolInput
                  value={activePrompt.title}
                  onChange={(event) => {
                    patchPromptItem(activePrompt.id, (current) => ({
                      ...current,
                      title: event.target.value,
                      updatedAt: Date.now(),
                    }));
                  }}
                  placeholder={t("placeholders.title")}
                  className="mt-2"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {t("labels.tags")}
                </p>
                <ToolInput
                  value={tagInput}
                  onChange={(event) => {
                    const nextInput = event.target.value;
                    setTagInput(nextInput);
                    patchPromptItem(activePrompt.id, (current) => ({
                      ...current,
                      tags: parseTagInput(nextInput),
                      updatedAt: Date.now(),
                    }));
                  }}
                  placeholder={t("placeholders.tags")}
                  className="mt-2"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {t("labels.prompt")}
                </p>
                <ToolTextarea
                  value={activePrompt.content}
                  onChange={(event) => {
                    patchPromptItem(activePrompt.id, (current) => ({
                      ...current,
                      content: event.target.value,
                      updatedAt: Date.now(),
                    }));
                  }}
                  placeholder={t("placeholders.prompt")}
                  className="mt-2 min-h-[280px]"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </ToolPanel>

        <div className="grid min-h-0 gap-4 md:grid-cols-2 lg:col-span-2 xl:col-span-1 xl:grid-cols-1 xl:[grid-template-rows:auto_minmax(0,1fr)]">
          <ToolPanel
            title={t("labels.variables")}
            className="min-h-0 max-h-[220px] gap-2 overflow-auto xl:!flex-none"
            actions={
              <GhostButton
                size="sm"
                onClick={clearVariables}
                disabled={detectedVariables.length === 0}
              >
                {t("actions.clearVariables")}
              </GhostButton>
            }
          >
            {detectedVariables.length === 0 ? (
              <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
                {t("emptyState.noVariables")}
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {detectedVariables.map((variable) => (
                  <label
                    key={variable}
                    className="flex flex-col gap-1 text-xs text-[color:var(--text-secondary)]"
                  >
                    <span className="font-medium text-[color:var(--text-primary)]">{variable}</span>
                    <ToolInput
                      value={variableValues[variable] ?? ""}
                      onChange={(event) => {
                        clearTransientStatus();
                        setVariableValues((previous) => ({
                          ...previous,
                          [variable]: event.target.value,
                        }));
                      }}
                      placeholder={t("placeholders.variable")}
                    />
                  </label>
                ))}
              </div>
            )}
          </ToolPanel>

          <ToolPanel
            title={t("labels.preview")}
            className="min-h-[280px] overflow-hidden md:col-span-2 xl:col-span-1 xl:min-h-0"
            actions={
              <SecondaryButton size="sm" onClick={copyPreview} disabled={!renderedPrompt}>
                {t("actions.copyPreview")}
              </SecondaryButton>
            }
          >
            <ToolTextarea
              value={renderedPrompt}
              readOnly
              placeholder={t("placeholders.preview")}
              className="mt-3 min-h-[260px] xl:min-h-0"
            />
          </ToolPanel>
        </div>
      </div>

      <ToolPanel
        title={t("labels.history")}
        className="!flex-none min-h-[156px]"
        actions={
          <span className="text-xs text-[color:var(--text-secondary)]">
            {t("labels.historyCount", { count: activeHistory.length })}
          </span>
        }
      >
        {activeHistory.length === 0 ? (
          <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
            {t("emptyState.noHistory")}
          </p>
        ) : (
          <div className="mt-2 flex gap-2 overflow-auto pb-1 pr-1">
            {activeHistory.map((snapshot) => (
              <button
                key={snapshot.id}
                type="button"
                onClick={() => restoreSnapshot(snapshot.id)}
                className="min-w-[220px] max-w-[260px] shrink-0 rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-3 py-2 text-left transition-colors hover:bg-[color:var(--glass-hover-bg)]"
              >
                <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">
                  {snapshot.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--text-secondary)]">
                  {summarizeContent(snapshot.content)}
                </p>
                <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">
                  {new Date(snapshot.savedAt).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
  );
}
