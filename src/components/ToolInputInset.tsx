import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const baseClassName =
  "w-full rounded-[12px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-[color:var(--text-primary)]";

export const ToolInputInset = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(baseClassName, className)} {...props} />
));

ToolInputInset.displayName = "ToolInputInset";
