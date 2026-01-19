import { Button } from "@/components/Button";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";
import { cn } from "@/lib/cn";

import type { ScriptNotice } from "../lib/types";

type ScriptPanelProps = {
  title: string;
  toggleLabel: string;
  manageLabel: string;
  useScript: boolean;
  onToggle: (checked: boolean) => void;
  onManage: () => void;
  activeLabel: string;
  savedCountLabel: string;
  scriptValue: string;
  scriptPlaceholder: string;
  onScriptChange: (value: string) => void;
  hint: string;
  scriptNotice: ScriptNotice | null;
};

export function ScriptPanel({
  title,
  toggleLabel,
  manageLabel,
  useScript,
  onToggle,
  onManage,
  activeLabel,
  savedCountLabel,
  scriptValue,
  scriptPlaceholder,
  onScriptChange,
  hint,
  scriptNotice,
}: ScriptPanelProps) {
  return (
    <ToolPanel
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[color:var(--text-secondary)]">
            <input
              type="checkbox"
              checked={useScript}
              onChange={(event) => onToggle(event.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent-blue)]"
            />
            <span>{toggleLabel}</span>
          </label>
          <Button variant="ghost" size="sm" onClick={onManage}>
            {manageLabel}
          </Button>
        </div>
      }
      headerClassName="flex flex-wrap items-center justify-between gap-2"
      actionsClassName="flex flex-wrap items-center gap-2"
    >
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
        <span>{activeLabel}</span>
        <span>{savedCountLabel}</span>
      </div>
      <ToolTextarea
        value={scriptValue}
        onChange={(event) => onScriptChange(event.target.value)}
        placeholder={scriptPlaceholder}
        spellCheck={false}
        className="mt-3 min-h-[140px] font-mono"
      />
      <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{hint}</p>
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
  );
}
