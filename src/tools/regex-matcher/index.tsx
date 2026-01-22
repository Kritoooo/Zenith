"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { FieldPatternEditor, type FieldPatternRow } from "@/tools/regex-matcher/components/FieldPatternEditor";
import { Button, GhostButton, SecondaryButton } from "@/components/Button";
import { StatusLine } from "@/components/StatusLine";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";
import { cn } from "@/lib/cn";
import {
  createFieldId,
  parseFieldPatterns,
  serializeFieldPatterns,
  type FieldPattern,
} from "@/lib/fieldPatterns";
import { useClipboard } from "@/lib/useClipboard";

type PresetDefinition = {
  key: string;
  pattern: string;
  flags?: string;
};

type Preset = PresetDefinition & {
  label: string;
  description: string;
};

type MatchItem = {
  value: string;
  index: number;
  groups: string[];
};

type FieldMatch = FieldPattern & {
  matches: MatchItem[];
};

type FieldRow = FieldPatternRow;

const MAX_MATCHES = 200;

const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    key: "url",
    pattern: "https?:\\/\\/(?:[\\w-]+\\.)+[\\w-]+(?:[/?#][^\\s]*)?",
    flags: "g",
  },
  {
    key: "email",
    pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
    flags: "g",
  },
  {
    key: "ipv4",
    pattern:
      "\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b",
    flags: "g",
  },
  {
    key: "date",
    pattern: "\\b\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b",
    flags: "g",
  },
  {
    key: "hexColor",
    pattern: "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b",
    flags: "g",
  },
  {
    key: "uuid",
    pattern:
      "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b",
    flags: "g",
  },
];

const toFlagSet = (flags?: string) =>
  new Set((flags ?? "").split("").filter(Boolean));

const DEFAULT_SAMPLE_FIELDS = PRESET_DEFINITIONS.map(
  (preset) => `${preset.key},${preset.pattern}`
).join("\n");
const DEFAULT_SAMPLE_SCRIPT =
  "return rows.map((row) => row.join(\",\")).join(\"\\n\");";

export default function RegexMatcherTool() {
  const t = useTranslations("tools.regex-matcher.ui");
  const sampleText = t("sample.text");
  const sampleFields = useMemo(() => {
    if (typeof t.raw === "function") {
      const raw = t.raw("sample.fields");
      if (typeof raw === "string") return raw;
    }
    return DEFAULT_SAMPLE_FIELDS;
  }, [t]);
  const sampleScript = useMemo(() => {
    if (typeof t.raw === "function") {
      const raw = t.raw("sample.script");
      if (typeof raw === "string") return raw;
    }
    return DEFAULT_SAMPLE_SCRIPT;
  }, [t]);

  const presets = useMemo<Preset[]>(
    () =>
      PRESET_DEFINITIONS.map((preset) => ({
        ...preset,
        label: t(`presets.${preset.key}.label`),
        description: t(`presets.${preset.key}.description`),
      })),
    [t]
  );

  const defaultPreset = presets[0];
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [fieldMode, setFieldMode] = useState<"list" | "text">("list");
  const [fieldText, setFieldText] = useState("");
  const [fieldRows, setFieldRows] = useState<FieldRow[]>([]);
  const [flags, setFlags] = useState<Set<string>>(() =>
    toFlagSet(defaultPreset?.flags)
  );
  const [input, setInput] = useState(sampleText);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string | null>(
    defaultPreset?.key ?? null
  );
  const [useScript, setUseScript] = useState(false);
  const [scriptInput, setScriptInput] = useState(sampleScript);
  const [error, setError] = useState<string | null>(null);
  const { copied, copy, reset } = useClipboard({
    onError: () => setError(t("errors.clipboard")),
  });

  const flagOptions = useMemo(
    () => [
      { key: "g", label: t("flags.global") },
      { key: "i", label: t("flags.ignoreCase") },
      { key: "m", label: t("flags.multiline") },
      { key: "s", label: t("flags.dotAll") },
      { key: "u", label: t("flags.unicode") },
    ],
    [t]
  );

  const flagString = useMemo(
    () => Array.from(flags).sort().join(""),
    [flags]
  );

  const fieldPatterns = useMemo(() => {
    const source =
      fieldMode === "text" ? parseFieldPatterns(fieldText) : fieldRows;
    return source
      .map((field, index) => {
        const pattern = field.pattern.trim();
        if (!pattern) return null;
        return {
          name: field.name.trim() || `field${index + 1}`,
          pattern,
        };
      })
      .filter(Boolean) as FieldPattern[];
  }, [fieldMode, fieldRows, fieldText]);

  const fieldPreview = useMemo(
    () => fieldPatterns.slice(0, 3),
    [fieldPatterns]
  );

  const fieldEditorLabels = useMemo(
    () => ({
      edit: t("actions.editFields"),
      hide: t("actions.hideFields"),
      add: t("actions.addField"),
      clear: t("actions.clearFields"),
      remove: t("actions.removeField"),
      textMode: t("actions.textMode"),
      listMode: t("actions.listMode"),
      apply: t("actions.applyFields"),
      fieldNamePlaceholder: t("placeholders.fieldName"),
      fieldPatternPlaceholder: t("placeholders.fieldPattern"),
      textPlaceholder: t("placeholders.pattern"),
      empty: t("status.emptyPattern"),
    }),
    [t]
  );

  const fieldSummary = useMemo(() => {
    const count = fieldPatterns.length;
    if (!count) {
      return {
        emptyLabel: t("status.noFields"),
        preview: [],
      };
    }
    const moreCount = Math.max(0, count - fieldPreview.length);
    return {
      label: t("status.fieldsCount", { count }),
      preview: fieldPreview,
      moreLabel: moreCount ? t("status.moreFields", { count: moreCount }) : undefined,
      emptyLabel: t("status.noFields"),
    };
  }, [fieldPatterns.length, fieldPreview, t]);

  const fieldRowErrors = useMemo(() => {
    if (fieldMode !== "list") return new Map<string, string>();
    const errors = new Map<string, string>();
    fieldRows.forEach((row) => {
      const pattern = row.pattern.trim();
      if (!pattern) return;
      try {
        new RegExp(pattern, flagString);
      } catch {
        errors.set(row.id, t("errors.invalidPattern"));
      }
    });
    return errors;
  }, [fieldMode, fieldRows, flagString, t]);

  const matchResult = useMemo(() => {
    if (!fieldPatterns.length) {
      return {
        fields: [] as FieldMatch[],
        rows: [] as string[][],
        error: null,
        truncated: false,
      };
    }

    let truncated = false;
    const useGlobal = flagString.includes("g");
    const fields: FieldMatch[] = [];

    for (const field of fieldPatterns) {
      let regex: RegExp;
      try {
        regex = new RegExp(field.pattern, flagString);
      } catch {
        return {
          fields: [] as FieldMatch[],
          rows: [] as string[][],
          error: t("errors.invalidPattern"),
          truncated: false,
        };
      }

      if (!input) {
        fields.push({ ...field, matches: [] });
        continue;
      }

      const matches: MatchItem[] = [];
      if (useGlobal) {
        let count = 0;
        for (const match of input.matchAll(regex)) {
          matches.push({
            value: match[0],
            index: match.index ?? 0,
            groups: match.slice(1),
          });
          count += 1;
          if (count >= MAX_MATCHES) {
            truncated = true;
            break;
          }
        }
      } else {
        const match = regex.exec(input);
        if (match) {
          matches.push({
            value: match[0],
            index: match.index ?? 0,
            groups: match.slice(1),
          });
        }
      }

      fields.push({ ...field, matches });
    }

    const rowCount = Math.min(
      Math.max(0, ...fields.map((field) => field.matches.length)),
      MAX_MATCHES
    );

    const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
      fields.map((field) => field.matches[rowIndex]?.value ?? "")
    );

    return { fields, rows, error: null, truncated };
  }, [fieldPatterns, flagString, input, t]);

  const scriptedOutput = useMemo(() => {
    if (!useScript || matchResult.error) return { output: "", error: null };
    try {
      const fn = new Function(
        "context",
        `const { rows, fields, matches, input, flags } = context;\n${scriptInput}`
      );
      const result = fn({
        rows: matchResult.rows,
        fields: matchResult.fields.map((field) => field.name),
        matches: matchResult.fields.reduce<Record<string, MatchItem[]>>(
          (acc, field) => {
            acc[field.name] = field.matches;
            return acc;
          },
          {}
        ),
        input,
        flags: flagString,
      });
      if (Array.isArray(result)) {
        return { output: result.join("\n"), error: null };
      }
      if (result === null || result === undefined) {
        return { output: "", error: null };
      }
      return { output: String(result), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: "", error: t("errors.script", { message }) };
    }
  }, [flagString, input, matchResult, scriptInput, t, useScript]);

  const output = useMemo(() => {
    if (useScript) return scriptedOutput.output;
    if (!matchResult.rows.length) return "";
    return matchResult.rows.map((row) => row.join(",")).join("\n");
  }, [matchResult.rows, scriptedOutput.output, useScript]);

  const status = useMemo(() => {
    if (error) return error;
    if (matchResult.error) return matchResult.error;
    if (scriptedOutput.error) return scriptedOutput.error;
    if (copied) return t("status.copied");
    if (!fieldPatterns.length) return t("status.emptyPattern");
    if (!input) return t("status.ready");
    if (!matchResult.rows.length) return t("status.noMatch");
    if (matchResult.truncated) {
      return t("status.truncated", { count: matchResult.rows.length });
    }
    return t("status.matches", { count: matchResult.rows.length });
  }, [
    copied,
    error,
    fieldPatterns.length,
    input,
    matchResult,
    scriptedOutput.error,
    t,
  ]);

  const tone =
    error || matchResult.error || scriptedOutput.error ? "error" : "normal";

  const resetStatus = () => {
    setError(null);
    reset();
  };

  const updateFieldRow = (id: string, patch: Partial<FieldRow>) => {
    setFieldRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
    setSelectedPresetKey(null);
    resetStatus();
  };

  const removeFieldRow = (id: string) => {
    setFieldRows((prev) => prev.filter((row) => row.id !== id));
    setSelectedPresetKey(null);
    resetStatus();
  };

  const addFieldRow = (name = "", pattern = "") => {
    setFieldRows((prev) => [
      ...prev,
      { id: createFieldId(), name, pattern },
    ]);
    setSelectedPresetKey(null);
    resetStatus();
  };

  const clearFields = () => {
    setFieldRows([]);
    setFieldText("");
    setSelectedPresetKey(null);
    resetStatus();
  };

  const applyFieldText = () => {
    const parsed = parseFieldPatterns(fieldText).map((field) => ({
      id: createFieldId(),
      name: field.name,
      pattern: field.pattern,
    }));
    setFieldRows(parsed);
    setFieldMode("list");
    resetStatus();
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    resetStatus();
  };

  const toggleFlag = (flag: string) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
    setSelectedPresetKey(null);
    resetStatus();
  };

  const applyPreset = (preset: Preset) => {
    const nextLine = `${preset.label},${preset.pattern}`;
    if (fieldMode === "text") {
      setFieldText((prev) => {
        if (!prev.trim()) return nextLine;
        return `${prev.trim()}\n${nextLine}`;
      });
    } else {
      addFieldRow(preset.label, preset.pattern);
    }
    setFlags(toFlagSet(preset.flags));
    setSelectedPresetKey(preset.key);
    resetStatus();
  };

  const useSample = () => {
    setInput(sampleText);
    setFieldText(sampleFields);
    setFieldRows(
      parseFieldPatterns(sampleFields).map((field) => ({
        id: createFieldId(),
        name: field.name,
        pattern: field.pattern,
      }))
    );
    setFieldMode("list");
    resetStatus();
  };

  const clearInput = () => {
    setInput("");
    resetStatus();
  };

  const copyMatches = async () => {
    if (!output) return;
    await copy(output);
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={useSample}>{t("actions.sample")}</SecondaryButton>
        <SecondaryButton onClick={copyMatches} disabled={!output}>
          {t("actions.copyMatches")}
        </SecondaryButton>
        <GhostButton onClick={clearInput}>{t("actions.clear")}</GhostButton>
        <Button
          variant={useScript ? "primary" : "secondary"}
          size="sm"
          onClick={() => {
            setUseScript((prev) => !prev);
            resetStatus();
          }}
        >
          {t("actions.script")}
        </Button>
      </div>

      <StatusLine text={status} tone={tone} />

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <ToolPanel title={t("labels.input")} className="min-h-[260px]">
          <ToolTextarea
            value={input}
            onChange={(event) => handleInputChange(event.target.value)}
            placeholder={t("placeholders.input")}
            spellCheck={false}
            className="mt-3 min-h-[220px]"
          />
        </ToolPanel>
        <ToolPanel title={t("labels.matches")} className="min-h-[260px]">
          <ToolTextarea
            value={output}
            readOnly
            spellCheck={false}
            placeholder={t("placeholders.matches")}
            className="mt-3 min-h-[220px]"
          />
        </ToolPanel>
      </div>

      <ToolPanel title={t("labels.presets")}>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {presets.map((preset) => {
            const isActive = selectedPresetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className={cn(
                  "rounded-[16px] border p-3 text-left transition",
                  isActive
                    ? "border-[color:var(--accent-blue)] bg-[color:var(--glass-hover-bg)]"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {preset.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                  {preset.description}
                </p>
                <code className="mt-2 block rounded-[10px] bg-[color:var(--glass-recessed-bg)] px-2 py-1 text-[11px] text-[color:var(--text-primary)]">
                  {preset.pattern}
                </code>
              </button>
            );
          })}
        </div>
      </ToolPanel>

      <ToolPanel title={t("labels.script")}>
        <ToolTextarea
          value={scriptInput}
          onChange={(event) => {
            setScriptInput(event.target.value);
            resetStatus();
          }}
          placeholder={t("placeholders.script")}
          spellCheck={false}
          className="mt-3 min-h-[160px]"
        />
        <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
          {t("hints.script")}
        </p>
      </ToolPanel>

      <ToolPanel
        title={t("labels.pattern")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {flagOptions.map((flag) => (
              <Button
                key={flag.key}
                variant={flags.has(flag.key) ? "primary" : "secondary"}
                size="sm"
                onClick={() => toggleFlag(flag.key)}
              >
                {flag.label}
              </Button>
            ))}
          </div>
        }
        actionsClassName="flex flex-wrap items-center gap-2"
      >
        <FieldPatternEditor
          showEditor={showFieldEditor}
          mode={fieldMode}
          rows={fieldRows}
          textValue={fieldText}
          summary={fieldSummary}
          errorById={fieldRowErrors}
          labels={fieldEditorLabels}
          onToggleEditor={() => setShowFieldEditor((prev) => !prev)}
          onAddRow={() => addFieldRow()}
          onClear={clearFields}
          onModeChange={(mode) => {
            if (mode === "text") {
              setFieldText(serializeFieldPatterns(fieldRows));
            }
            setFieldMode(mode);
          }}
          onApplyText={applyFieldText}
          onRowChange={updateFieldRow}
          onRemoveRow={removeFieldRow}
          onTextChange={(value) => {
            setFieldText(value);
            setSelectedPresetKey(null);
            resetStatus();
          }}
        >
          <p className="mt-2 text-xs text-[color:var(--text-secondary)]">
            {t("hints.pattern")}
          </p>
        </FieldPatternEditor>
      </ToolPanel>
    </div>
  );
}
