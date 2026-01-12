"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/cn";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const isAbsoluteUrl = (value: string) =>
  /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);

const isAnchor = (value: string) => value.startsWith("#");

const withBasePath = (value: string) =>
  value.startsWith("/") ? `${basePath}${value}` : value;

const resolveDocUrl = (value: string | undefined, slug: string) => {
  if (!value) return undefined;
  if (isAbsoluteUrl(value) || isAnchor(value)) return value;
  if (value.startsWith("/")) return withBasePath(value);
  return withBasePath(`/tools/${slug}/${value}`);
};

type ToolDocsProps = {
  slug: string;
  content: string;
  className?: string;
};

export function ToolDocs({ slug, content, className }: ToolDocsProps) {
  const [hasOpened, setHasOpened] = useState(false);

  if (!content.trim()) return null;

  return (
    <GlassCard className={cn("p-5 sm:p-7", className)}>
      <details
        className="group"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            setHasOpened(true);
          }
        }}
      >
        <summary className="cursor-pointer select-none text-sm font-semibold text-[color:var(--text-primary)]">
          文档
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-[color:var(--text-primary)]">
          {hasOpened ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ className: headingClass, ...props }) => (
                  <h2
                    className={cn(
                      "text-lg font-semibold tracking-tight text-[color:var(--text-primary)]",
                      headingClass
                    )}
                    {...props}
                  />
                ),
                h2: ({ className: headingClass, ...props }) => (
                  <h3
                    className={cn(
                      "text-base font-semibold tracking-tight text-[color:var(--text-primary)]",
                      headingClass
                    )}
                    {...props}
                  />
                ),
                h3: ({ className: headingClass, ...props }) => (
                  <h4
                    className={cn(
                      "text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]",
                      headingClass
                    )}
                    {...props}
                  />
                ),
                p: ({ className: paragraphClass, ...props }) => (
                  <p
                    className={cn(
                      "text-sm leading-relaxed text-[color:var(--text-secondary)]",
                      paragraphClass
                    )}
                    {...props}
                  />
                ),
                a: ({ className: linkClass, href, ...props }) => {
                  const resolvedHref = resolveDocUrl(href, slug);
                  const external = href ? isAbsoluteUrl(href) : false;
                  return (
                    <a
                      className={cn(
                        "font-medium text-[color:var(--accent-blue)] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[color:var(--accent-blue)]",
                        linkClass
                      )}
                      href={resolvedHref}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noreferrer" : undefined}
                      {...props}
                    />
                  );
                },
                ul: ({ className: listClass, ...props }) => (
                  <ul
                    className={cn(
                      "list-disc space-y-2 pl-5 text-[color:var(--text-secondary)]",
                      listClass
                    )}
                    {...props}
                  />
                ),
                ol: ({ className: listClass, ...props }) => (
                  <ol
                    className={cn(
                      "list-decimal space-y-2 pl-5 text-[color:var(--text-secondary)]",
                      listClass
                    )}
                    {...props}
                  />
                ),
                li: ({ className: listItemClass, ...props }) => (
                  <li className={cn("text-sm", listItemClass)} {...props} />
                ),
                blockquote: ({ className: quoteClass, ...props }) => (
                  <blockquote
                    className={cn(
                      "border-l-2 border-[color:var(--glass-border)] pl-4 text-[color:var(--text-secondary)]",
                      quoteClass
                    )}
                    {...props}
                  />
                ),
                code: ({ className: codeClass, ...props }) => {
                  const isBlock =
                    typeof codeClass === "string" &&
                    codeClass.includes("language-");
                  return (
                    <code
                      className={cn(
                        isBlock
                          ? "font-mono text-[12px] text-[color:var(--text-primary)]"
                          : "rounded bg-[color:var(--glass-recessed-bg)] px-1.5 py-0.5 text-[12px] text-[color:var(--text-primary)]",
                        codeClass
                      )}
                      {...props}
                    />
                  );
                },
                pre: ({ className: preClass, ...props }) => (
                  <pre
                    className={cn(
                      "overflow-auto rounded-[14px] border border-[color:var(--glass-border)] bg-[color:var(--glass-recessed-bg)] p-4 text-xs leading-relaxed text-[color:var(--text-primary)]",
                      preClass
                    )}
                    {...props}
                  />
                ),
                hr: ({ className: hrClass, ...props }) => (
                  <hr
                    className={cn("border-[color:var(--glass-border)]", hrClass)}
                    {...props}
                  />
                ),
                table: ({ className: tableClass, ...props }) => (
                  <div className="overflow-auto">
                    <table
                      className={cn(
                        "w-full border-collapse text-left text-xs",
                        tableClass
                      )}
                      {...props}
                    />
                  </div>
                ),
                th: ({ className: cellClass, ...props }) => (
                  <th
                    className={cn(
                      "border-b border-[color:var(--glass-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]",
                      cellClass
                    )}
                    {...props}
                  />
                ),
                td: ({ className: cellClass, ...props }) => (
                  <td
                    className={cn(
                      "border-b border-[color:var(--glass-border)] px-3 py-2 text-[color:var(--text-secondary)]",
                      cellClass
                    )}
                    {...props}
                  />
                ),
                img: ({ className: imageClass, src, alt, ...props }) => {
                  const resolvedSrc =
                    typeof src === "string" ? resolveDocUrl(src, slug) : undefined;
                  return (
                    <img
                      className={cn(
                        "max-w-full rounded-[14px] border border-[color:var(--glass-border)]",
                        imageClass
                      )}
                      src={resolvedSrc}
                      alt={alt ?? ""}
                      loading="lazy"
                      {...props}
                    />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          ) : null}
        </div>
      </details>
    </GlassCard>
  );
}
