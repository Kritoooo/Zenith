"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { MoonIcon, SunIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";

type ThemeToggleProps = {
  className?: string;
};

const STORAGE_KEY = "zenith-theme";

export function ThemeToggle({ className }: ThemeToggleProps) {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.dataset.theme;
      if (current === "light" || current === "dark") {
        return current;
      }
    }
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === "light" || saved === "dark") {
        return saved;
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }, [theme]);

  const toggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("toggle")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] backdrop-blur-[16px]",
        "transition-colors hover:bg-[color:var(--glass-hover-bg)]",
        className
      )}
    >
      {theme === "dark" ? (
        <SunIcon className="h-4 w-4" />
      ) : (
        <MoonIcon className="h-4 w-4" />
      )}
    </button>
  );
}
