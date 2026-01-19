import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const baseClassName =
  "w-full rounded-[14px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none";

type ToolInputProps = ComponentPropsWithoutRef<"input"> & {
  focusBorderClassName?: string;
};

export const ToolInput = forwardRef<HTMLInputElement, ToolInputProps>(
  ({ className, focusBorderClassName = "focus:border-[color:var(--accent-blue)]", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(baseClassName, focusBorderClassName, className)}
      {...props}
    />
  )
);

ToolInput.displayName = "ToolInput";
