# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finnit Assistant is a cross-platform personal finance assistant built as a Turborepo monorepo. It helps users manage income, expenses, debts, savings, and projections through a guided experience with AI-assisted categorization and bank integrations.

**Stack:** NestJS GraphQL API · React Native (Expo) · PostgreSQL (Prisma) · Turborepo · pnpm workspaces

## Guardrails (Non-Negotiables)

- **Language and Style**: Strict TypeScript throughout the repo; code and naming in **English** (UI copy can be localized separately).
- **DB/Prisma**: Use **snake_case** for tables and columns in SQL; 1:1 relationships require `@unique`; avoid destructive cascades except in pivot tables; every migration must have a documented **rollback script**.
- **GraphQL**: Code-first in NestJS; strict inputs vs outputs; **cursor-based** pagination; typed errors.
- **Commits/PRs**: *Conventional Commits* conventions; each PR includes: summary, risks, affected migrations, test steps, and rollback plan.
- **Minimum DoD**: clean lints and types; tests pass; `docs/prd.md` updates *Scope implemented* section; migration applied and verified locally.

## Current Implementation Status (as of 2026-10-11)

### ✅ Backend API — feature complete
All 11 GraphQL modules implemented in `apps/api/`:

| Module | Location |
|--------|----------|
| Auth | `src/modules/auth/` |
| Users | `src/modules/users/` |
| Accounts | `src/modules/accounts/` |
| Categories | `src/modules/categories/` |
| Transactions | `src/modules/transactions/` |
| Transfers | `src/modules/transfers/` |
| Budgets | `src/modules/budgets/` |
| Goals | `src/modules/goals/` |
| Debts | `src/modules/debts/` |
| Notifications | `src/modules/notifications/` |
| Reports | `src/modules/reports/` |

Auto-generated schema at `apps/api/src/schema.gql`.

Unit tests exist for auth (service + resolver), accounts, budgets, debts, goals, transactions. Missing: categories, transfers, notifications, reports, users. No E2E tests and no CI workflow (only Claude GitHub workflows).

### 🟡 Mobile App — UI built, data mostly mocked
`apps/finnit-app/` is an Expo Router app styled with NativeWind v5:
- Routes: `app/login.tsx`, `app/(app)/` group (dashboard, history, cards, calendar, analytics, settings) with a custom `BottomNavBar`. Route files re-export screens from `screens/`.
- Auth: `contexts/AuthContext.tsx` calls the `signIn` mutation via urql (`lib/graphql/client.ts`) and persists tokens in SecureStore. No signup, token refresh, or route guard yet.
- Screens use hardcoded mock data (e.g. `MOCK_FINANCIAL_DATA` in `screens/dashboard.tsx`). The commented-out data hooks use React Query syntax, but the project's client is **urql** — write real queries with urql under `lib/graphql/`.
- Finance components live in `components/features/finance/`.

### 🟡 Web App — UI built with mock data
- `apps/web/` (`@finnit/web`): Next.js 16 App Router, port 3001. Routes mirror mobile: `/login` and `app/(app)/` (dashboard, history, analytics, calendar, cards, settings). `components/app-shell.tsx` renders `SideNav` (≥ lg) or `TopAppBar` + `BottomNavBar`. Screens live in `components/screens/`, mock data in `lib/mocks/` (to be replaced by GraphQL). Login is UI-only. Theme via `next-themes` (class strategy).
- `packages/ui/` (`@finnit/ui`): shadcn/ui (new-york) on Radix (`radix-ui` package) + Tailwind v4. Ships TypeScript source (consumers transpile it). Import per file, e.g. `@finnit/ui/components/finance/payment-item`. Folders: `components/ui` (shadcn primitives + typography), `components/finance`, `components/navigation`, `components/settings`. Design tokens in `src/styles/globals.css` are ported from `apps/finnit-app/global.css` (light on `:root`, dark on `.dark`).
  - Web components keep the mobile names/props, with web conventions: `symbolName` → `icon: LucideIcon`, `onPress` → `onClick`.
  - Use relative imports inside `packages/ui`. If you add `@theme` font sizes or radii, register them in `src/lib/utils.ts` (`extendTailwindMerge`) or `cn()` will drop them.
  - Avoid locale-dependent `Intl` output that differs between Node and browsers (e.g. `notation: 'compact'`) in SSR'd components; it breaks hydration.
- `apps/storybook/` (`@finnit/storybook`): Storybook 10 (react-vite), port 6006. Stories are co-located as `packages/ui/src/**/*.stories.tsx`; addons: docs, a11y, themes (light/dark toggle).
- Commands: `pnpm web:dev`, `pnpm web:build`, `pnpm storybook`, `pnpm storybook:build`.

### 🟡 Deployment — API pipeline ready, not yet live
- API: Docker image (`apps/api/Dockerfile`, arm64) built and smoke-tested by `.github/workflows/deploy-api.yml`, pushed to GHCR and deployed to a Hetzner CAX11 managed with Dokploy. Postgres runs on the same server inside the Dokploy project. Setup and rollback: `docs/deployment.md`.
- The container runs `prisma migrate deploy` on start, so migrations must be backwards-compatible.
- `apps/api/scripts/smoke-test.sh <image>` boots an image against a throwaway Postgres (health + signUp/signIn/me).
- Known gaps: all API Jest suites fail to run and `eslint` reports ~777 errors, so CI does not gate on them yet.

### Database Migrations Applied
- `20250813091847_init`
- `20250823110041_unique_indexes_created`

## Docs Index

| File | Purpose |
|------|---------|
| `docs/prd.md` | Product Requirements (MVP) |
| `docs/user-stories.md` | User stories by feature |
| `docs/tech-stack.md` | Technology decisions |
| `docs/er-diagram.md` | Entity-relationship diagram (Mermaid) |
| `docs/data-dictionary.md` | Field-level data definitions |
| `docs/database-monorepo-integration.md` | DB ↔ API integration guide |
| `docs/deployment.md` | API deployment (Dokploy + GitHub Actions) and rollback |
| `packages/database/prisma/schema.prisma` | Authoritative DB schema |
| `dev-plans/progress.md` | Sprint progress tracker |
| `dev-plans/next-steps-checklist.md` | Prioritized task list |
| `postman/Finnit-Assistant-API.postman_collection.json` | API test collection |

## Project Context Sources

1. **Local Docs** — place in `docs/` and reference exact paths.
2. **Slash Commands** — reusable prompts in `.claude/commands/`:
   - `api-scaffolder.md` — scaffold NestJS GraphQL modules
   - `graphql-resolvers.md` — implement resolvers with pagination/errors
   - `prisma-migrations.md` — safe migration workflow
   - `pr-manager.md` — PR creation with description template
   - `test-runner.md` — run and fix tests
   - `overnight/api.md` — async API build tasks
   - `overnight/finish.md` — verify green state and open PRs
3. **MCP** — Google Drive connector for PRD/User Stories sync.

## Architecture

### Monorepo Structure

```
finnit-assistant/
├── apps/
│   ├── api/          — NestJS GraphQL API (@finnit/api)
│   ├── finnit-app/   — React Native Expo app
│   ├── web/          — Next.js web app (@finnit/web)
│   └── storybook/    — Storybook for @finnit/ui (@finnit/storybook)
├── packages/
│   ├── database/     — Prisma schema + generated client (@finnit/database)
│   ├── eslint-config/
│   ├── typescript-config/
│   └── ui/           — Web component library: shadcn/ui + Radix + Tailwind v4 (@finnit/ui)
├── docs/             — PRD, user stories, ER diagram
├── dev-plans/        — Sprint progress and task checklists
├── postman/          — API collections (Dev/Staging/Prod environments)
└── docker-compose.yml
```

### API Structure (`apps/api/src/`)

```
src/
├── common/
│   ├── decorators/   — @CurrentUser()
│   ├── exceptions/   — GraphQL typed errors
│   ├── guards/       — JwtAuthGuard
│   ├── scalars/      — JSON scalar
│   ├── types/models/ — Output DTOs (one per entity)
│   └── utils/        — Cursor pagination helpers
├── controllers/      — REST health-check (app, users)
├── modules/          — GraphQL feature modules (see table above)
├── services/
│   ├── app.service.ts
│   ├── prisma.service.ts  — Singleton PrismaClient
│   └── users.service.ts
└── schema.gql        — Auto-generated (do not edit)
```

**Pattern:** Resolver → Service → PrismaService

### Database Package (`packages/database/`)

- Schema: `prisma/schema.prisma`
- Generated client: `generated/client/` (output of `prisma generate`)
- Exported from `src/index.ts`
- Seeders: `prisma/seeders/seed.js`

## Development Commands

### Root Level
```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all workspaces
pnpm lint             # Lint all workspaces
pnpm format           # Prettier across **/*.{ts,tsx,md}
pnpm check-types      # TypeScript check all workspaces
```

### API (`apps/api/`)
```bash
pnpm start:api        # Build DB then start API (recommended for fresh start)
pnpm api:dev          # Same as above (alias)
pnpm turbo run start:dev --filter=@finnit/api   # Dev mode only (DB must be built)
```

### Database (`packages/database/`)
```bash
pnpm turbo run db:generate --filter=@finnit/database      # Generate Prisma client
pnpm turbo run db:migrate:dev --filter=@finnit/database   # Create + apply dev migration
pnpm turbo run db:migrate:deploy --filter=@finnit/database # Apply migrations (CI/prod)
pnpm turbo run db:push --filter=@finnit/database          # Push schema without migration
pnpm turbo run db:seed --filter=@finnit/database          # Seed database
pnpm turbo run db:seed:clean --filter=@finnit/database    # Clean seed
pnpm turbo run db:reset --filter=@finnit/database         # Reset DB (force)
pnpm turbo run db:reset:seed --filter=@finnit/database    # Reset + seed in one step
pnpm turbo run db:validate --filter=@finnit/database      # Validate schema
pnpm turbo run db:backup --filter=@finnit/database        # Backup via psql
pnpm turbo run db:rollback --filter=@finnit/database      # Run rollback.sql
pnpm turbo run studio --filter=@finnit/database           # Prisma Studio (port 5555)
```

### Mobile App (`apps/finnit-app/`)
```bash
pnpm turbo run start --filter=finnit-app   # Expo dev server
pnpm turbo run ios --filter=finnit-app
pnpm turbo run android --filter=finnit-app
pnpm turbo run web --filter=finnit-app
```

### Testing
```bash
pnpm turbo run test --filter=@finnit/api      # Jest unit tests
pnpm turbo run test:e2e --filter=@finnit/api  # E2E tests
```

## Local Development Setup

### PostgreSQL via Docker
```bash
docker-compose up -d postgres   # Start only PostgreSQL (port 5432)
# Optional: pgAdmin at http://localhost:8080 (admin@finnit.com / admin123)
docker-compose up -d            # Start all services
```

Docker DB credentials:
- Host: `localhost:5432`
- Database: `finnit_db`
- User: `finnit_user`
- Password: `finnit_password`

### Environment Variables
```
DATABASE_URL=postgresql://finnit_user:finnit_password@localhost:5432/finnit_db
PORT=3000         # API port (default 3000)
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

### Full Setup Sequence
```bash
# 1. Start DB
docker-compose up -d postgres

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client
pnpm turbo run db:generate --filter=@finnit/database

# 4. Apply migrations
pnpm turbo run db:migrate:dev --filter=@finnit/database

# 5. (Optional) Seed
pnpm turbo run db:seed --filter=@finnit/database

# 6. Start API
pnpm api:dev
```

## Migration Policy

- Every 1:1 relation must have `@unique` on the defining side.
- For *transfers* and *goal contributions*: validate that `@relation` have opposite sides defined in `Transaction` and unique keys where applicable.
- Add **seed** and **rollback** scripts for critical data.
- Never use destructive cascades except in pivot tables.

## GraphQL Conventions

- Inputs separated from outputs; never expose Prisma entities without DTOs.
- Cursor-based pagination on all list queries.
- Typed errors (no generic `Error` type in schema).
- `schema.gql` is auto-generated — run `start:dev` to refresh it.
- Apollo playground enabled at `/graphql` (dev only).

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | >=18 |
| Package Manager | pnpm | 11.3.0 |
| Build Orchestration | Turborepo | ^2.9.14 |
| API Framework | NestJS | ^11 |
| GraphQL | Apollo Server 5 + NestJS GraphQL | ^13 |
| ORM | Prisma | ^7.8.0 |
| Database | PostgreSQL | 18 |
| Auth | JWT + Passport | — |
| Mobile | React Native 0.85 + Expo SDK 56 | — |
| Language | TypeScript (strict) | 5.9.3 |

## Workflow Requirements

1. Read `dev-plans/progress.md` and `dev-plans/next-steps-checklist.md` before starting work.
2. Follow conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.).
3. Run `pnpm lint`, `pnpm format`, and `pnpm check-types` before submitting.
4. Write tests alongside new services.
5. Update `docs/prd.md` *Scope implemented* section when features complete.
