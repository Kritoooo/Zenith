"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { cn } from "@/lib/cn";

const indentOptions = [2, 4] as const;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const isJsonBranch = (
  value: JsonValue
): value is Record<string, JsonValue> | JsonValue[] =>
  typeof value === "object" && value !== null;

const formatPrimitive = (value: JsonValue) => {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
};

const formatKey = (value: string) => JSON.stringify(value);

const getPrimitiveTone = (value: JsonValue) => {
  if (value === null) return "text-[color:var(--accent-pink)]";
  if (typeof value === "string") return "text-[color:var(--accent-green)]";
  if (typeof value === "number") return "text-[color:var(--accent-orange)]";
  return "text-[color:var(--accent-blue)]";
};

type SummaryLabels = {
  array: string;
  object: string;
};

const getNodeSummary = (value: JsonValue, labels: SummaryLabels) => {
  if (Array.isArray(value)) return `${labels.array}(${value.length})`;
  if (isJsonBranch(value)) return `${labels.object}(${Object.keys(value).length})`;
  return formatPrimitive(value);
};

const buildPath = (parent: string, key: string | number) => {
  if (typeof key === "number") return `${parent}/${key}`;
  const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
  return `${parent}/${escaped}`;
};

const collectPaths = (
  value: JsonValue | null,
  path: string,
  paths: Set<string>,
  includeSelf: boolean
) => {
  if (!value || !isJsonBranch(value)) return;
  if (includeSelf) paths.add(path);
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item] as const)
    : (Object.entries(value) as [string, JsonValue][]);
  entries.forEach(([key, child]) => {
    if (!isJsonBranch(child)) return;
    const childPath = buildPath(path, key);
    collectPaths(child, childPath, paths, true);
  });
};

type JsonNodeProps = {
  label?: string;
  value: JsonValue;
  path: string;
  depth: number;
  isLast: boolean;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  summaryLabels: SummaryLabels;
  ariaLabels: {
    expand: string;
    collapse: string;
  };
};

function JsonNode({
  label,
  value,
  path,
  depth,
  isLast,
  collapsedPaths,
  onToggle,
  summaryLabels,
  ariaLabels,
}: JsonNodeProps) {
  const isBranch = isJsonBranch(value);
  const isArray = Array.isArray(value);
  const entries = isBranch
    ? isArray
      ? value.map((item, index) => [index, item] as const)
      : (Object.entries(value) as [string, JsonValue][])
    : [];
  const hasChildren = entries.length > 0;
  const isCollapsed = collapsedPaths.has(path);
  const comma = isLast ? "" : ",";
  const opener = isArray ? "[" : "{";
  const closer = isArray ? "]" : "}";
  const summary = getNodeSummary(value, summaryLabels);

  const renderControl = (interactive: boolean) =>
    interactive ? (
      <button
        type="button"
        onClick={() => onToggle(path)}
        aria-label={isCollapsed ? ariaLabels.expand : ariaLabels.collapse}
        className="mt-[2px] flex h-4 w-4 items-center justify-center rounded border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[10px] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--glass-hover-bg)]"
      >
        {isCollapsed ? "+" : "-"}
      </button>
    ) : (
      <span className="mt-[2px] inline-flex h-4 w-4" aria-hidden="true" />
    );

  const renderLabel = () =>
    label !== undefined ? (
      <>
        <span className="text-[color:var(--accent-blue)]">
          {formatKey(label)}
        </span>
        <span className="text-[color:var(--text-secondary)]">: </span>
      </>
    ) : null;

  if (!isBranch) {
    return (
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
        {renderControl(false)}
        <div className="flex flex-wrap items-center">
          {renderLabel()}
          <span className={getPrimitiveTone(value)}>
            {formatPrimitive(value)}
            {comma}
          </span>
        </div>
      </div>
    );
  }

  if (!hasChildren) {
    return (
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
        {renderControl(false)}
        <div className="flex flex-wrap items-center">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">
            {opener}
            {closer}
            {comma}
          </span>
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
        {renderControl(true)}
        <div className="flex flex-wrap items-center">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">
            {opener}...{closer}
            {comma}
          </span>
          <span className="ml-2 text-[10px] text-[color:var(--text-secondary)]">
            {summary}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
        {renderControl(true)}
        <div className="flex flex-wrap items-center">
          {renderLabel()}
          <span className="text-[color:var(--text-secondary)]">{opener}</span>
        </div>
      </div>
      {entries.map(([key, child], index) => {
        const childPath = buildPath(path, key);
        const childLabel = isArray ? undefined : (key as string);
        const childIsLast = index === entries.length - 1;
        return (
          <JsonNode
            key={childPath}
            label={childLabel}
            value={child}
            path={childPath}
            depth={depth + 1}
            isLast={childIsLast}
            collapsedPaths={collapsedPaths}
            onToggle={onToggle}
            summaryLabels={summaryLabels}
            ariaLabels={ariaLabels}
          />
        );
      })}
      <div className="flex items-start gap-2" style={{ paddingLeft: depth * 16 }}>
        {renderControl(false)}
        <div className="flex flex-wrap items-center">
          <span className="text-[color:var(--text-secondary)]">
            {closer}
            {comma}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function JsonFormatterTool() {
  const t = useTranslations("tools.json-formatter.ui");
  const sampleJson = t("sample");
  const [input, setInput] = useState(sampleJson);
  const [output, setOutput] = useState("");
  const [parsedValue, setParsedValue] = useState<JsonValue | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState<(typeof indentOptions)[number]>(2);
  const [copied, setCopied] = useState(false);
  const allPaths = useMemo(() => {
    if (!parsedValue) return new Set<string>();
    const next = new Set<string>();
    collectPaths(parsedValue, "$", next, false);
    return next;
  }, [parsedValue]);

  const parseJson = () => {
    try {
      const value = JSON.parse(input);
      setError(null);
      return value;
    } catch {
      setError(t("errors.invalid"));
      setOutput("");
      setParsedValue(null);
      setCollapsedPaths(new Set());
      return undefined;
    }
  };

  const formatJson = () => {
    const value = parseJson();
    if (value === undefined) return;
    setCopied(false);
    setOutput(JSON.stringify(value, null, indent));
    setParsedValue(value as JsonValue);
    setCollapsedPaths(new Set());
  };

  const minifyJson = () => {
    const value = parseJson();
    if (value === undefined) return;
    setCopied(false);
    setOutput(JSON.stringify(value));
    setParsedValue(value as JsonValue);
    setCollapsedPaths(new Set());
  };

  const togglePath = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedPaths(new Set());
  };

  const collapseAll = () => {
    setCollapsedPaths(new Set(allPaths));
  };

  const copyOutput = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError(t("errors.clipboard"));
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={formatJson}>{t("actions.format")}</PrimaryButton>
          <SecondaryButton onClick={minifyJson}>{t("actions.minify")}</SecondaryButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 text-[11px] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]">
            {indentOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setIndent(value)}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  value === indent
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {t("indent.label", { count: value })}
              </button>
            ))}
          </div>
          <SecondaryButton onClick={copyOutput} disabled={!output}>
            {t("actions.copy")}
          </SecondaryButton>
        </div>
      </div>
      <p
        className={cn(
          "min-h-[1.25rem] text-xs",
          error
            ? "text-rose-500/80"
            : "text-[color:var(--text-secondary)]"
        )}
        aria-live="polite"
      >
        {error ?? (copied ? t("status.copied") : "")}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[clamp(360px,58vh,720px)] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {t("labels.input")}
          </p>
          <textarea
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (error) setError(null);
              if (copied) setCopied(false);
            }}
            spellCheck={false}
            placeholder={t("placeholders.input")}
            className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
          />
        </div>
        <div className="flex min-h-[clamp(360px,58vh,720px)] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            <p>{t("labels.output")}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium normal-case">
              <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1">
                {(["tree", "raw"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "rounded-full px-3 py-1 capitalize transition-colors",
                      viewMode === mode
                        ? "bg-[color:var(--accent-blue)] text-white"
                        : "text-[color:var(--text-secondary)] hover:bg-[color:var(--glass-hover-bg)]"
                    )}
                  >
                    {t(`view.${mode}`)}
                  </button>
                ))}
              </div>
              {viewMode === "tree" ? (
                <>
                  <SecondaryButton
                    size="sm"
                    onClick={expandAll}
                    disabled={!parsedValue}
                  >
                    {t("actions.expandAll")}
                  </SecondaryButton>
                  <SecondaryButton
                    size="sm"
                    onClick={collapseAll}
                    disabled={!parsedValue}
                  >
                    {t("actions.collapseAll")}
                  </SecondaryButton>
                </>
              ) : null}
            </div>
          </div>
          {viewMode === "tree" ? (
            <div className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 overflow-auto rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono text-xs leading-relaxed text-[color:var(--text-primary)] focus-within:border-[color:var(--accent-blue)]">
              {parsedValue && output ? (
                <JsonNode
                  value={parsedValue}
                  path="$"
                  depth={0}
                  isLast
                  collapsedPaths={collapsedPaths}
                  onToggle={togglePath}
                  summaryLabels={{
                    array: t("summary.array"),
                    object: t("summary.object"),
                  }}
                  ariaLabels={{
                    expand: t("aria.expand"),
                    collapse: t("aria.collapse"),
                  }}
                />
              ) : (
                <p className="text-[color:var(--text-secondary)]">
                  {t("placeholders.output")}
                </p>
              )}
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              spellCheck={false}
              placeholder={t("placeholders.output")}
              className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
