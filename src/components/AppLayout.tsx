import type { ReactNode } from "react";

import { CommandPaletteProvider } from "@/components/CommandPalette";
import { cn } from "@/lib/cn";

type AppLayoutProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function AppLayout({ children, header, footer, className }: AppLayoutProps) {
  return (
    <CommandPaletteProvider>
      <div className={cn("min-h-screen text-[color:var(--text-primary)]", className)}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10 2xl:max-w-[1600px]">
          {header}
          <main className="flex min-h-0 flex-1 flex-col">{children}</main>
          {footer}
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
