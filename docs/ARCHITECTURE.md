# Zenith Architecture + Plan (Pre-Coding)

## Goals
- Deliver an Apple-style bento grid dashboard with glassmorphism cards.
- Keep navigation flat: Home -> Tool detail only.
- Ensure tools are plug-in style and registered via metadata.
- Make design tokens enforce Apple-like visual consistency.

## Non-Goals (Phase 1)
- No complex auth, accounts, or persistence.
- No server-side tool execution; client-only tools first.
- No multi-level navigation or modal routing.

## Proposed Stack
- Next.js App Router (app/)
- Tailwind CSS for tokens + utility layout
- Lucide or similar icon set (subject to approval)
- Optional: Monaco for JSON editor in MVP tool set

## Information Architecture
- `/` Home dashboard with bento grid of tools
- `/tool/[slug]` Tool shell + dynamic tool component

## Core Directory Layout
```
src/
  app/
    page.tsx
    tool/
      [slug]/page.tsx
  components/
    AppLayout.tsx
    GlassCard.tsx
    BentoGrid.tsx
    ToolShell.tsx
    Icon.tsx
  tools/
    registry.ts
    base64/
      index.tsx
      meta.ts
```

## Design Tokens (CSS Variables)
Define tokens once in global styles:
- `--glass-bg` for light/dark (rgba)
- `--glass-border` and `--glass-shadow`
- `--card-radius: 20px`
- `--blur-strong: 20px`
- `--accent-blue`, `--accent-orange`, etc.

## Components
- `AppLayout`: global background, header, footer.
- `GlassCard`: base container; blur + border + shadow.
- `BentoGrid`: CSS grid wrapper + size mapping.
- `ToolShell`: tool detail layout (title bar + workspace).

## Bento Grid Strategy
- Use CSS Grid with `grid-auto-flow: dense` to pack gaps.
- Map size tokens to spans:
  - `1x1` -> `col-span-1 row-span-1`
  - `2x1` -> `col-span-2 row-span-1`
  - `2x2` -> `col-span-2 row-span-2`
- Responsive columns:
  - mobile: 1 column
  - tablet: 2 columns
  - desktop: 4-6 columns, auto-fit

## Tool Registration Model
- `tools/*/meta.ts` exports metadata with `id`, `slug`, `title`, `description`, `icon`, `category`, `size`.
- `tools/*/index.tsx` exports a default React component.
- `tools/registry.ts` imports metadata and component references.
- Home page consumes `registry` to build cards.
- Tool route resolves `slug` to component and renders it inside `ToolShell`.

## Data Flow
- Static registry list at build time.
- No external API in Phase 1.
- Tool components manage their own state locally.

## Visual/Interaction Notes
- Hover: `translateY(-2px)` + soft glow, no scale.
- Title bar includes a blurred back button pill.
- Inputs are recessed panels with slightly darker glass.

## Phased Implementation Plan
Phase 1: Skeleton
- Create AppLayout + GlassCard + BentoGrid + ToolShell.
- Implement `/` and `/tool/[slug]` with placeholder tools.

Phase 2: MVP Tools
- JSON formatter
- CSS color converter
- Image compression (Wasm)

Phase 3: Polish
- View Transitions API
- Cmd+K search UI

## Open Questions
- Icon set preference (Lucide vs SF Symbols-like custom)?
- Do we allow tool grouping or only visual categories?
- Preferred font loading strategy if system font is default?
