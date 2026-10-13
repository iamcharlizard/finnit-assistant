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
All 11 original GraphQL modules implemented, plus recurring expenses in `apps/api/`:

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
| Recurring expenses | `src/modules/recurring-expenses/` |
| Statements (PDF import + reconciliation) | `src/modules/statements/` (+ `src/modules/storage/` for S3) |
| AI model catalog + providers (Anthropic, OpenAI, Gemini) | `src/modules/ai/` |
| Bank connections (Syncfy aggregation) | `src/modules/bank-connections/` |
| Admin (user access; master/admin rules) | `src/modules/admin/` |
| Categorization (merchant rules, aliases, AI suggestions) | `src/modules/categorization/` |

Auto-generated schema at `apps/api/src/schema.gql`.

Unit tests exist for auth (service + resolver), accounts, budgets, debts, goals, transactions. Missing: categories, transfers, notifications, reports, users. No E2E tests, and CI only builds and deploys the API (no lint/test gate).

Feature-by-feature status (API / mobile / web), verified against the code: `docs/features.md`. Keep it updated when a feature lands; the PRD checkboxes follow it.

### 🟡 Mobile App — UI built, data mostly mocked
`apps/finnit-app/` is an Expo Router app styled with NativeWind v5:
- Routes: `app/login.tsx`, `app/(app)/` group (dashboard, history, cards, calendar, analytics, settings) with a custom `BottomNavBar`. Route files re-export screens from `screens/`.
- Auth: `contexts/AuthContext.tsx` calls the `signIn` mutation via urql (`lib/graphql/client.ts`) and persists tokens in SecureStore. No signup, token refresh, or route guard yet.
- Screens use hardcoded mock data (e.g. `MOCK_FINANCIAL_DATA` in `screens/dashboard.tsx`). The commented-out data hooks use React Query syntax, but the project's client is **urql** — write real queries with urql under `lib/graphql/`.
- Finance components live in `components/features/finance/`.

### 🟡 Web App — UI built with mock data
- `apps/web/` (`@finnit/web`): Next.js 16 App Router, port 3001. Routes mirror mobile: `/login` and `app/(app)/` (dashboard, history, analytics, calendar, cards, settings). `components/app-shell.tsx` renders `SideNav` (≥ lg) or `TopAppBar` + `BottomNavBar`. Screens live in `components/screens/` and get real data: each `page.tsx` loads it on the server in one GraphQL request (`lib/<area>/load.ts` with `serverGraphql` from `lib/api/server-graphql.ts`), pure mappers in `lib/<area>/view.ts` and `lib/finance/` turn it into plain props (money and dates formatted deterministically in America/Mexico_City), and the client screen only renders. History filters live in the URL; "Cargar más" uses `gql`. Theme via `next-themes` (class strategy).
- i18n: `next-intl` without locale in the URL. Locale = `User.locale` (saved with `updateMyPreferences`), then the `NEXT_LOCALE` cookie, then `es`; login uses cookie / Accept-Language. Messages in `apps/web/messages/{es,en}.json` (keys type-checked; a test checks both files match). Never hardcode UI text: server `getTranslations`, client `useTranslations`, view builders take a `Localizer`. Category names come translated from the API (`Category.name` by `x-locale` header or the user's locale; `originalName` is English; `CategoryTranslation` table; user-created names are translated with Google Cloud Translation, AI fallback). `packages/ui` components take labels as props with English defaults.
- Files from the browser go through `app/api/files/[...path]` (whitelisted REST paths, same-origin, token injection, 10 MB). Navigation sections in `lib/nav/`; dates are stored as the local (America/Mexico_City) day via `toLocalDateOnly`.
- Web auth (backend-for-frontend): login/logout are server actions (`app/login/actions.ts`) that keep the API tokens in httpOnly cookies (`lib/auth/cookies.ts`); browser JS never sees them. `proxy.ts` (Next 16's middleware) renews the access token with the refresh token and guards routes. Server components read the user with `getCurrentUser()`; client components call GraphQL through `POST /api/graphql`, which adds the token (same-origin only). The Next server reaches the API at `FINNIT_API_URL` (default `http://localhost:3000` in development).
- `packages/ui/` (`@finnit/ui`): shadcn/ui (new-york) on Radix (`radix-ui` package) + Tailwind v4. Ships TypeScript source (consumers transpile it). Import per file, e.g. `@finnit/ui/components/finance/payment-item`. Folders: `components/ui` (shadcn primitives + typography), `components/finance`, `components/navigation`, `components/settings`. Design tokens in `src/styles/globals.css` are ported from `apps/finnit-app/global.css` (light on `:root`, dark on `.dark`).
  - Web components keep the mobile names/props, with web conventions: `symbolName` → `icon: LucideIcon`, `onPress` → `onClick`.
  - Use relative imports inside `packages/ui`. If you add `@theme` font sizes or radii, register them in `src/lib/utils.ts` (`extendTailwindMerge`) or `cn()` will drop them.
  - Avoid locale-dependent `Intl` output that differs between Node and browsers (e.g. `notation: 'compact'`) in SSR'd components; it breaks hydration.
- `apps/storybook/` (`@finnit/storybook`): Storybook 10 (react-vite), port 6006. Stories are co-located as `packages/ui/src/**/*.stories.tsx`; addons: docs, a11y, themes (light/dark toggle).
- Commands: `pnpm web:dev`, `pnpm web:build`, `pnpm storybook`, `pnpm storybook:build`.

### ✅ Deployment — API live on Dokploy
- API: Docker image (`apps/api/Dockerfile`, arm64) built and smoke-tested by `.github/workflows/deploy-api.yml`, pushed to GHCR and deployed to a Hetzner CAX11 managed with Dokploy. Each environment has its own Postgres on the same server inside the Dokploy project. Setup and rollback: `docs/deployment.md`.
- Environments: branch `main` → **production** (image tag `latest`); branch `testing` → **testing** (image tag `testing`). Work flows `feature/*` → `testing` → `main`.
- The container runs `prisma migrate deploy` on start, so migrations must be backwards-compatible.
- Bank connection UI (web and mobile) drives `BankConnectFlow` from `@finnit/bank-connect` (framework-agnostic steps: consent → pick bank → login form → second factors → register → link accounts); each app only renders the current step (web: `components/bank-connect/`, routes `/settings/banks` and `/settings/banks/connect`). Underneath it uses `@finnit/bank-connect`: the device gets a session from `createBankConnectSession`, renders the bank's login form and second-factor prompts natively, and sends them straight to Syncfy (never to the Finnit API); on success it calls `registerBankConnection`. Sites or second factors it can't render (`isNativeSupported`, `needsWidget`) fall back to Syncfy's widget. `pnpm --filter @finnit/bank-connect sandbox-check` runs the flow against Syncfy's sandbox (needs `SYNCFY_API_KEY_SANDBOX`).
- Access is invitation-only: there is no `signUp`. Admins (`User.role = admin`; one `isMaster`, created per environment with `node apps/api/dist/scripts/create-master.js`) add users in the web admin panel (`/admin`, module `src/modules/admin/`). Guard admin operations with `@UseGuards(JwtAuthGuard, AdminGuard)` (`MasterGuard` for master-only). Users sign in with an admin-assigned password or with Google (`signInWithGoogle`, ID token audience in `GOOGLE_CLIENT_IDS`; it never creates users). Disabling a user or changing their password bumps `User.tokenVersion`, which invalidates their tokens (`isSessionValid`).
- Files: every user file (statements, attachments, future uploads) goes to the private S3 bucket through `S3StorageService` (`src/modules/storage/`), under `users/<userId>/<kind>/<id>.<ext>`. Never public objects or pre-signed URLs: serve files through an authenticated API endpoint that checks ownership in the database (see `sendFile`). Detect file types from the bytes (`detectFileType`), not from names.
- `apps/api/scripts/smoke-test.sh <image>` boots an image against a throwaway Postgres (health + create-master + signIn/me).
- Known gaps: `eslint` reports ~777 errors in the API, so CI does not gate on lint or tests yet.

### Database Migrations Applied
- `20250813091847_init`
- `20250823110041_unique_indexes_created`
- `20261012120000_recurring_expenses_and_statements` (rollback: `packages/database/scripts/rollbacks/`)
- `20261012180000_ai_model_catalog`
- `20261013090000_syncfy_bank_sync`
- `20261013120000_private_attachments`
- `20261014090000_admin_access_and_ai_features`
- `20261015090000_category_i18n_and_ai_features` + `20261015090100_ai_feature_defaults` (enum values added in one file can't be used in the same transaction, so the seed rows live in a second file)
- `20261016090000_recurring_suggestion_state`
- `20261017090000_merchant_rules_and_aliases` (enables the `unaccent` extension)

Migrations with hand-edited SQL wrap their body in `BEGIN; … COMMIT;`: Prisma does not run a migration in a transaction, so a failure would leave it half applied.

## Docs Index

| File | Purpose |
|------|---------|
| `docs/prd.md` | Product Requirements (MVP) |
| `docs/features.md` | Feature inventory with real status per platform (source of truth for progress) |
| `docs/user-stories.md` | User stories by feature |
| `docs/tech-stack.md` | Technology decisions |
| `docs/er-diagram.md` | Entity-relationship diagram (Mermaid) |
| `docs/data-dictionary.md` | Field-level data definitions |
| `docs/database-monorepo-integration.md` | DB ↔ API integration guide |
| `docs/deployment.md` | API deployment (Dokploy + GitHub Actions) and rollback |
| `docs/document-ocr.md` | Receipt photos and statement OCR: engine comparison, design and task list |
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
│   ├── bank-connect/ — Headless Syncfy bank connection for web + React Native (@finnit/bank-connect)
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
