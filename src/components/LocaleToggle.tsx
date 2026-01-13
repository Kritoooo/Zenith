"use client";

import { useLocale, useTranslations } from "next-intl";

import { localeLabels } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type LocaleToggleProps = {
  className?: string;
};

export function LocaleToggle({ className }: LocaleToggleProps) {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();

  const nextLocale = locale === "en" ? "zh" : "en";

  const toggleLocale = () => {
    const query =
      typeof window !== "undefined" ? window.location.search : "";
    const href = query ? `${pathname}${query}` : pathname;
    router.replace(href, { locale: nextLocale });
  };

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t("locale.toggle")}
      className={cn(
        "flex h-9 min-w-[44px] items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2 text-xs font-semibold text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] backdrop-blur-[16px]",
        "transition-colors hover:bg-[color:var(--glass-hover-bg)]",
        className
      )}
    >
      {localeLabels[nextLocale]}
    </button>
  );
}
