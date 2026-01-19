import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const baseClassName =
  "w-full flex-1 resize-none rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] p-3 text-sm leading-relaxed text-[color:var(--text-primary)] outline-none";

type ToolTextareaProps = ComponentPropsWithoutRef<"textarea"> & {
  focusBorderClassName?: string;
};

export const ToolTextarea = forwardRef<HTMLTextAreaElement, ToolTextareaProps>(
  ({ className, focusBorderClassName = "focus:border-[color:var(--accent-blue)]", ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseClassName, focusBorderClassName, className)}
      {...props}
    />
  )
);

ToolTextarea.displayName = "ToolTextarea";
