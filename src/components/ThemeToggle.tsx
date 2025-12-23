"use client";

import { useEffect, useState } from "react";

import { MoonIcon, SunIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";

type ThemeToggleProps = {
  className?: string;
};

const STORAGE_KEY = "zenith-theme";

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = saved ?? (prefersDark ? "dark" : "light");
    const id = window.setTimeout(() => {
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const toggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
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
