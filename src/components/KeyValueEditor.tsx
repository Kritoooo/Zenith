import type { ReactNode } from "react";

import { Button, GhostButton, SecondaryButton } from "@/components/Button";
import { ToolInput } from "@/components/ToolInput";
import { ToolTextarea } from "@/components/ToolTextarea";

export type KeyValueRow = {
  id: string;
  values: string[];
};

export type KeyValueEditorLabels = {
  edit: string;
  hide: string;
  add: string;
  clear: string;
  remove: string;
  textMode: string;
  listMode: string;
  apply: string;
  empty: string;
};

export type KeyValueEditorColumn = {
  placeholder: string;
  className?: string;
  inputClassName?: string;
};

export type KeyValueEditorSummary = {
  label?: string;
  emptyLabel: string;
  preview?: KeyValueRow[];
  moreLabel?: string;
  renderItem?: (row: KeyValueRow) => ReactNode;
};

type KeyValueEditorProps = {
  showEditor: boolean;
  mode: "list" | "text";
  rows: KeyValueRow[];
  textValue: string;
  columns: KeyValueEditorColumn[];
  labels: KeyValueEditorLabels;
  summary?: KeyValueEditorSummary;
  errorById?: Map<string, string>;
  textPlaceholder?: string;
  onToggleEditor: () => void;
  onAddRow: () => void;
  onClear: () => void;
  onModeChange: (mode: "list" | "text") => void;
  onApplyText?: () => void;
  onCellChange: (id: string, index: number, value: string) => void;
  onRemoveRow: (id: string) => void;
  onTextChange: (value: string) => void;
  children?: ReactNode;
};

const defaultRenderItem = (row: KeyValueRow) => {
  const [primary, ...rest] = row.values;
  const secondary = rest.filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-[color:var(--glass-bg)] px-2 py-0.5 font-semibold text-[color:var(--text-primary)]">
        {primary}
      </span>
      <span className="truncate font-mono text-[color:var(--text-secondary)]">
        {secondary}
      </span>
    </div>
  );
};

export function KeyValueEditor({
  showEditor,
  mode,
  rows,
  textValue,
  columns,
  labels,
  summary,
  errorById,
  textPlaceholder,
  onToggleEditor,
  onAddRow,
  onClear,
  onModeChange,
  onApplyText,
  onCellChange,
  onRemoveRow,
  onTextChange,
  children,
}: KeyValueEditorProps) {
  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SecondaryButton size="sm" onClick={onToggleEditor}>
          {showEditor ? labels.hide : labels.edit}
        </SecondaryButton>
        {showEditor ? (
          <SecondaryButton size="sm" onClick={onAddRow}>
            {labels.add}
          </SecondaryButton>
        ) : null}
        {showEditor ? (
          <GhostButton size="sm" onClick={onClear}>
            {labels.clear}
          </GhostButton>
        ) : null}
        {showEditor ? (
          <SecondaryButton
            size="sm"
            onClick={() => onModeChange(mode === "list" ? "text" : "list")}
          >
            {mode === "list" ? labels.textMode : labels.listMode}
          </SecondaryButton>
        ) : null}
        {showEditor && mode === "text" && onApplyText ? (
          <SecondaryButton size="sm" onClick={onApplyText}>
            {labels.apply}
          </SecondaryButton>
        ) : null}
      </div>

      {!showEditor && summary ? (
        <div className="mt-3 rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3">
          {summary.preview && summary.preview.length ? (
            <div className="flex flex-col gap-2">
              {summary.label ? (
                <p className="text-xs text-[color:var(--text-secondary)]">
                  {summary.label}
                </p>
              ) : null}
              <div className="flex flex-col gap-1">
                {summary.preview.map((row) => (
                  <div key={row.id}>
                    {(summary.renderItem ?? defaultRenderItem)(row)}
                  </div>
                ))}
              </div>
              {summary.moreLabel ? (
                <span className="text-xs text-[color:var(--text-secondary)]">
                  {summary.moreLabel}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[color:var(--text-secondary)]">
              {summary.emptyLabel}
            </p>
          )}
        </div>
      ) : null}

      {showEditor ? (
        mode === "list" ? (
          <div className="mt-3 flex flex-col gap-3">
            {rows.length ? (
              rows.map((row) => {
                const errorMessage = errorById?.get(row.id);
                return (
                  <div
                    key={row.id}
                    className="rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {columns.map((column, index) => (
                        <ToolInput
                          key={`${row.id}-${index}`}
                          value={row.values[index] ?? ""}
                          onChange={(event) =>
                            onCellChange(row.id, index, event.target.value)
                          }
                          placeholder={column.placeholder}
                          className={
                            column.inputClassName ??
                            "min-w-[120px] flex-1 font-mono"
                          }
                        />
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveRow(row.id)}
                      >
                        {labels.remove}
                      </Button>
                    </div>
                    {errorMessage ? (
                      <p className="mt-2 text-xs text-rose-500/80">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[color:var(--text-secondary)]">
                {labels.empty}
              </p>
            )}
          </div>
        ) : (
          <ToolTextarea
            value={textValue}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={textPlaceholder ?? ""}
            spellCheck={false}
            className="mt-3 min-h-[160px]"
          />
        )
      ) : null}

      {children}
    </div>
  );
}
