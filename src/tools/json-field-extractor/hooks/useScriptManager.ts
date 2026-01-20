import { useMemo, useState } from "react";

import { createId } from "@/lib/createId";

import {
  LEGACY_SCRIPT_STORAGE_KEY,
  SCRIPT_ACTIVE_STORAGE_KEY,
  SCRIPT_LIST_STORAGE_KEY,
} from "../lib/constants";
import type { SavedScript, ScriptNotice } from "../lib/types";

type Translate = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

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

type UseScriptManagerOptions = {
  defaultScriptName: string;
  sampleScript: string;
  t: Translate;
};

export const useScriptManager = ({
  defaultScriptName,
  sampleScript,
  t,
}: UseScriptManagerOptions) => {
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
  const [scriptNotice, setScriptNotice] = useState<ScriptNotice | null>(null);

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

  return {
    savedScripts,
    activeScriptId,
    activeScript,
    scriptName,
    scriptInput,
    scriptNotice,
    setScriptName,
    setScriptInput,
    setScriptNotice,
    setActiveScriptId,
    saveScriptEntry,
    deleteScript,
    loadScript,
  };
};
