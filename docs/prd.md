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
- [x] Sign up/login with secure JWT-based auth.
- [x] Password hashing, refresh tokens, and session handling.
- [x] Single-tenant per account, roles: `owner`.
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
- [x] Quick add: date, account, amount, type (income/expense/transfer), category.
- [ ] Multiple transactions per account on the same day (blocked by a unique constraint; fix planned).
- [ ] Smart capture: receipt photos, SMS/notification parsing (where allowed).
- [x] Category suggestion based on merchant name (no learning from corrections yet).
- [ ] Recurring entries as reminders until confirmed as paid (see feature 12).
- [ ] Auto-suggestion of recurrence from detected patterns.
- [ ] Calendar view + optional mobile widget.
- [ ] Attachments for receipts, invoices, payment confirmations (only a URL is stored; no S3 upload).
- [ ] Integration with Banxico for CEP retrieval (interbank transfers).
- [x] Search & filter by date, account, category, text.

---

### 4. Categories ✅ IMPLEMENTED
- [x] Default hierarchical category list (e.g., "Food > Groceries").
- [x] CRUD for user-defined categories.
- [ ] Merchant "memory rules" for auto-categorization.

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

### 9. Bank & Fintech Integrations ⏳ PENDING
- [ ] Integration with Belvo for auto-import (sandbox first).
- [ ] Weekly reconciliation for balances and transactions.
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
- [ ] Recurring transaction reminders.
- [ ] Weekly/monthly summaries.

Nothing generates notifications yet (no scheduled jobs).

---

### 12. Recurring Expenses ⏳ PENDING
- [ ] Recurring commitments with frequency (weekly, biweekly, semimonthly, monthly, bimonthly, quarterly, semiannual, yearly) and kind (subscription, utility, loan, installment/MSI, insurance, housing, membership, other).
- [ ] Tracking mode per expense: `automatic` (marked paid when reconciled with the card), `manual` (user confirms), `reminder` (no payment state).
- [ ] Upcoming payments and normalized monthly cost by kind and account.
- [ ] Installment (MSI) progress.
- [ ] Generated reminders.

---

### 13. Card Statements & Reconciliation ⏳ PENDING
- [ ] Upload the monthly statement PDF (stored in AWS S3).
- [ ] Extraction: local Banamex parser, Claude API fallback for other formats.
- [ ] Review and confirm imported movements.
- [ ] Reconcile statement lines with existing transactions and automatic recurring expenses.
- [ ] Card month summary vs. amount due.
- [ ] Same flow fed by Belvo sync.

---

## 🔧 Tech Stack

| Layer        | Technology         |
|--------------|--------------------|
| Frontend     | Next.js (Vercel)   |
| Mobile       | React Native (Expo)|
| Backend      | NestJS (GraphQL)   |
| DB           | PostgreSQL (Railway)|
| Storage      | AWS S3             |
| Hosting      | Vercel (FE) + Railway (BE) |
| Bank APIs    | Belvo / Paybook    |

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
- **Authentication**: sign up, sign in, refresh tokens, password reset token flow (no email delivery yet).
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

**Not implemented:** bank integrations, S3 file upload, CSV export, email delivery, notification generation, recurring expenses, statement import.

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
