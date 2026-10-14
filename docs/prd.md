# 📝 Product Requirements Document (PRD) – Finnit Assistant (MVP)

## 🧠 Project Overview

**Finnit Assistant** is a cross-platform personal finance assistant designed to simplify financial tracking, planning, and decision-making. It helps users manage **income, expenses, debts, savings, and projections** through a guided, interactive experience.
Unlike traditional finance apps, Finnit focuses on **personalized recommendations**, **strategic debt management**, and **cash flow projections** — combining automation, AI-assisted categorization, and seamless bank integrations.

---

## 🎯 MVP Goal

Deliver a functional prototype that allows a user to:

1. **Easily set up accounts and cards** with guided onboarding.
2. **Track income, expenses, transfers, and debts** with minimal friction.
3. **Connect to banks or fintechs** for automatic transaction import.
4. **View insights, budgets, and cash flow projections** in a clear dashboard.
5. **Receive contextual recommendations** and reminders for better financial health.
6. **Attach receipts and supporting documents** to transactions.
7. **Project different financial scenarios** with a “What If” simulator.

---

## ✅ Core Features (MVP)

Checkboxes reflect the **API** state, verified against the code. Per-platform status (API / mobile / web) lives in [features.md](./features.md), the source of truth for progress.

### 1. User Authentication & Security 🟡 PARTIAL
- [x] Invitation-only access: no public sign-up; admins add each user from the admin panel.
- [x] Login with email + password (assigned by an admin) or with Google (only for users already added), JWT-based.
- [x] Password hashing, refresh tokens, and session handling; disabling a user ends their sessions.
- [x] Roles: `user`, `admin`, plus one master admin.
- [x] Admin panel (web): user access, AI models and AI features.
- [x] Privacy guarantee: user data fully isolated.
- [ ] Account recovery via email (reset token flow exists; no email is sent yet).

---

### 2. Accounts & Balances ✅ IMPLEMENTED
- [x] Account CRUD for cash, debit, credit, savings and e-wallets.
- [ ] Guided account creation with explanations of account types (client UI).
- [ ] Optional card photo scan to auto-fill details (name, last 4 digits, bank, color).
- [x] Balance adjustments without generating false income/expense.
- [x] "Balance correction" transaction type for transparency.
- [x] Clear difference between transfers and transactions.
- [ ] Automatic detection of internal transfers for linked accounts.

---

### 3. Transactions 🟡 PARTIAL
- [x] Quick add: date, account, amount, type (income/expense/transfer), category (API; client flow in feature 19).
- [x] Multiple transactions per account on the same day.
- [ ] Smart capture: receipt photos (see feature 14), SMS/notification parsing (where allowed).
- [x] Category suggestion based on merchant name (no learning from corrections yet).
- [x] Recurring entries as reminders until confirmed as paid (see feature 12).
- [ ] Auto-suggestion of recurrence from detected patterns (see feature 15).
- [x] Calendar view (web; see feature 15 for the recurring payments calendar).
- [ ] Optional mobile widget.
- [x] Attachments for receipts, invoices, payment confirmations (private S3 bucket).
- [ ] Integration with Banxico for CEP retrieval (interbank transfers).
- [x] Search & filter by date, account, category, text.

---

### 4. Categories ✅ IMPLEMENTED
- [x] Default hierarchical category list (e.g., "Food > Groceries").
- [x] CRUD for user-defined categories.
- [x] Merchant "memory rules" for auto-categorization (see feature 16).

---

### 5. Budgets ✅ IMPLEMENTED
- [x] Monthly and category-based budgets.
- [x] Budget templates.
- [x] Real-time usage tracking.
- [x] Alerts at 80%/100% usage (computed on query; not pushed as notifications).

---

### 6. Debts & Credit Cards ✅ IMPLEMENTED
- [x] Debt registration (loans, credit cards) with custom interest rates.
- [ ] Pre-filled parameters for known banks (editable).
- [x] Credit cards as special accounts with statement/payment dates.
- [x] Avalanche and snowball payoff strategies.
- [x] Repayment plan.

---

### 7. Goals & Savings 🟡 PARTIAL
- [x] Goal setup with target amount and due date, and progress tracking.
- [ ] Contributions, edit and delete exposed in GraphQL (implemented in the service only).
- [ ] Suggestions to save when projected end-of-month balance is positive (service only).

---

### 8. Reports & Insights 🟡 PARTIAL
- [x] Monthly summary: income, expenses by category, net balance.
- [ ] Insights: top categories, unusual expenses, comparisons.
- [ ] 3–6 month trends.
- [ ] CSV export.

---

### 9. Bank & Fintech Integrations ✅ IMPLEMENTED (Syncfy)
- [x] Bank connection through an aggregator (Syncfy; Belvo no longer covers Mexican banks). Users connect in Syncfy's widget; Finnit never handles bank logins.
- [x] Automatic import of movements, twice a day, deduplicated and reconciled with statements and recurring expenses.
- [ ] Weekly reconciliation review.
- [ ] Detection of internal transfers between linked accounts.

---

### 10. Cash Flow & Projections ✅ IMPLEMENTED
- [x] Cash flow forecast for 30/60 days.
- [x] "What If" simulations for extra payments, income changes, or new expenses.

---

### 11. Essential Notifications 🟡 PARTIAL
- [x] List notifications and mark them as read.
- [ ] Budget usage alerts (80%/100%).
- [ ] Upcoming credit card/loan payments.
- [x] Recurring transaction reminders (daily job, 3 days before).
- [ ] Weekly/monthly summaries.
- [ ] Push / email delivery.

---

### 12. Recurring Expenses ✅ IMPLEMENTED (API)
- [x] Recurring commitments with frequency (weekly, biweekly, semimonthly, monthly, bimonthly, quarterly, semiannual, yearly) and kind (subscription, utility, loan, installment/MSI, insurance, housing, membership, other).
- [x] Tracking mode per expense: `automatic` (marked paid when reconciled with the card), `manual` (user confirms), `reminder` (no payment state).
- [x] Upcoming payments and normalized monthly cost by kind and account.
- [x] Installment (MSI) progress.
- [x] Generated reminders.
- [ ] Screen, calendar and suggestions: see feature 15.

---

### 13. Card Statements & Reconciliation 🟡 PARTIAL
- [x] Upload the monthly statement PDF (stored in AWS S3).
- [x] Extraction: local Banamex parser, AI model catalog (Anthropic, OpenAI, Gemini) for other formats.
- [x] Review and confirm imported movements (API; no client screen yet).
- [x] Reconcile statement lines with existing transactions and automatic recurring expenses.
- [x] Card month summary vs. amount due.
- [x] Same flow fed by the bank sync (Syncfy).
- [x] Scanned statements: OCR on our server before any AI fallback (see feature 14).
- [x] Fall back to AI only when the local extraction does not balance (previous balance + charges − credits ≠ cut-off balance).

---

### 14. Receipt Capture & Document OCR ✅ IMPLEMENTED (web)
Local, open-source extraction first; AI only as a fallback. Research, OCR engine comparison and task list: [document-ocr.md](./document-ocr.md).
- [x] Internal OCR service (`ocr` container: RapidOCR with PP-OCRv5 models, CPU/arm64), not publicly exposed.
- [x] Receipt photo upload (web and mobile) stored in the private S3 bucket.
- [x] Extraction without AI: CFDI QR code (issuer tax ID, total, UUID), then OCR + rules for total, date, merchant tax ID and VAT.
- [x] AI fallback only when total or date are missing, sending OCR text (not the image), behind a per-feature AI setting.
- [x] Draft for review: the user confirms; one receipt = one transaction (no line items).
- [x] Avoid duplicates: on confirm, attach the photo to a matching existing movement (same account, amount, date ±3 days) instead of creating a new one.
- [x] Merchant tax ID → name → category table that learns from confirmations.
- [ ] (Optional) On-device OCR preview on mobile (ML Kit / Apple Vision).

---

### 15. Recurring Payments Screen & Suggestions ⏳ PENDING
A dedicated screen to see and manage recurring payments (feature 12), fed by what the bank sync already imported.
- [ ] Calendar of the period with **day / week / month** views, and next to it the list of payments of that period (due, paid, skipped, overdue).
- [ ] Add, edit, pause and delete a recurring payment; mark an occurrence as paid or skipped.
- [ ] **Suggested recurring payments** section, detected from synced movements: same merchant (or alias, feature 17), similar amount (±15%, wider for utilities) and a regular interval (weekly, biweekly, monthly, yearly…), seen at least 2–3 times.
- [ ] Each suggestion shows the evidence (dates and amounts found) and can be **added with one click** (name, amount, frequency, next date, account and tracking mode pre-filled) or dismissed (it doesn't come back).
- [ ] Detection runs without AI. **AI (optional, per-feature AI setting)** only classifies the suggestion: kind (subscription, utility, loan…), category and a friendly name. The user always confirms; nothing is created automatically.
- [ ] Once added, the movements that originated the suggestion are linked to it (past occurrences marked as paid).

---

### 16. Card Movements Categorization ⏳ PENDING
A section to review and categorize every movement of a card or account in bulk.
- [ ] List of movements of the selected account and period, grouping uncategorized ones first.
- [ ] **AI categorization** (per-feature AI setting): suggests a category for each uncategorized movement using merchant, description, amount and the user's own category tree. Suggestions are shown as pending until accepted (one by one or all at once).
- [ ] **Manual override**: move one or several movements to another category (select + choose category, or drag and drop on web).
- [ ] Learn from corrections: a correction creates or updates a merchant rule (merchant → category) so future movements of that merchant are categorized without AI (closes "merchant memory rules", feature 4).
- [ ] Only data needed to categorize is sent to the AI provider (no account numbers or balances).

---

### 17. Merchant Aliases (display names & privacy) ⏳ PENDING
Show a different name for some movements: to keep a payment private when someone else sees the screen, or to rename cryptic bank descriptions.
- [ ] Alias rules: **match** (contains, starts with, exact, or regular expression for advanced users; case- and accent-insensitive) on the original description/merchant → **display name**, optional category and optional "private" flag.
- [ ] One-off alias for a single movement (without creating a rule).
- [ ] The original description is kept and never modified; it is hidden by default and can be revealed on demand (e.g. "ver original").
- [ ] **Private** aliases also hide the original in lists, search results and exports.
- [ ] Rules apply to existing and future movements (synced, imported from statements or created by hand), and are used by recurring suggestions (feature 15) and categorization (feature 16).
- [ ] Rule preview: shows which movements match before saving.

---

### 18. Account & Card Personalization ⏳ PENDING
- [ ] Rename an account or card (nickname visible only to the user; the bank's original name is kept).
- [ ] Card design: one color or a two-color gradient; the text color (white or dark) is picked automatically to keep WCAG AA contrast.
- [ ] Preset palette plus custom color; preview of the card while editing.
- [ ] The nickname and design are used everywhere the account appears (dashboard, cards, history, filters, forms).

---

### 19. Transaction Creation Flow ⏳ PENDING
One flow on web and mobile to register movements by hand.
- [ ] First step: choose **expense, income or transfer between accounts**.
- [ ] Expense / income: amount, account, date, category (suggested from merchant rules), description, optional attachment.
- [ ] Transfer: from account, to account, amount, date; credit card payments are a transfer to the card.
- [ ] **Capture receipt** (expenses only): take or upload a photo; the receipt extraction (feature 14) pre-fills amount, date and merchant; the user confirms; the photo stays attached.
- [ ] Avoid duplicates: warn when a synced movement with the same account, amount and close date already exists, and offer to attach the receipt to it instead.
- [ ] Dates in the user's local time (fix: today the date is stored in UTC and can move to the next day).

---

### 20. Manual Accounts & Cards ⏳ PENDING
For banks Syncfy doesn't support or when the connection fails.
- [ ] Add a debit account or a credit card by hand: bank (list of Mexican banks or free text), nickname, last 4 digits, currency, current balance (debit) or current debt + credit limit (credit).
- [ ] Credit cards: statement (cut-off) day, payment due day and optional interest rate (saves `CreditCardTerms`, today there is no mutation for it).
- [ ] The initial balance is recorded as an opening balance adjustment, not as income or expense of the month.
- [ ] Manual accounts accept manual movements (feature 19) and statement PDFs (feature 13).
- [ ] Later, a manual account can be linked to a bank connection without losing its history.
- [ ] Personalization (feature 18) available from creation.

---

## 🔧 Tech Stack

| Layer        | Technology         |
|--------------|--------------------|
| Frontend     | Next.js (Vercel)   |
| Mobile       | React Native (Expo)|
| Backend      | NestJS (GraphQL)   |
| DB           | PostgreSQL (Dokploy on Hetzner) |
| Storage      | AWS S3 (private bucket) |
| Hosting      | Vercel (web) + Dokploy on Hetzner (API) |
| Bank APIs    | Syncfy (formerly Paybook) |
| AI           | Anthropic, OpenAI, Gemini (admin-managed catalog) |

---

## 🗂️ Entities & Data Models (High-level)

- **User**: id, name, email, passwordHash
- **Account**: id, userId, type, name, balance, currency, metadata
- **Transaction**: id, accountId, type, amount, categoryId, date, description, attachmentUrl
- **Category**: id, userId, parentId, name
- **Debt**: id, userId, name, principal, interestRate, minPayment, statementDate, dueDate
- **Goal**: id, userId, name, targetAmount, dueDate, currentAmount
- **Notification**: id, userId, type, title, message, status
- **Attachment**: id, transactionId, fileUrl, fileType, uploadedAt

---

## 📈 Metrics of Success
- [ ] 80%+ of users complete account setup in < 5 minutes.
- [ ] 70%+ of users connect at least one bank account.
- [ ] Users log ≥ 10 transactions in their first month.
- [ ] ≥ 85% auto-categorization accuracy after 1 month (with feedback).
- [ ] Cash flow projection used by 50%+ of active users monthly.

---

## 📊 Scope Implemented

### 🟡 **GraphQL API**
Detailed, verified status per feature and platform: [features.md](./features.md).

**Implemented:**
- **Authentication**: invitation-only (no sign-up), sign in with password or Google, refresh tokens with revocation, password reset token flow (no email delivery yet).
- **Admin**: master admin (CLI), admins, user access management, AI models and per-feature AI settings.
- **Web create & accounts**: "+" flow for expenses, income and transfers (card payments) with duplicate check, category suggestion and receipt upload; `/accounts` with manual accounts (debit, credit with terms, cash, savings), nickname and card design.
- **Recurring payments screen**: `/recurring` with day/week/month calendar, payment actions, recurring expense CRUD and suggestions detected from movements (rules) and classified with AI; accept in one click or dismiss.
- **Categorization & aliases**: bulk categorization with merchant rules learned from corrections, AI category suggestions on demand, alias rules (contains/starts with/exact/regex, private) materialized per transaction, one-off aliases.
- **Web screens**: transaction detail (edit, attachments, alias, reveal original), notifications panel and page, statement upload and review, budgets, debts (month-by-month payoff simulation), goals and the what-if simulator.
- **Receipts (OCR)**: internal OCR service (RapidOCR), receipt upload with CFDI QR / OCR rules / AI-text fallback, review and confirm or attach to an existing movement; scanned statements read with OCR.
- **i18n**: categories stored in English with es/en translations (Google Cloud Translation, AI fallback); user language preference.
- **Fixes**: transaction dates stored as the local (Mexico City) day; opening balances as adjustments; consistent cursor pagination; credit card terms mutation; goals fully exposed; duplicate check (`similarTransactions`).
- **Accounts**: multi-account support (cash, debit, credit, savings, e-wallet), balance adjustments, credit card terms.
- **Transactions**: CRUD, merchant-based category suggestion, filtering, attachment records (URL only).
- **Transfers**: inter-account transfers with atomic validation.
- **Categories**: hierarchical defaults and user categories.
- **Budgets**: monthly/category budgets, templates, usage and alerts on query.
- **Debts**: loans and credit cards, payments, avalanche/snowball strategies.
- **Goals**: create, list and progress (contributions not exposed yet).
- **Notifications**: list and mark as read (nothing generates them yet).
- **Reports**: monthly summary, cash flow projection, "What If" scenarios.

**Architecture:** code-first NestJS GraphQL (11 modules), cursor pagination, DTOs separate from Prisma entities, typed errors, JWT guards with per-user isolation.

**Testing:** Jest unit tests for 6 of 11 modules (auth, accounts, budgets, debts, goals, transactions); no E2E tests yet.

**Deployment:** Docker image deployed with Dokploy on Hetzner, with `production` (`main`) and `testing` (`testing`) environments ([deployment.md](./deployment.md)).

**Not implemented:** CSV export, email delivery, weekly reconciliation review.

### 🟡 **MOBILE APP (Expo) — UI with mock data**
- Expo Router app (`apps/finnit-app`) with login, dashboard, history, analytics, calendar, cards and settings screens (NativeWind v5).
- Login connected to the `signIn` mutation (urql + SecureStore).
- Pending: replace mock data with GraphQL queries, signup, token refresh, route guard, create forms.

### 🟡 **WEB APP (Next.js) — UI with mock data**
- `apps/web`: Next.js 16 App Router with the same screens as mobile (`/login`, `/dashboard`, `/history`, `/analytics`, `/calendar`, `/cards`, `/settings`), responsive layout (sidebar on desktop, bottom nav on small screens) and light/dark theme.
- `packages/ui` (`@finnit/ui`): shared web component library built on shadcn/ui + Radix UI + Tailwind v4, with web equivalents of every mobile component and design tokens ported from the mobile app (adjusted to meet WCAG 2.1 AA contrast).
- `apps/storybook`: Storybook 10 documenting all components (79 stories, light/dark), audited with axe-core: 0 WCAG 2.1 AA violations.
- Pending: GraphQL data, real authentication, create forms, file upload, Vercel deployment.

---

## 🔄 Out of Scope (for MVP)
- Multi-user/shared accounts.
- Advanced AI recommendations beyond categorization.
- Tax reporting tools.
- Offline mode.
- Subscription billing.
