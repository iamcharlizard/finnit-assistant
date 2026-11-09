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
| Transfers (create, also from movements already recorded; delete a whole transfer; convert an expense/income into a transfer and undo it; transfer suggestions after a bank sync) | `src/modules/transfers/` |
| Budgets | `src/modules/budgets/` |
| Goals | `src/modules/goals/` |
| Debts | `src/modules/debts/` |
| Notifications | `src/modules/notifications/` |
| Reports (`monthlyReport`, `dailyCashFlow`, cash-flow projections) | `src/modules/reports/` |
| Recurring expenses (also linking an expense to the scheduled payment it paid: `recurringLinkOptions`, `linkRecurringPayment`) | `src/modules/recurring-expenses/` |
| Statements (PDF import + reconciliation) | `src/modules/statements/` (+ `src/modules/storage/` for S3) |
| AI model catalog + providers (Anthropic, OpenAI, Gemini) | `src/modules/ai/` |
| Bank connections (Syncfy aggregation) | `src/modules/bank-connections/` |
| Loans (types, terms, schedule, charges, historical payments, payment matching, linking expenses to payments, charts) | `src/modules/debts/` (`loans.service.ts`, `loan-tracking.service.ts`, `loan-links.service.ts`, `debt-insights.service.ts`; pure rules in `loan-math.ts`, `loan-links.ts`) |
| Receipts (photo → draft expense: CFDI QR, OCR + rules, AI fallback) | `src/modules/receipts/` |
| Screenshots (bank app movement list → several movements; account by last digits; "en proceso" movements) | `src/modules/screenshots/` |
| OCR client (internal `ocr` service, `OCR_SERVICE_URL` / `OCR_SERVICE_TOKEN`) | `src/modules/ocr/` |
| Admin (user access; master/admin rules) | `src/modules/admin/` |
| Contacts (people the user deals with; lender of personal loans; name only for now) | `src/modules/contacts/` |
| Categorization (merchant rules, aliases, AI suggestions) | `src/modules/categorization/` |
| Duplicates (the same money recorded twice: candidates, suggestions after sync/creation, merging; a bank movement replaces a hand-made transfer side) | `src/modules/duplicates/` |
| Credit cards (billing cycles from the cut-off and payment days: owed at the cut-off, no-interest payment with the cycle's MSI, paid, left, status; interest estimate; daily reminders `card_statement` / `card_due` / `card_unpaid`; pure rules in `credit-card-cycle.ts`) | `src/modules/credit-cards/` |
| Waitlist (public landing sign-ups; `joinWaitlist` public + rate-limited, `waitlistEntries` admin) | `src/modules/waitlist/` |

Auto-generated schema at `apps/api/src/schema.gql`.

Unit tests exist for auth (service + resolver), accounts, budgets, debts, goals, transactions. Missing: categories, transfers, notifications, reports, users. No E2E tests, and CI only builds and deploys the API (no lint/test gate).

Feature-by-feature status (API / mobile / web), verified against the code: `docs/features.md`. Keep it updated when a feature lands; the PRD checkboxes follow it.

### 🟡 Mobile App — real data, mirrors the web's mobile version
`apps/finnit-app/` is an Expo Router app (Expo SDK 58, React Native 0.88, React 19.3) styled with NativeWind v5 (`5.0.0-rc.1` + `react-native-css@3.1.0-rc.1`, pinned exactly together). What's done and what's missing per screen: `docs/features.md` → "App móvil".
- Native projects are generated (CNG): `ios/` and `android/` are git-ignored; run `npx expo prebuild --clean` after changing native config (`pod install` needs `LANG=en_US.UTF-8`). Metro's monorepo setup is automatic (don't add `watchFolders`/`nodeModulesPaths`). pnpm installs are isolated (pnpm 11 ignores `node-linker` in `.npmrc`). React must be the same version (19.3.0) in every workspace; check with `pnpm why react`. The app lints with ESLint 9 (`eslint-plugin-react` doesn't support 10).
- Shared code: logic comes from `@finnit/core` (the web's view builders, formats, forms, `api.ts` runners and `<area>/request.ts` queries); components from `@finnit/ui-native` (`packages/ui-native`): same names and props as `@finnit/ui` with RN conventions (`onClick` → `onPress`, `icon: LucideIcon` from `lucide-react-native`), imported per file (`@finnit/ui-native/components/ui/button`). Build a missing component there, not in the app.
- Theme: `<ThemeRoot theme>` (`@finnit/ui-native/theme/theme-root`) provides the web's tokens as CSS variables, so classes keep the web's names (`bg-card`, `text-income`). Tokens are generated from `packages/ui/src/styles/globals.css` (4 palettes × light/dark) into `src/theme/tokens.generated.ts` + `src/styles/tints.css`; after changing the web's tokens run `pnpm --filter @finnit/ui-native tokens` (a test fails if they drift). The palette is `EXPO_PUBLIC_FINNIT_THEME` plus the admin preview (profile sheet); light/dark/system is `Appearance` (`lib/theme/appearance.tsx`). Use `dark:` classes, never `isDark` (the legacy `ThemeContext` only serves the old connect-bank screens).
- react-native-css limits (rc): color/opacity classes don't work on theme colors (`bg-income/10` is empty) → use the tint tokens `bg-income-10` (alphas 5, 8, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60, 65, 70, 80, 90, 92, 95); shadows through a variable don't apply → `useElevation()` in `style`; px line heights are multiplied by the font size → theme line heights are ratios and `leading-<n>` classes are off-limits (use `style={ lineHeight }`). Colors from core come as `var(--chart-1)`: resolve them with `useColor()`; plain colors for props (icons, SVG) with `useToken('--x')`. Text never inherits styles: use `Text` / typography from ui-native (Ubuntu per weight via `weight`). 1rem = 16px (`inlineRem: 16`). Metro doesn't pick up edits to CSS imported from packages: restart with `--clear`.
- Data: urql (`lib/graphql/client.ts`: auth exchange with `refreshToken`, `x-locale`, `x-privacy-unlock`; a fresh client per session). Screens use `useView({ query, variables, build })` (`lib/graphql/use-view.ts`) with core's query and view builder — the mobile counterpart of the web's `load.ts`; mutations run core's `api.ts` with `useGql()` (`lib/graphql/runner.ts`). After a change, call `emitTransactionsChanged()` (`lib/transactions/events.ts`) so lists on screen reload. Files go straight to the API's REST endpoints with `uploadFile()` (`lib/files/upload.ts`). Core hrefs are web routes: map them with `appHref()` (`lib/nav/app-href.ts`).
- Routes like the web: `app/(app)/(tabs)/` (dashboard, history, accounts, calendar, recurring, analytics, settings, statements, planning/*; `transactions/categorize` only redirects to history's "Por clasificar") under the floating `BottomNavBar` (notched glass pill, "+" fan-out); pushed detail screens (`accounts/[accountId]`, `transaction/[id]`, `planning/debts/[id]`, `planning/goals/[goalId]`, `statements/[id]`, `settings/*`, `notifications`); form sheets (`new-entry`, `more`, `profile`, `privacy-unlock`). `(app)/_layout` is the session guard. Screens live in `screens/`, wrapped in `components/shell/screen.tsx` (header with bell and avatar, pull to refresh, room for the bar; lists inside it load their next page with `useOnScrollEnd`).
- i18n: `use-intl` with `@finnit/core/messages` (`lib/i18n/i18n-provider.tsx`; `useLocalizer()` for core builders); locale = `User.locale`, then the last choice on the device, then the device language, then `es`. Native strings per language in `locales/{es,en}.json` (permission prompts, display name).
- Dev only: `finnitapp://dev/theme-preview` (`?theme=glass`) shows the shared components in each palette.

### 🟡 Web App — UI built with mock data
- `apps/web/` (`@finnit/web`): Next.js 16 App Router, port 3001. `/` is the public marketing landing (`app/page.tsx`, `components/landing/`: what Finnit is + waitlist form via `app/waitlist-actions.ts`; shown with or without a session; `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`; its facet colors are `--facet-1/2/3`, `--ai`, `--ai-ink` in `app/globals.css`). Vercel Web Analytics is mounted in the root layout (`components/web-analytics/site-analytics.tsx`; `beforeSend` in `lib/web-analytics/before-send.ts` strips query strings and skips `/admin`). App routes mirror mobile: `/login` and `app/(app)/` (dashboard, history, analytics, calendar, cards, settings). `/calendar` is the payments calendar (its own menu item; tabs Calendario and Resumen with charts, `@finnit/core/calendar/summary`); `/recurring` only lists recurring expenses (filter bar in the URL, `@finnit/core/recurring/filters`) and suggestions. "Nueva cuenta" in `/accounts` first asks Syncfy or manual; the Syncfy steps are `ConnectBankSteps` (`components/bank-connect/connect-bank-flow.tsx`, callbacks instead of links when embedded). `components/app-shell.tsx` renders `AppSideNav` (≥ lg, a rail the user collapses or expands; it pushes the page) or `AppBottomNav` (< lg: phones and tablets in portrait) next to the `TopAppBar`. The bottom bar is a floating glass pill with a sliding highlight under the active tab and a round "+" that fans out shortcuts (gasto, ingreso, transferencia, escanear ticket); each opens `NewEntrySheet` with `initialAction`, skipping the kind step. Screens lay out by the **content column's width**, not the window: the shell column is an `@container`, so use `@2xl:` / `@3xl:` / `@4xl:` / `@7xl:` for grids and columns (never `md:`/`lg:`/`xl:` for content layout); that way collapsing the sidebar reflows them (e.g. the dashboard goes to 4 columns at `@7xl`). Viewport breakpoints stay for chrome only (bottom bar padding, modal presentation). Screens live in `components/screens/` and get real data: each `page.tsx` loads it on the server in one GraphQL request (`lib/<area>/load.ts` with `serverGraphql` from `lib/api/server-graphql.ts`), pure mappers in `@finnit/core` (`packages/core/src/<area>/view.ts` and `src/finance/`) turn it into plain props (money and dates formatted deterministically in America/Mexico_City), and the client screen only renders. History filters live in the URL; "Cargar más" uses `gql`. Light/dark via `next-themes` (class strategy) is the only appearance choice users have. The palette is `<html data-theme>` (`finnit` | `glass` | `suave` | `mono`), one for the whole site from the `FINNIT_THEME` env var; admins get "Vista previa de tema" in the profile menu, which sets the `finnit-theme-preview` cookie for their browser only (`@finnit/core/theme/app-theme`, `components/app-theme-provider.tsx`). The sidebar (`AppSideNav`) collapses to icons (cookie `finnit-sidebar`, read in `app/(app)/layout.tsx`; ⌘B); its collapsed look is the `rail-collapsed:` CSS variant in `apps/web/app/globals.css`, so the server renders the right state at every width. From lg, toggling it runs as a view transition (`components/navigation/layout-transition.ts`, CSS under `html.vt-layout` in `app/globals.css`): boxes with a unique `[view-transition-name:…]` (sidebar, header, dashboard blocks) glide to their new place; name a screen's main blocks the same way to animate its reflow. Names must be unique among displayed elements.
- i18n: `next-intl` without locale in the URL. Locale = `User.locale` (saved with `updateMyPreferences`), then the `NEXT_LOCALE` cookie, then `es`; login uses cookie / Accept-Language. Messages in `packages/core/messages/{es,en}.json` (shared with the mobile app) (keys type-checked; a test checks both files match). Never hardcode UI text: server `getTranslations`, client `useTranslations`, view builders take a `Localizer`. Category names come translated from the API (`Category.name` by `x-locale` header or the user's locale; `originalName` is English; `CategoryTranslation` table; user-created names are translated with Google Cloud Translation, AI fallback). `packages/ui` components take labels as props with English defaults.
- `packages/core/` (`@finnit/core`): framework-free TypeScript shared by the web and the mobile app, shipped as source (`transpilePackages` in the web), imported per file (`@finnit/core/finance/money`, `@finnit/core/history/view`). It holds every pure module that used to live in `apps/web/lib/`: view builders, finance helpers, forms/validation, filters, status, GraphQL selection and query strings, nav titles, locales, the app themes list, the `Localizer`/`Translate` types (on `use-intl`, which next-intl is built on; typed keys declared once in `src/i18n/app-config.ts`), `testLocalizer()` and the messages. Also the pure helpers `@finnit/ui/lib/*` re-exports (money/number formatting, date-only, color, option search) and data types of UI components (`src/ui/`). It must never import React, Next, DOM APIs, `fetch` or `@finnit/ui`; whatever needs them (loaders, `api.ts` runners, cookies, uploads) stays in `apps/web/lib/`. Tests: `pnpm --filter @finnit/core test`.
- Files from the browser go through `app/api/files/[...path]` (whitelisted REST paths, same-origin, token injection, 10 MB). Navigation sections in `lib/nav/` (sections with several screens are sidebar groups; Settings is not in the menu but in the profile menu, `components/navigation/profile-menu.tsx`, pinned at the sidebar's bottom and on the header avatar below lg); dates are stored as the local (America/Mexico_City) day via `toLocalDateOnly`.
- Web auth (backend-for-frontend): login/logout are server actions (`app/login/actions.ts`) that keep the API tokens in httpOnly cookies (`lib/auth/cookies.ts`); browser JS never sees them. `proxy.ts` (Next 16's middleware) renews the access token with the refresh token and guards routes; which paths are public is `lib/auth/route-access.ts` (tested): everything else needs a session (pages → `/login?next=`, `/api/*` → 401). The matcher skips `_vercel` (Analytics). `apiGraphql` forwards the visitor's IP with `FINNIT_BFF_SECRET` so the API rate-limits per visitor. Server components read the user with `getCurrentUser()`; client components call GraphQL through `POST /api/graphql`, which adds the token (same-origin only). The Next server reaches the API at `FINNIT_API_URL` (default `http://localhost:3000` in development).
- `packages/ui/` (`@finnit/ui`): shadcn/ui (new-york) on Radix (`radix-ui` package) + Tailwind v4. Ships TypeScript source (consumers transpile it). Import per file, e.g. `@finnit/ui/components/finance/payment-item`. Folders: `components/ui` (shadcn primitives + typography), `components/finance`, `components/navigation`, `components/settings`. Design tokens in `src/styles/globals.css` are ported from `apps/finnit-app/global.css` (light on `:root`, dark on `.dark`).
  - Web components keep the mobile names/props, with web conventions: `symbolName` → `icon: LucideIcon`, `onPress` → `onClick`.
  - Themes live in `globals.css` as `[data-theme='x']:not(.dark)` / `[data-theme='x'].dark` blocks that override surface, text, border and accent tokens only; never `--income`, `--expense` or `--chart-*`. Popovers/dialogs use `bg-popover`, which stays opaque in Glass. Floating chrome uses `glass bg-glass border-glass-border shadow-elevation` (`glass` = `backdrop-filter: var(--glass-blur)`); the body draws `--app-bg-image` (Glass's blobs), so app wrappers must not paint `bg-background` over it.
  - Chart series colors are `--chart-1` … `--chart-6` (light and dark), in an order validated for color-vision deficiency. Assign them by entity in that fixed order; don't reorder or add hues without re-running a palette validator. Light slots 3–5 are under 3:1 on the surface, so charts using them need direct labels or a table view.
  - Long dialogs put their fields in `DialogBody` (between `DialogHeader` and `DialogFooter`): only the body scrolls, the title and buttons stay visible. Don't add `overflow-y-auto` / `max-h` to `DialogContent`.
  - Dialogs the parent mounts only while open (`{x ? <MyDialog /> : null}`) close through `useDialogExit()` (`@finnit/ui/lib/use-dialog-exit`): `open={exit.open}`, `onExitComplete={exit.onExitComplete}` on the content, and `exit.close(onClose)` / `exit.after(onSaved)(…)` so the parent unmounts them after the exit animation, not before.
  - Money fields use `MoneyInput` (`@finnit/ui/components/ui/money-input`; `useMoneyMask` for custom-looking ones): only digits, masked in the country's format (Mexico: `$ 1'250,000.50 MXN`), while the form keeps the raw value (`"1250000.50"`). The country comes from `MoneyFormatProvider` (web: `MONEY_COUNTRY` in `lib/finance/money.ts`); formats live in `packages/ui/src/lib/money-format.ts`. Pass `currency` for accounts in another currency.
  - Other numbers (rates, counts, days, priorities) use `NumberInput` (`@finnit/ui/components/ui/number-input`): never letters; whole numbers unless `decimals`, `allowNegative`, `maxDigits`, `suffix="%"`. Don't use `type="number"` (it lets `e`, `+` and `-` in).
  - Data tables use `DataTable` (`@finnit/ui/components/ui/data-table`, TanStack Table v8): paginated (5 rows by default, rows-per-page selector beside the pager), sortable only where a column sets `enableSorting`, `meta.align: 'right'` for amounts. In the web pass `labels={useTableLabels()}` (`components/use-table-labels.ts`). The plain `Table` primitives are for static layouts only.
  - Movement lists use `TransactionCard` (`@finnit/ui/components/finance/transaction-card`; web wrapper `components/finance/transaction-card.tsx`): the whole card opens the detail through `useTransactionDrawer()` (drawer from lg, modal below; `TransactionDrawerProvider` in the app shell), the pencil renames that movement inline, and `footer` sits inside the card. The detail screen talks to its container through `useDetailHost()` (show / refresh / close), never the router directly. Movements have no page of their own (`/transactions/[id]` is gone): open them with `useTransactionDrawer().open(id, { onChange })`, where `onChange` lets lists kept on the client reload after an edit ("Por clasificar" does). The history is also "Por clasificar" (`?review=1`, the old Clasificar screen) and loads more rows with infinite scroll (`useLoadMoreSentinel`), keeping how many are loaded in `?n=` (`useShownInUrl`) so a refresh after an edit brings them back. Screens open "Nuevo movimiento" filled in with `useNewEntry()(action, prefill)` (`components/new-entry/new-entry-context.tsx`). Editing a movement is one modal (`transaction-edit-dialog.tsx`): name and privacy, an inline automatic-name section (`AliasFields` / `useAliasEditor` from `components/aliases/alias-fields.tsx`, shared with `AliasDialog`), category with the no-AI `similarCategory` pill, data and notes.
  - `Combobox` takes `onCreate` / `createLabel` to let the user add what they typed (e.g. `ContactCombobox` in `components/contacts/`). Its search is ours (`rankOptions` in `src/lib/option-search.ts`, cmdk filtering off): label matches first, then options matched only through `group` / `keywords`; pass the parent name as `keywords` for subcategories.
  - Help text next to figures goes in `InfoHint` (`@finnit/ui/components/ui/info-hint`): an info icon that opens on hover and on click/tap, instead of always-visible paragraphs.
  - Use relative imports inside `packages/ui`. If you add `@theme` font sizes or radii, register them in `src/lib/utils.ts` (`extendTailwindMerge`) or `cn()` will drop them.
  - Avoid locale-dependent `Intl` output that differs between Node and browsers (e.g. `notation: 'compact'`) in SSR'd components; it breaks hydration.
- `apps/storybook/` (`@finnit/storybook`): Storybook 10 (react-vite), port 6006. Stories are co-located as `packages/ui/src/**/*.stories.tsx`; addons: docs, a11y, themes (light/dark toggle).
- Commands: `pnpm web:dev`, `pnpm web:build`, `pnpm storybook`, `pnpm storybook:build`.

### ✅ Deployment — API live on Dokploy
- API: Docker image (`apps/api/Dockerfile`, arm64) built and smoke-tested by `.github/workflows/deploy-api.yml`, pushed to GHCR and deployed to a Hetzner CAX11 managed with Dokploy. Each environment has its own Postgres on the same server inside the Dokploy project. Setup and rollback: `docs/deployment.md`.
- Environments: branch `main` → **production** (image tag `latest`); branch `testing` → **testing** (image tag `testing`). Work flows `feature/*` → `testing` → `main`.
- The container runs `prisma migrate deploy` on start, so migrations must be backwards-compatible.
- Bank connection UI (web and mobile) drives `BankConnectFlow` from `@finnit/bank-connect` (framework-agnostic steps: consent → pick bank → login form → second factors → register → link accounts); each app only renders the current step (web: `components/bank-connect/`, routes `/settings/banks` and `/settings/banks/connect`). Underneath it uses `@finnit/bank-connect`: the device gets a session from `createBankConnectSession`, renders the bank's login form and second-factor prompts natively, and sends them straight to Syncfy (never to the Finnit API); on success it calls `registerBankConnection`. Sites or second factors it can't render (`isNativeSupported`, `needsWidget`) fall back to Syncfy's widget. `pnpm --filter @finnit/bank-connect sandbox-check` runs the flow against Syncfy's sandbox (needs `SYNCFY_API_KEY_SANDBOX`).
- Public API surface: only the auth operations, `joinWaitlist` and `GET /health` work without a JWT; `src/auth-surface.spec.ts` fails if a new query/mutation/route lacks `JwtAuthGuard`/`JwtHttpAuthGuard` and isn't on its allowlist. Public operations use `GqlThrottlerGuard` + `@Throttle(limits(ip, account))` (`src/common/throttling/`; per IP and per target email; `TOO_MANY_REQUESTS`). Never add a query that takes another user's id without an admin guard. List page sizes are capped with `pageSize()` (`common/utils/pagination.util.ts`, max 200).
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
- `20261013120000_private_attachments` … `20261017090000_merchant_rules_and_aliases` (rollbacks in `packages/database/scripts/rollbacks/`)
- `20261018090000_receipts_and_merchant_tax_ids` (ReceiptImport, MerchantTaxId with a partial unique index for global rows; rollback in `packages/database/scripts/rollbacks/`)
- `20261030090000_loans` (loan types and terms on Debt, DebtCharge, historical DebtPayment without transaction, AI loan fields on RecurringSuggestionState; rollback in `packages/database/scripts/rollbacks/`)
- `20261101090000_loan_opening_fee` (`Debt.openingFee`; rollback in `packages/database/scripts/rollbacks/`)
- `20261102090000_debt_categories` (default **Loans & Debts** category with *Loan Payments* / *Installment Payments* for existing users; `Debt.purposeCategoryId` and `DebtCharge.purposeCategoryId`, informative; rollback in `packages/database/scripts/rollbacks/`). (Since the global catalog, new default categories only need `default-categories.ts`.)
- `20261102120000_loan_periodic_fee` (`Debt.periodicFee`: fixed fee per payment, VAT included; rollback in `packages/database/scripts/rollbacks/`)
- `20261103120000_lending_method` (`LendingMethod` enum; `Debt.lendingMethod`, `DebtCharge.lendingMethod`; rollback in `packages/database/scripts/rollbacks/`)
- `20261104090000_charge_installments_paid` (`DebtCharge.installmentsPaid`, `DebtPayment.chargeId`: installments of a later purchase paid before registering it; rollback in `packages/database/scripts/rollbacks/`)
- `20261107090000_occurrence_original_due_date` (`RecurringOccurrence.originalDueDate`: a scheduled payment moved to another day keeps its schedule date, so it is not generated again there; rollback in `packages/database/scripts/rollbacks/`)
- `20261106090000_debt_description` (`Debt.description`: what a loan's first amount was, the label of its installments; rollback in `packages/database/scripts/rollbacks/`)
- `20261108090000_deposit_adds_to_balance` (`Debt.depositAddsToBalance`, `DebtCharge.depositAddsToBalance`: whether deposited loan money was added to an account's balance; false = already spent, no movement; rollback in `packages/database/scripts/rollbacks/`)
- `20261109090000_transaction_balance_effect` (`Transaction.balanceEffect`: signed effect on the account balance, backfilled; rollback in `packages/database/scripts/rollbacks/`)
- `20261110090000_balance_reconciliation` (`NotificationType.balance_mismatch`, `Account.bankDifferenceTransactionId`, `LinkedAccount.reconciledBalance`/`reconciledAt`; rollback in `packages/database/scripts/rollbacks/`)
- `20261111090000_screenshot_imports` + `20261111090100_screenshot_parsing_default` (`ScreenshotImport`, `ImportedTransaction.screenshotImportId`/`inProcess`, `Transaction.inProcess`, `AiFeatureKey.screenshot_parsing` and its settings row; one rollback covers both)
- `20261114090000_alias_pattern_ai` + `20261114090100_alias_pattern_ai_default` (`AiFeatureKey.alias_pattern` and its settings row; one rollback covers both)
- `20261114100000_privacy_pin` (`User.privacyPin*`, `MerchantAlias.isProtected`, `PrivacyPinReset`; rollback in `packages/database/scripts/rollbacks/`). Protected automatic names need the privacy PIN (`PrivacyService.isUnlocked(req, userId)`, header `x-privacy-unlock` forwarded by the web from its `finnit_privacy` cookie). Emails go through `MailService` (`src/modules/mail/`); only a fake console transport exists so far.
- `20261113090000_global_categories` (global category catalog `userId` null + `isDefault`, users' copies remapped onto it; `Category.kind`/`icon`/`color`; `CategoryHidden`; `User.googlePictureUrl`/`avatarKey`/`avatarUpdatedAt`; rollback in `packages/database/scripts/rollbacks/`). The catalog lives in `apps/api/src/modules/auth/default-categories.ts` and is synced on API start (`CategoryCatalogService`): curate it there, never change or remove a key. Query categories with `visibleCategoryWhere` / `pickableCategoryWhere` (`modules/categories/category-scope.ts`).
- `20261112090000_transfers_and_sync_review` (`Transaction.originalType`, `Transfer.convertedAt`: turning an expense/income into a transfer and undoing it; `TransferSuggestion` (+ enums): synced movements that look like transfers between own accounts; `MerchantAlias.transferAccountId`; `NotificationType.uncategorized`; rollback in `packages/database/scripts/rollbacks/`)
- `20261105090000_charge_terms` (`DebtCharge.firstPaymentDate`, `interestMode`, `interestRateAnnual`, `includesVat`: a later purchase's first due date and interest terms; rollback in `packages/database/scripts/rollbacks/`)
- `20261115090000_waitlist` (`WaitlistEntry`: landing page sign-ups; rollback in `packages/database/scripts/rollbacks/`)
- `20261116090000_transaction_notes` (`Transaction.notes`: the user's notes on any movement, also bank ones; rollback in `packages/database/scripts/rollbacks/`)
- `20261103090000_contacts` (`Contact`, `Debt.lenderContactId`; existing personal-loan lenders become contacts; rollback in `packages/database/scripts/rollbacks/`)
- `20261117090000_default_cash_account` (`Account.isDefaultCash` + partial unique index per user: every user has one cash account, "Efectivo", that can't be deleted, archived or change type; the migration marked each user's oldest open cash account or created one; new users get it on creation and, as a safety net, on sign-in via `ensureDefaultCashAccount` in `modules/accounts/default-cash.ts`; rollback in `packages/database/scripts/rollbacks/`)
- `20261118090000_account_include_in_total` (`Account.includeInTotal`, default true: whether the account adds up to the total balance on Inicio and Cuentas y tarjetas; `summarizeBalances` and `accountsBalanceHistory` skip excluded accounts; rollback in `packages/database/scripts/rollbacks/`)
- `20261119090000_duplicate_suggestions` (`DuplicateSuggestion` + `DuplicateSuggestionStatus`: possible duplicates of one account, merged by `src/modules/duplicates/` (the bank's movement stays) or dismissed as "No es duplicado"; rollback in `packages/database/scripts/rollbacks/`)
- `20261120090000_card_notifications` (`NotificationType.card_statement`, `card_due`, `card_unpaid`: credit card reminders from `src/modules/credit-cards/`; rollback in `packages/database/scripts/rollbacks/`)
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
│   ├── core/         — Framework-free TS shared by web and mobile: view mappers, formatting, forms, query strings, i18n messages (@finnit/core)
│   ├── database/     — Prisma schema + generated client (@finnit/database)
│   ├── eslint-config/
│   ├── typescript-config/
│   ├── ui/           — Web component library: shadcn/ui + Radix + Tailwind v4 (@finnit/ui)
│   └── ui-native/    — React Native component library: NativeWind v5, the web's names/props and tokens (@finnit/ui-native)
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
├── controllers/      — REST health-check
├── modules/          — GraphQL feature modules (see table above)
├── services/
│   └── prisma.service.ts  — Singleton PrismaClient
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
pnpm dev:local        # API (3000) + web (3001) in development: starts Docker services, applies migrations, checks ports (scripts/dev.sh)
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
pnpm db:pull <production|testing>                         # Replace the local DB with a copy of an environment over SSH (backs up local first; IPv6 off meanwhile; docs/deployment.md)
pnpm turbo run studio --filter=@finnit/database           # Prisma Studio (port 5555)
```

### Mobile App (`apps/finnit-app/`)
```bash
pnpm turbo run start --filter=finnit-app   # Expo dev server
pnpm turbo run ios --filter=finnit-app
pnpm turbo run android --filter=finnit-app
pnpm turbo run web --filter=finnit-app
pnpm --filter @finnit/ui-native tokens     # Regenerate the theme tokens from @finnit/ui's globals.css
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
| Mobile | React Native 0.88 + Expo SDK 58 | — |
| Language | TypeScript (strict) | 5.9.3 |

## Workflow Requirements

1. Read `dev-plans/progress.md` and `dev-plans/next-steps-checklist.md` before starting work.
2. Follow conventional commit messages (`feat:`, `fix:`, `refactor:`, etc.).
3. Run `pnpm lint`, `pnpm format`, and `pnpm check-types` before submitting.
4. Write tests alongside new services.
5. Update `docs/prd.md` *Scope implemented* section when features complete.
