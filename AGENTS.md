# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router pages, layout, and dynamic tool routes (e.g., `src/app/tool/[slug]`).
- `src/components`: shared UI building blocks (glass cards, bento grid, command palette).
- `src/tools`: plug-in style tools. Each tool lives in `src/tools/<slug>/` with `index.tsx` (UI/logic) and `meta.ts` (registration metadata). `src/tools/catalog.ts` powers discovery, and `src/tools/registry.ts` maps slugs to components.
- `public`: static assets.
- `docs/ARCHITECTURE.md`: high-level design notes and implementation plan.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: run the local dev server (http://localhost:3000).
- `npm run build`: create a production build.
- `npm run start`: serve the production build (run after `build`).
- `npm run lint`: run ESLint checks.

## Coding Style & Naming Conventions
- TypeScript + React (TSX). Follow existing formatting; files use 2-space indentation.
- Components: PascalCase file names (e.g., `GlassCard.tsx`), hooks camelCase.
- Tools: kebab-case directory names (e.g., `src/tools/json-formatter`), export a default component and a `meta.ts` that conforms to `ToolMeta`.
- Styling: Tailwind utilities with shared tokens in `src/app/globals.css`; prefer existing glassmorphism variables over ad hoc colors.

## Testing Guidelines
- No test runner or coverage target is configured yet.
- If you introduce tests, use `*.test.ts` / `*.test.tsx` (or `__tests__/`) under `src/`, and add scripts to `package.json` to run them.

## Commit & Pull Request Guidelines
- Current history uses short, imperative subjects (e.g., “Initial skeleton”). Keep messages concise and action-oriented; add a scope when helpful.
- PRs should include: a clear summary, linked issue (if any), screenshots for UI changes, and the commands run (e.g., `npm run lint`).

## Configuration & Security
- No environment variables are required today. If you add any, use `.env.local` and avoid committing secrets.
