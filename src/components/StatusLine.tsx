import { cn } from "@/lib/cn";

type StatusLineProps = {
  text?: string | null;
  tone?: "normal" | "error";
  className?: string;
};

export function StatusLine({ text, tone = "normal", className }: StatusLineProps) {
  return (
    <p
      className={cn(
        "min-h-[1.25rem] text-xs",
        tone === "error"
          ? "text-rose-500/80"
          : "text-[color:var(--text-secondary)]",
        className
      )}
      aria-live="polite"
    >
      {text ?? ""}
    </p>
  );
}
