import { cn } from "@/lib/cn";

type ToolPlaceholderProps = {
  inputLabel?: string;
  outputLabel?: string;
  primaryAction?: string;
  secondaryAction?: string;
  note?: string;
  className?: string;
};

export function ToolPlaceholder({
  inputLabel = "Input",
  outputLabel = "Output",
  primaryAction = "Run",
  secondaryAction = "Copy",
  note,
  className,
}: ToolPlaceholderProps) {
  return (
    <div className={cn("flex h-full flex-col gap-5", className)}>
      <section className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          {inputLabel}
        </p>
        <div className="mt-3 flex-1 rounded-[14px] bg-[color:var(--glass-recessed-bg)]" />
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-[color:var(--accent-blue)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.6)]"
        >
          {primaryAction}
        </button>
        <button
          type="button"
          className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-4 py-2 text-sm text-[color:var(--text-primary)] shadow-[var(--glass-shadow)]"
        >
          {secondaryAction}
        </button>
      </div>
      <section className="flex min-h-[260px] flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {outputLabel}
          </p>
          {note ? (
            <span className="text-[11px] text-[color:var(--text-secondary)]">
              {note}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex-1 rounded-[14px] bg-[color:var(--glass-recessed-bg)]" />
      </section>
    </div>
  );
}
