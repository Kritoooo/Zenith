import { GhostButton } from "@/components/Button";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";

type InputPanelProps = {
  title: string;
  input: string;
  placeholder: string;
  sampleLabel: string;
  clearLabel: string;
  onChange: (value: string) => void;
  onSample: () => void;
  onClear: () => void;
};

export function InputPanel({
  title,
  input,
  placeholder,
  sampleLabel,
  clearLabel,
  onChange,
  onSample,
  onClear,
}: InputPanelProps) {
  return (
    <ToolPanel
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={onSample}>{sampleLabel}</GhostButton>
          <GhostButton onClick={onClear}>{clearLabel}</GhostButton>
        </div>
      }
      headerClassName="flex flex-wrap items-center justify-between gap-2"
      actionsClassName="flex flex-wrap items-center gap-2"
      className="min-h-[280px]"
    >
      <ToolTextarea
        value={input}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="mt-3 min-h-[220px]"
      />
    </ToolPanel>
  );
}
