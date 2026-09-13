# Agent Instructions

This repo is an Astro app with React islands and Supabase-backed auth/data flows. Keep agent work focused on the current source of truth in `src/` and `package.json`; the current `README.md` is still starter boilerplate and should not be treated as authoritative.

## Working Rules

- Use `npm run dev`, `npm run build`, and `npm run preview` for local validation; there is no dedicated test, lint, or typecheck script in `package.json`.
- Prefer Astro frontmatter for page data loading and server-side decisions; use React only for interactive islands.
- Keep shared Supabase logic in [src/lib/supabase.ts](src/lib/supabase.ts).
- Treat [src/middleware.ts](src/middleware.ts) as the place where protected routes are enforced; update it when adding new private pages.
- Keep auth callbacks and data mutations inside API routes under [src/pages/api](src/pages/api).

## Editing Conventions

- Preserve existing Supabase cookie handling, redirect behavior, and server/client boundaries.
- When touching course or tee data, keep the existing fallback shapes intact rather than normalizing them aggressively.
- Avoid broad refactors across pages, components, and API routes in one change unless the request explicitly needs it.

## Useful References

- [package.json](package.json)
- [src/layouts/Layout.astro](src/layouts/Layout.astro)
- [src/components/AddRound.jsx](src/components/AddRound.jsx)
- [src/pages/api/rounds/create.ts](src/pages/api/rounds/create.ts)