# CLAUDE.md — Project Instructions for AI Assistants

## Project Overview

This is a Next.js 15 application using React 19, Supabase, and Tailwind CSS. Deployed on Vercel.

## Package Manager

**This project uses `pnpm`. Never use `npm` or `yarn`.**

- Install dependencies: `pnpm install`
- Add a package: `pnpm add <package>`
- Add a dev dependency: `pnpm add -D <package>`
- **NEVER run `npm install`** — it generates a `package-lock.json` which conflicts with `pnpm-lock.yaml`
- **NEVER commit `pnpm-lock.yaml` changes** unless you are explicitly asked to add or update a dependency. Lock file diffs cause merge conflicts on nearly every PR.
- If you must add a dependency, do it in a dedicated commit so the lock file change is isolated and easy to resolve.
- If `package-lock.json` is accidentally generated, delete it immediately and do not commit it.

## Development Commands

- `pnpm dev` — Start dev server
- `pnpm build` — Production build
- `pnpm lint` — Run ESLint
- `pnpm test` — Run Vitest tests
- `pnpm test:watch` — Run tests in watch mode

## Code Style & Conventions

- TypeScript for all new files
- Use `@/` path aliases for imports (maps to project root)
- UI components use shadcn/ui (Radix primitives + Tailwind)
- Server actions in `app/actions/`
- API routes in `app/api/`

## Git & PR Practices

- Keep PRs focused — one feature or fix per PR
- Do not include unrelated file changes (especially lock files) in PRs
- Write clear commit messages describing the "why", not just the "what"

---

## Mistakes Log

> This section tracks recurring mistakes so they are not repeated. Add new entries when a pattern of errors is identified.

### 1. Lock file conflicts in PRs (2025)

**Problem:** Committing `pnpm-lock.yaml` changes alongside feature work caused merge conflicts on nearly every PR, blocking merges and requiring manual resolution.

**Root cause:** Running `npm install` instead of `pnpm install`, or including lock file diffs when no dependency was intentionally added.

**Fix:** Always use `pnpm`. Never commit lock file changes unless a dependency was explicitly added/updated. Isolate dependency changes in their own commit.

---

*When you encounter a new recurring mistake, add it here with the problem, root cause, and fix so it won't happen again.*
