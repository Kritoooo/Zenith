import { PrimaryButton, SecondaryButton } from "@/components/Button";
import { StatusLine } from "@/components/StatusLine";
import { ToolPanel } from "@/components/ToolPanel";
import { ToolTextarea } from "@/components/ToolTextarea";

type OutputPanelProps = {
  title: string;
  extractLabel: string;
  copyLabel: string;
  onExtract: () => void;
  onCopy: () => void;
  copyDisabled: boolean;
  status: string;
  statusTone: "normal" | "error";
  output: string;
  placeholder: string;
};

export function OutputPanel({
  title,
  extractLabel,
  copyLabel,
  onExtract,
  onCopy,
  copyDisabled,
  status,
  statusTone,
  output,
  placeholder,
}: OutputPanelProps) {
  return (
    <ToolPanel
      title={title}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton onClick={onExtract}>{extractLabel}</PrimaryButton>
          <SecondaryButton onClick={onCopy} disabled={copyDisabled}>
            {copyLabel}
          </SecondaryButton>
        </div>
      }
      headerClassName="flex flex-wrap items-center justify-between gap-2"
      actionsClassName="flex flex-wrap items-center gap-2"
      className="min-h-[240px]"
    >
      <StatusLine text={status} tone={statusTone} />
      <ToolTextarea
        value={output}
        readOnly
        spellCheck={false}
        placeholder={placeholder}
        className="mt-3 min-h-[200px]"
      />
    </ToolPanel>
  );
}
