import { Button, SecondaryButton } from "@/components/Button";
import { ToolInput } from "@/components/ToolInput";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";

type PathsPanelProps = {
  title: string;
  detectLabel: string;
  selectAllLabel: string;
  selectFilteredLabel: string;
  clearSelectionLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  detectedLabel: string;
  selectedLabel: string;
  filteredPaths: string[];
  selectedPaths: Set<string>;
  onDetect: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onTogglePath: (path: string) => void;
  manualTitle: string;
  manualValue: string;
  manualPlaceholder: string;
  onManualChange: (value: string) => void;
  hint: string;
  isSelectAllDisabled: boolean;
  isClearSelectionDisabled: boolean;
  emptyNoPathsLabel: string;
  emptyNoMatchesLabel: string;
};

export function PathsPanel({
  title,
  detectLabel,
  selectAllLabel,
  selectFilteredLabel,
  clearSelectionLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  detectedLabel,
  selectedLabel,
  filteredPaths,
  selectedPaths,
  onDetect,
  onSelectAll,
  onClearSelection,
  onTogglePath,
  manualTitle,
  manualValue,
  manualPlaceholder,
  onManualChange,
  hint,
  isSelectAllDisabled,
  isClearSelectionDisabled,
  emptyNoPathsLabel,
  emptyNoMatchesLabel,
}: PathsPanelProps) {
  const hasSearch = searchValue.trim().length > 0;

  return (
    <ToolPanel
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton size="sm" onClick={onDetect}>
            {detectLabel}
          </SecondaryButton>
          <SecondaryButton size="sm" onClick={onSelectAll} disabled={isSelectAllDisabled}>
            {hasSearch ? selectFilteredLabel : selectAllLabel}
          </SecondaryButton>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isClearSelectionDisabled}
          >
            {clearSelectionLabel}
          </Button>
        </div>
      }
      headerClassName="flex flex-wrap items-center justify-between gap-2"
      actionsClassName="flex flex-wrap items-center gap-2"
    >
      <ToolInput
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        spellCheck={false}
        className="mt-3"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--text-secondary)]">
        <span>{detectedLabel}</span>
        <span>{selectedLabel}</span>
      </div>
      <div className="mt-3 max-h-[220px] overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-2">
        {filteredPaths.length === 0 ? (
          <p className="px-2 py-3 text-xs text-[color:var(--text-secondary)]">
            {hasSearch ? emptyNoMatchesLabel : emptyNoPathsLabel}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredPaths.map((path) => (
              <label
                key={path}
                className="flex items-start gap-2 rounded-[10px] px-2 py-1 text-xs text-[color:var(--text-primary)] hover:bg-[color:var(--glass-hover-bg)]"
              >
                <input
                  type="checkbox"
                  checked={selectedPaths.has(path)}
                  onChange={() => onTogglePath(path)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--accent-blue)]"
                />
                <span className="font-mono leading-relaxed">{path}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          {manualTitle}
        </p>
        <ToolTextarea
          value={manualValue}
          onChange={(event) => onManualChange(event.target.value)}
          placeholder={manualPlaceholder}
          spellCheck={false}
          className="mt-2 min-h-[110px] font-mono"
        />
      </div>
      <p className="mt-2 text-xs text-[color:var(--text-secondary)]">{hint}</p>
    </ToolPanel>
  );
}
