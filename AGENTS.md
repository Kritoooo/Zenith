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
- `npm run i18n:check`: validate translation keys across locales (CI gate).

## Coding Style & Naming Conventions
- TypeScript + React (TSX). Follow existing formatting; files use 2-space indentation.
- Components: PascalCase file names (e.g., `GlassCard.tsx`), hooks camelCase.
- Tools: kebab-case directory names (e.g., `src/tools/json-formatter`), export a default component and a `meta.ts` that conforms to `ToolMeta`.
- Styling: Tailwind utilities with shared tokens in `src/app/globals.css`; prefer existing glassmorphism variables over ad hoc colors.

## New Tool Requirements
- Structure: add tools under `src/tools/<slug>/` (kebab-case). Each tool must include `index.tsx` (default export component) and `meta.ts` (conforms to `ToolMeta`).
- Docs: every tool must include `docs.md` or `README.md` for the detail page. Recommended sections: “Features / Steps / Notes”.
- Registration: import and append `meta` in `src/tools/catalog.ts`; add a dynamic import in `src/tools/registry.ts`.
- Categories: if you add a new category, update both `src/tools/types.ts` and `src/tools/palette.ts`.
- Assets & styles: place static assets in `public/`. Prefer glassmorphism tokens in `src/app/globals.css` and Tailwind utilities.

## i18n Rules
- All translation keys referenced in code must exist in every locale file under `messages/` (validated by `npm run i18n:check`).
- Add new keys in both `messages/en.json` and `messages/zh.json` at the same time.

## Communication & Language
- Documentation and repository guidance should be written in English.
- Responses should be in Chinese.
- Code-related content must be in English, except for i18n text values.

## Testing Guidelines
- No test runner or coverage target is configured yet.
- If you introduce tests, use `*.test.ts` / `*.test.tsx` (or `__tests__/`) under `src/`, and add scripts to `package.json` to run them.

## Required Verification
- After completing any feature, run: `npm run lint`, `npm run build`, and `npm run i18n:check`.
- Fix any errors from these checks before considering the task done.

## Commit & Pull Request Guidelines
- Current history uses short, imperative subjects (e.g., “Initial skeleton”). Keep messages concise and action-oriented; add a scope when helpful.
- PRs should include: a clear summary, linked issue (if any), screenshots for UI changes, and the commands run (e.g., `npm run lint`).

## Configuration & Security
- No environment variables are required today. If you add any, use `.env.local` and avoid committing secrets.
