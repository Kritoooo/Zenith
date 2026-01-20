"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { useClipboard } from "@/lib/useClipboard";
import { resolveTranslationFallback } from "@/lib/i18n";

import { InputPanel } from "./components/InputPanel";
import { OutputPanel } from "./components/OutputPanel";
import { PathsPanel } from "./components/PathsPanel";
import { ScriptManagerModal } from "./components/ScriptManagerModal";
import { ScriptPanel } from "./components/ScriptPanel";
import { useScriptManager } from "./hooks/useScriptManager";
import {
  DEFAULT_SAMPLE_JSON,
  DEFAULT_SAMPLE_PATHS,
  DEFAULT_SAMPLE_SCRIPT,
} from "./lib/constants";
import { detectPaths } from "./lib/detect";
import {
  buildDefaultOutput,
  normalizeScriptResult,
  resolvePath,
  toText,
} from "./lib/extract";
import { parsePathList, parsePathSegments } from "./lib/paths";
import type {
  DetectSummary,
  ExtractionItem,
  JsonValue,
  RunSummary,
} from "./lib/types";

export default function JsonFieldExtractorTool() {
  const t = useTranslations("tools.json-field-extractor.ui");
  const sampleJson = useMemo(
    () =>
      resolveTranslationFallback(
        t,
        "sample.json",
        DEFAULT_SAMPLE_JSON,
        "tools.json-field-extractor.ui.sample.json"
      ),
    [t]
  );
  const samplePaths = useMemo(
    () =>
      resolveTranslationFallback(
        t,
        "sample.paths",
        DEFAULT_SAMPLE_PATHS,
        "tools.json-field-extractor.ui.sample.paths"
      ),
    [t]
  );
  const sampleScript = useMemo(
    () =>
      resolveTranslationFallback(
        t,
        "sample.script",
        DEFAULT_SAMPLE_SCRIPT,
        "tools.json-field-extractor.ui.sample.script"
      ),
    [t]
  );
  const defaultScriptName = t("defaults.scriptName");
  const {
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
  } = useScriptManager({ defaultScriptName, sampleScript, t });

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
  const [useScript, setUseScript] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
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
      const next = new Set(result.paths.filter((path) => prev.has(path)));
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
      let segments: ReturnType<typeof parsePathSegments>;
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
          flatten: (values: ExtractionItem[]) => values.flatMap((item) => item.values),
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
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <InputPanel
          title={t("labels.input")}
          input={input}
          placeholder={t("placeholders.input")}
          sampleLabel={t("actions.sample")}
          clearLabel={t("actions.clear")}
          onChange={(value) => {
            setInput(value);
            resetStatus();
          }}
          onSample={applySample}
          onClear={clearAll}
        />

        <div className="flex flex-col gap-4">
          <PathsPanel
            title={t("labels.paths")}
            detectLabel={t("actions.detect")}
            selectAllLabel={t("actions.selectAll")}
            selectFilteredLabel={t("actions.selectFiltered")}
            clearSelectionLabel={t("actions.clearSelection")}
            searchPlaceholder={t("placeholders.search")}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            detectedLabel={detectedLabel}
            selectedLabel={selectedLabel}
            filteredPaths={filteredPaths}
            selectedPaths={selectedPaths}
            onDetect={handleDetect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onTogglePath={toggleSelection}
            manualTitle={t("labels.manual")}
            manualValue={manualPathsInput}
            manualPlaceholder={t("placeholders.manual")}
            onManualChange={(value) => {
              setManualPathsInput(value);
              resetStatus();
            }}
            hint={t("hints.paths")}
            isSelectAllDisabled={detectedPaths.length === 0}
            isClearSelectionDisabled={selectedCount === 0}
            emptyNoPathsLabel={t("emptyState.noPaths")}
            emptyNoMatchesLabel={t("emptyState.noMatches")}
          />

          <ScriptPanel
            title={t("labels.script")}
            toggleLabel={t("toggles.script")}
            manageLabel={t("actions.manageScripts")}
            useScript={useScript}
            onToggle={setUseScript}
            onManage={() => setIsScriptManagerOpen(true)}
            activeLabel={
              activeScript
                ? t("status.activeScript", { name: activeScript.name })
                : t("status.noActiveScript")
            }
            savedCountLabel={t("status.savedCount", { count: savedScripts.length })}
            scriptValue={scriptInput}
            scriptPlaceholder={t("placeholders.script")}
            onScriptChange={(value) => {
              setScriptInput(value);
              resetStatus();
            }}
            hint={t("hints.script")}
            scriptNotice={scriptNotice}
          />
        </div>
      </div>

      <OutputPanel
        title={t("labels.output")}
        extractLabel={t("actions.extract")}
        copyLabel={t("actions.copy")}
        onExtract={handleExtract}
        onCopy={copyOutput}
        copyDisabled={!output}
        status={status}
        statusTone={error ? "error" : "normal"}
        output={output}
        placeholder={t("placeholders.output")}
      />

      <ScriptManagerModal
        open={isScriptManagerOpen}
        onClose={() => setIsScriptManagerOpen(false)}
        title={t("labels.manageScripts")}
        closeLabel={t("actions.close")}
        scriptNameLabel={t("labels.scriptName")}
        scriptName={scriptName}
        scriptNamePlaceholder={t("placeholders.scriptName")}
        onScriptNameChange={(value) => {
          setScriptName(value);
          resetStatus();
        }}
        saveLabel={t("actions.saveScript")}
        saveAsNewLabel={t("actions.saveAsNew")}
        deleteLabel={t("actions.deleteScript")}
        onSave={() => saveScriptEntry("update")}
        onSaveAsNew={() => saveScriptEntry("new")}
        onDelete={deleteScript}
        deleteDisabled={!activeScriptId}
        savedScriptsLabel={t("labels.savedScripts")}
        savedCountLabel={t("status.savedCount", { count: savedScripts.length })}
        emptyLabel={t("emptyState.noScripts")}
        savedScripts={savedScripts}
        activeScriptId={activeScriptId}
        onLoadScript={loadScript}
        activeLabel={t("status.active")}
      />
    </div>
  );
}
