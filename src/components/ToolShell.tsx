import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowLeftIcon } from "@/components/Icons";
import { GlassCard } from "@/components/GlassCard";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type ToolShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  locale?: string;
};

export function ToolShell({
  title,
  description,
  children,
  className,
  locale,
}: ToolShellProps) {
  const t = useTranslations("toolShell");

  return (
    <GlassCard className={cn("flex flex-1 flex-col p-5 sm:p-7", className)}>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          locale={locale}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] backdrop-blur-[16px] transition-transform hover:-translate-y-0.5"
          aria-label={t("backToHome")}
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h1>
        <div className="h-9 w-9" aria-hidden />
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
        {description ? (
          <p className="text-sm text-[color:var(--text-secondary)]">
            {description}
          </p>
        ) : null}
        <div className="flex min-h-[360px] flex-1 flex-col rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
          {children}
        </div>
      </div>
    </GlassCard>
  );
}
