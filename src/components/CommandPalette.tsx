"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchIcon } from "@/components/Icons";
import { cn } from "@/lib/cn";
import { toolMetas } from "@/tools/catalog";
import { CATEGORY_ACCENTS } from "@/tools/palette";

type CommandPaletteContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

type CommandPaletteProviderProps = {
  children: ReactNode;
};

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const tools = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return toolMetas;
    return toolMetas.filter((meta) => {
      const haystack = `${meta.title} ${meta.description} ${meta.slug}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (tools.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => (prev < 0 || prev >= tools.length ? 0 : prev));
  }, [isOpen, tools.length]);

  useEffect(() => {
    if (!listRef.current || activeIndex < 0) return;
    const node = listRef.current.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  const goToTool = (slug: string) => {
    setIsOpen(false);
    router.push(`/tool/${slug}`);
  };

  return (
    <CommandPaletteContext.Provider value={{ open, close, toggle, isOpen }}>
      {children}
      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={close}
            aria-label="Close search"
          />
          <div className="relative mx-auto mt-16 w-full max-w-2xl px-4 sm:mt-24">
            <div
              className="rounded-[26px] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4 shadow-[0_24px_60px_-40px_rgba(15,20,25,0.65)] backdrop-blur-[24px]"
              role="dialog"
              aria-modal="true"
              aria-label="Search tools"
            >
              <div className="flex items-center gap-3 rounded-[18px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] px-4 py-3">
                <SearchIcon className="h-4 w-4 text-[color:var(--text-secondary)]" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      if (tools.length === 0) return;
                      setActiveIndex((prev) =>
                        prev < 0 ? 0 : (prev + 1) % tools.length
                      );
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      if (tools.length === 0) return;
                      setActiveIndex((prev) =>
                        prev <= 0 ? tools.length - 1 : prev - 1
                      );
                      return;
                    }
                    if (event.key === "Enter" && tools[0]) {
                      event.preventDefault();
                      const target = tools[activeIndex] ?? tools[0];
                      if (target) goToTool(target.slug);
                    }
                  }}
                  placeholder="Search tools..."
                  className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none"
                />
                <span className="hidden rounded-full border border-[color:var(--glass-border)] px-2 py-1 text-[10px] uppercase tracking-widest text-[color:var(--text-secondary)] sm:inline-flex">
                  Cmd + K
                </span>
              </div>
              <div
                ref={listRef}
                className="mt-4 max-h-[55vh] overflow-y-auto pr-1"
                role="listbox"
              >
                {tools.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-[color:var(--glass-border)] p-6 text-center text-sm text-[color:var(--text-secondary)]">
                    No tools match that query.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tools.map((meta, index) => (
                      <button
                        key={meta.slug}
                        type="button"
                        onClick={() => goToTool(meta.slug)}
                        onMouseEnter={() => setActiveIndex(index)}
                        data-index={index}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-[18px] px-3 py-2 text-left transition-colors hover:bg-[color:var(--glass-hover-bg)]",
                          index === activeIndex &&
                            "bg-[color:var(--glass-hover-bg)] ring-1 ring-[color:var(--glass-border)]"
                        )}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center rounded-[14px] text-[11px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: CATEGORY_ACCENTS[meta.category] }}
                        >
                          {meta.icon}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {meta.title}
                          </p>
                          <p className="text-xs text-[color:var(--text-secondary)]">
                            {meta.description}
                          </p>
                        </div>
                        <span className="text-xs text-[color:var(--text-secondary)]">
                          /tool/{meta.slug}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    return {
      open: () => {},
      close: () => {},
      toggle: () => {},
      isOpen: false,
    };
  }
  return context;
}

type CommandPaletteTriggerProps = {
  className?: string;
};

export function CommandPaletteTrigger({ className }: CommandPaletteTriggerProps) {
  const { open } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] backdrop-blur-[16px] transition-colors hover:bg-[color:var(--glass-hover-bg)]",
        className
      )}
      aria-label="Search"
    >
      <SearchIcon className="h-4 w-4" />
    </button>
  );
}
