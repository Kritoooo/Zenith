import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { GlassCard } from "@/components/GlassCard";

export type BentoSize = "1x1" | "2x1" | "2x2";

const sizeClasses: Record<BentoSize, string> = {
  "1x1": "col-span-1 row-span-1",
  "2x1": "col-span-2 row-span-1",
  "2x2": "col-span-2 row-span-2",
};

type BentoGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function BentoGrid({ className, children, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid auto-rows-[200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        "grid-flow-dense",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type BentoCardProps = HTMLAttributes<HTMLDivElement> & {
  size?: BentoSize;
};

export function BentoCard({ size = "1x1", className, ...props }: BentoCardProps) {
  return (
    <GlassCard
      className={cn(
        "flex h-full w-full flex-col",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
