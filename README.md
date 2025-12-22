# Zenith (致顶)

Apple‑style bento grid toolbox with glassmorphism UI and a plug‑in tool registry.

## Quick Start
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Scripts
- `npm run dev`: start local dev server.
- `npm run build`: production build.
- `npm run start`: run production server.
- `npm run lint`: run ESLint.

## Project Structure
```
src/
  app/                # Next.js App Router pages
  components/         # UI building blocks (GlassCard, BentoGrid, etc.)
  tools/              # Tools registry + tool implementations
docs/ARCHITECTURE.md  # Design notes and plan
```

## Adding a Tool
1. Create `src/tools/<slug>/index.tsx` (tool UI + logic).
2. Create `src/tools/<slug>/meta.ts` (ToolMeta).
3. Register the meta in `src/tools/catalog.ts` and component in `src/tools/registry.ts`.
4. The card appears on `/` and the route is `/tool/<slug>`.

## Notes
- Styling uses Tailwind utilities with glassmorphism tokens in `src/app/globals.css`.
- Command palette: press `Cmd/Ctrl + K` to search tools.
