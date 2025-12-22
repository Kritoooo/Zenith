import Link from "next/link";

import { AppLayout } from "@/components/AppLayout";
import { BentoCard, BentoGrid } from "@/components/BentoGrid";
import { CommandPaletteTrigger } from "@/components/CommandPalette";
import { GithubIcon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";
import { toolMetas } from "@/tools/catalog";
import { CATEGORY_ACCENTS } from "@/tools/palette";

const iconButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] shadow-[var(--glass-shadow)] backdrop-blur-[16px] transition-colors hover:bg-[color:var(--glass-hover-bg)]";

export default function Home() {
  return (
    <AppLayout
      header={
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#007AFF,#4DA3FF)] text-lg font-semibold text-white shadow-[0_12px_24px_-14px_rgba(0,122,255,0.75)]">
              Z
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">Zenith</p>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Tools for perfectionists
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CommandPaletteTrigger />
            <ThemeToggle />
            <a
              className={iconButtonClass}
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
          </div>
        </header>
      }
      footer={
        <footer className="mt-10 text-xs text-[color:var(--text-secondary)]">
          (c) 2025 Zenith. Crafted for calm focus.
        </footer>
      }
    >
      <section className="mt-8">
        <BentoGrid>
          {toolMetas.map((meta) => (
            <BentoCard
              key={meta.slug}
              size={meta.size}
              className="group transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-22px_rgba(15,20,25,0.45)]"
            >
              <Link
                href={`/tool/${meta.slug}`}
                className="flex h-full w-full flex-col gap-4 rounded-[18px] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-[16px] text-[11px] font-semibold uppercase tracking-wide text-white shadow-[0_10px_20px_-14px_rgba(0,0,0,0.4)]"
                    style={{ backgroundColor: CATEGORY_ACCENTS[meta.category] }}
                  >
                    {meta.icon}
                  </div>
                  {meta.badge ? (
                    <span className="text-xs text-[color:var(--text-secondary)]">
                      {meta.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-auto space-y-2">
                  <h3
                    className={cn(
                      "text-lg font-semibold tracking-tight",
                      meta.size === "2x2" && "text-2xl"
                    )}
                  >
                    {meta.title}
                  </h3>
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    {meta.description}
                  </p>
                  {meta.highlights ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {meta.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] px-2.5 py-1 text-[11px] text-[color:var(--text-secondary)]"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
            </BentoCard>
          ))}
        </BentoGrid>
      </section>
    </AppLayout>
  );
}
