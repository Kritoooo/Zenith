import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type ToolPanelProps = {
  as?: "div" | "section" | "article";
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  actionsClassName?: string;
};

export function ToolPanel({
  as = "div",
  title,
  actions,
  children,
  className,
  headerClassName,
  titleClassName,
  actionsClassName,
}: ToolPanelProps) {
  const hasHeader = Boolean(title || actions);
  const Element = as;

  return (
    <Element
      className={cn(
        "flex flex-1 flex-col rounded-[16px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4",
        className
      )}
    >
      {hasHeader ? (
        <div className={cn("flex items-center justify-between gap-2", headerClassName)}>
          {title ? (
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]",
                titleClassName
              )}
            >
              {title}
            </p>
          ) : null}
          {actions ? (
            <div className={cn("flex items-center gap-2", actionsClassName)}>
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </Element>
  );
}
