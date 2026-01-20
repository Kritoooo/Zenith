import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/cn";

const baseClassName =
  "w-full rounded-[12px] border border-transparent bg-[color:var(--glass-recessed-bg)] px-3 py-2 text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-blue)]";

export const ToolInputCompact = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(baseClassName, className)} {...props} />
));

ToolInputCompact.displayName = "ToolInputCompact";
