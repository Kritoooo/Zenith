import type { ReactNode } from "react";

import { KeyValueEditor, type KeyValueEditorLabels, type KeyValueEditorSummary, type KeyValueRow } from "@/components/KeyValueEditor";
import type { FieldPattern } from "@/lib/fieldPatterns";

export type FieldPatternRow = {
  id: string;
  name: string;
  pattern: string;
};

type FieldPatternEditorLabels = {
  edit: string;
  hide: string;
  add: string;
  clear: string;
  remove: string;
  textMode: string;
  listMode: string;
  apply: string;
  fieldNamePlaceholder: string;
  fieldPatternPlaceholder: string;
  textPlaceholder: string;
  empty: string;
};

type FieldPatternEditorSummary = {
  label?: string;
  emptyLabel: string;
  preview: FieldPattern[];
  moreLabel?: string;
};

type FieldPatternEditorProps = {
  showEditor: boolean;
  mode: "list" | "text";
  rows: FieldPatternRow[];
  textValue: string;
  summary?: FieldPatternEditorSummary;
  errorById?: Map<string, string>;
  labels: FieldPatternEditorLabels;
  onToggleEditor: () => void;
  onAddRow: () => void;
  onClear: () => void;
  onModeChange: (mode: "list" | "text") => void;
  onApplyText?: () => void;
  onRowChange: (id: string, patch: Partial<FieldPatternRow>) => void;
  onRemoveRow: (id: string) => void;
  onTextChange: (value: string) => void;
  children?: ReactNode;
};

const mapRows = (rows: FieldPatternRow[]): KeyValueRow[] =>
  rows.map((row) => ({ id: row.id, values: [row.name, row.pattern] }));

const mapSummary = (
  summary?: FieldPatternEditorSummary
): KeyValueEditorSummary | undefined => {
  if (!summary) return undefined;
  return {
    label: summary.label,
    emptyLabel: summary.emptyLabel,
    preview: summary.preview.map((item) => ({
      id: `${item.name}-${item.pattern}`,
      values: [item.name, item.pattern],
    })),
    moreLabel: summary.moreLabel,
  };
};

export function FieldPatternEditor({
  showEditor,
  mode,
  rows,
  textValue,
  summary,
  errorById,
  labels,
  onToggleEditor,
  onAddRow,
  onClear,
  onModeChange,
  onApplyText,
  onRowChange,
  onRemoveRow,
  onTextChange,
  children,
}: FieldPatternEditorProps) {
  const keyValueLabels: KeyValueEditorLabels = {
    edit: labels.edit,
    hide: labels.hide,
    add: labels.add,
    clear: labels.clear,
    remove: labels.remove,
    textMode: labels.textMode,
    listMode: labels.listMode,
    apply: labels.apply,
    empty: labels.empty,
  };

  return (
    <KeyValueEditor
      showEditor={showEditor}
      mode={mode}
      rows={mapRows(rows)}
      textValue={textValue}
      columns={[
        {
          placeholder: labels.fieldNamePlaceholder,
          inputClassName: "min-w-[120px] flex-1",
        },
        {
          placeholder: labels.fieldPatternPlaceholder,
          inputClassName: "min-w-[180px] flex-[2] font-mono",
        },
      ]}
      labels={keyValueLabels}
      summary={mapSummary(summary)}
      errorById={errorById}
      textPlaceholder={labels.textPlaceholder}
      onToggleEditor={onToggleEditor}
      onAddRow={onAddRow}
      onClear={onClear}
      onModeChange={onModeChange}
      onApplyText={onApplyText}
      onCellChange={(id, index, value) => {
        onRowChange(id, index === 0 ? { name: value } : { pattern: value });
      }}
      onRemoveRow={onRemoveRow}
      onTextChange={onTextChange}
    >
      {children}
    </KeyValueEditor>
  );
}
