import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ToolInput } from "@/components/ToolInput";
import { cn } from "@/lib/cn";

import type { SavedScript } from "../lib/types";

type ScriptManagerModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  scriptNameLabel: string;
  scriptName: string;
  scriptNamePlaceholder: string;
  onScriptNameChange: (value: string) => void;
  saveLabel: string;
  saveAsNewLabel: string;
  deleteLabel: string;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
  savedScriptsLabel: string;
  savedCountLabel: string;
  emptyLabel: string;
  savedScripts: SavedScript[];
  activeScriptId: string | null;
  onLoadScript: (id: string) => void;
  activeLabel: string;
};

export function ScriptManagerModal({
  open,
  onClose,
  title,
  closeLabel,
  scriptNameLabel,
  scriptName,
  scriptNamePlaceholder,
  onScriptNameChange,
  saveLabel,
  saveAsNewLabel,
  deleteLabel,
  onSave,
  onSaveAsNew,
  onDelete,
  deleteDisabled,
  savedScriptsLabel,
  savedCountLabel,
  emptyLabel,
  savedScripts,
  activeScriptId,
  onLoadScript,
  activeLabel,
}: ScriptManagerModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {scriptNameLabel}
          </p>
          <ToolInput
            value={scriptName}
            onChange={(event) => onScriptNameChange(event.target.value)}
            placeholder={scriptNamePlaceholder}
            spellCheck={false}
            className="mt-2"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSave}>
            {saveLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSaveAsNew}>
            {saveAsNewLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} disabled={deleteDisabled}>
            {deleteLabel}
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs text-[color:var(--text-secondary)]">
          <span>{savedScriptsLabel}</span>
          <span>{savedCountLabel}</span>
        </div>
        <div className="max-h-[220px] overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-2">
          {savedScripts.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[color:var(--text-secondary)]">
              {emptyLabel}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {savedScripts.map((script) => {
                const isActive = script.id === activeScriptId;
                return (
                  <button
                    key={script.id}
                    type="button"
                    onClick={() => onLoadScript(script.id)}
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
                        {activeLabel}
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
  );
}
