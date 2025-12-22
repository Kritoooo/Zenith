import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-[20px]",
        className
      )}
      {...props}
    />
  );
}
