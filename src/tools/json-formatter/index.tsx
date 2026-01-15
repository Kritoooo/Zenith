"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { ToolPanel } from "@/components/ToolPanel";
import { cn } from "@/lib/cn";
import { useClipboard } from "@/lib/useClipboard";
import { JsonTree } from "./JsonTree";
import { JsonValue, collectPaths, countNodesWithCap } from "./jsonUtils";

const indentOptions = [2, 4] as const;
const fontSizeOptions = [12, 14, 16, 18] as const;
const LARGE_TEXT_THRESHOLD = 120_000;
const TREE_NODE_LIMIT = 8000;
const PROCESS_DELAY_MS = 12;
const DEFAULT_SAMPLE = `{
  "name": "Zenith",
  "active": true,
  "tags": ["tooling", "design"]
}`;

type TreeGuardState = {
  disabled: boolean;
  forced: boolean;
  reason: "size" | "nodes" | null;
  nodeCount: number | null;
};

const createInitialTreeGuard = (): TreeGuardState => ({
  disabled: false,
  forced: false,
  reason: null,
  nodeCount: null,
});

const waitForNextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(resolve, PROCESS_DELAY_MS);
  });

const toKilobytes = (length: number) => Math.max(1, Math.round(length / 1024));

export default function JsonFormatterTool() {
  const t = useTranslations("tools.json-formatter.ui");
  const sampleJson = useMemo(() => {
    const value = t("sample");
    // Fallback when locale messages are missing and NextIntl returns the key.
    if (value === "tools.json-formatter.ui.sample") return DEFAULT_SAMPLE;
    return value;
  }, [t]);
  const [input, setInput] = useState(sampleJson);
  const [output, setOutput] = useState("");
  const [parsedValue, setParsedValue] = useState<JsonValue | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [viewMode, setViewMode] = useState<"tree" | "raw">("tree");
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState<(typeof indentOptions)[number]>(2);
  const [fontSize, setFontSize] = useState<(typeof fontSizeOptions)[number]>(14);
  const { copied, copy, reset } = useClipboard({
    onError: () => setError(t("errors.clipboard")),
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [treeGuard, setTreeGuard] = useState<TreeGuardState>(
    createInitialTreeGuard
  );
  const [payloadSize, setPayloadSize] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [lastMode, setLastMode] = useState<"pretty" | "minify" | null>(null);
  const treeBlocked = treeGuard.disabled && !treeGuard.forced;
  const allPaths = useMemo(() => {
    if (!parsedValue || treeBlocked) return new Set<string>();
    const next = new Set<string>();
    collectPaths(parsedValue, "$", next, false);
    return next;
  }, [parsedValue, treeBlocked]);
  const payloadSizeKb = payloadSize ? toKilobytes(payloadSize) : 0;
  const statusMessage =
    error ??
    (isProcessing
      ? t("status.processing")
      : copied
        ? t("status.copied")
        : treeBlocked
          ? treeGuard.reason === "size"
            ? t("status.treeGuardSize")
            : t("status.treeGuardNodes", { limit: TREE_NODE_LIMIT.toLocaleString() })
          : "");
  const statusTone = error
    ? "text-rose-500/80"
    : isProcessing
      ? "text-[color:var(--accent-blue)]"
      : "text-[color:var(--text-secondary)]";
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
      setTreeGuard(createInitialTreeGuard());
      setPayloadSize(0);
      return undefined;
    }
  };

  const processJson = async (mode: "pretty" | "minify") => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    if (copied) reset();

    await waitForNextFrame();

    const value = parseJson();
    if (value === undefined) {
      setIsProcessing(false);
      return;
    }

    const size = input.length;
    const nodeCount = countNodesWithCap(value as JsonValue, TREE_NODE_LIMIT + 1);
    const isSizeBlocked = size >= LARGE_TEXT_THRESHOLD;
    const isNodeBlocked = nodeCount > TREE_NODE_LIMIT;
    const shouldDisableTree = isSizeBlocked || isNodeBlocked;

    setTreeGuard({
      disabled: shouldDisableTree,
      forced: false,
      reason: isSizeBlocked ? "size" : isNodeBlocked ? "nodes" : null,
      nodeCount: Math.min(nodeCount, TREE_NODE_LIMIT + 1),
    });
    setPayloadSize(size);
    setCollapsedPaths(new Set());

    const nextOutput =
      mode === "pretty"
        ? JSON.stringify(value, null, indent)
        : JSON.stringify(value);
    setOutput(nextOutput);
    setParsedValue(value as JsonValue);
    setLastMode(mode);

    if (shouldDisableTree && viewMode === "tree") {
      setViewMode("raw");
    }

    setIsProcessing(false);
  };

  const formatJson = () => processJson("pretty");

  const minifyJson = () => processJson("minify");

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

  const forceTreeRender = () => {
    if (!parsedValue) return;
    setTreeGuard((prev) => ({
      ...prev,
      disabled: false,
      forced: true,
    }));
    setViewMode("tree");
  };

  const copyOutput = async () => {
    if (!output) return;
    await copy(output);
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={formatJson} disabled={isProcessing}>
            {t("actions.format")}
          </PrimaryButton>
          <SecondaryButton onClick={minifyJson} disabled={isProcessing}>
            {t("actions.minify")}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => setShowInput((prev) => !prev)}
            disabled={isProcessing}
          >
            {showInput ? t("actions.hideInput") : t("actions.showInput")}
          </SecondaryButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 text-[11px] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]">
            {indentOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setIndent(value);
                  if (lastMode === "pretty" && parsedValue) {
                    setOutput(JSON.stringify(parsedValue, null, value));
                    reset();
                  }
                }}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  value === indent
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {t("indent.option", { count: value })}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 text-[11px] text-[color:var(--text-secondary)] shadow-[var(--glass-shadow)]">
            {fontSizeOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFontSize(value)}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  value === fontSize
                    ? "bg-[color:var(--accent-blue)] text-white"
                    : "hover:bg-[color:var(--glass-hover-bg)]"
                )}
              >
                {t("font.label", { size: value })}
              </button>
            ))}
          </div>
          <SecondaryButton onClick={copyOutput} disabled={!output || isProcessing}>
            {t("actions.copy")}
          </SecondaryButton>
        </div>
      </div>
      <p
        className={cn("min-h-[1.25rem] text-xs transition-colors", statusTone)}
        aria-live="polite"
      >
        {statusMessage}
      </p>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {showInput ? (
          <ToolPanel
            title={t("labels.input")}
            className="min-h-[clamp(360px,58vh,720px)] min-w-0"
          >
            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
                if (copied) reset();
              }}
              spellCheck={false}
              placeholder={t("placeholders.input")}
              wrap="off"
              style={{ fontSize, whiteSpace: "pre" }}
              className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 resize-none overflow-auto rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          </ToolPanel>
        ) : null}
        <ToolPanel
          title={t("labels.output")}
          className={cn(
            "min-h-[clamp(360px,58vh,720px)] min-w-0",
            showInput ? "" : "lg:w-full"
          )}
          headerClassName="flex flex-wrap items-center justify-between gap-2"
          actionsClassName="flex flex-wrap items-center gap-2 text-[11px] font-medium normal-case"
          actions={
            <>
              <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1">
                {(["tree", "raw"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    disabled={mode === "tree" && treeBlocked}
                    className={cn(
                      "rounded-full px-3 py-1 capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
                    disabled={!parsedValue || treeBlocked}
                  >
                    {t("actions.expandAll")}
                  </SecondaryButton>
                  <SecondaryButton
                    size="sm"
                    onClick={collapseAll}
                    disabled={!parsedValue || treeBlocked}
                  >
                    {t("actions.collapseAll")}
                  </SecondaryButton>
                </>
              ) : null}
            </>
          }
        >
          {output ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--text-secondary)]">
              <span className="rounded-full bg-[color:var(--glass-recessed-bg)] px-2 py-1">
                {t("status.sizeLabel", { size: payloadSizeKb })}
              </span>
              {treeGuard.nodeCount !== null ? (
                <span className="rounded-full bg-[color:var(--glass-recessed-bg)] px-2 py-1">
                  {t("status.nodeLabel", {
                    count:
                      treeGuard.nodeCount > TREE_NODE_LIMIT
                        ? `${TREE_NODE_LIMIT}+`
                        : treeGuard.nodeCount.toLocaleString(),
                  })}
                </span>
              ) : null}
              {treeGuard.forced ? (
                <span className="rounded-full border border-[color:var(--glass-border)] px-2 py-1">
                  {t("status.forcedTree")}
                </span>
              ) : null}
              {treeGuard.reason ? (
                <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-hover-bg)] px-2 py-1 text-[color:var(--text-primary)]">
                  {treeGuard.reason === "size"
                    ? t("status.treeGuardSize")
                    : t("status.treeGuardNodes", {
                        limit: TREE_NODE_LIMIT.toLocaleString(),
                      })}
                </span>
              ) : null}
              {lastMode === "pretty" ? (
                <span className="rounded-full bg-[color:var(--glass-recessed-bg)] px-2 py-1">
                  {t("status.indentLabel", { count: indent })}
                </span>
              ) : null}
            </div>
          ) : null}
          {treeBlocked ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3 text-[11px] text-[color:var(--text-secondary)]">
              <p className="leading-relaxed">
                {treeGuard.reason === "size"
                  ? t("status.treeGuardSize")
                  : t("status.treeGuardNodes", { limit: TREE_NODE_LIMIT.toLocaleString() })}
              </p>
              <SecondaryButton size="sm" onClick={forceTreeRender}>
                {t("actions.forceTree")}
              </SecondaryButton>
            </div>
          ) : null}
          {viewMode === "tree" ? (
            <div
              className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 overflow-auto rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 font-mono leading-relaxed text-[color:var(--text-primary)] whitespace-pre focus-within:border-[color:var(--accent-blue)]"
              style={{ fontSize }}
            >
              {treeBlocked ? (
                <p className="text-[color:var(--text-secondary)]">
                  {treeGuard.reason === "size"
                    ? t("status.treeGuardSize")
                    : t("status.treeGuardNodes", { limit: TREE_NODE_LIMIT.toLocaleString() })}
                </p>
              ) : parsedValue && output ? (
                <JsonTree
                  value={parsedValue}
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
              wrap="off"
              style={{ fontSize, whiteSpace: "pre" }}
              className="mt-3 min-h-[clamp(260px,44vh,560px)] w-full flex-1 resize-none overflow-auto rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 leading-relaxed text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]"
            />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}
