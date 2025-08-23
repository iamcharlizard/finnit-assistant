# Finnit Assistant API - GraphQL Module Structure

This document outlines the complete NestJS GraphQL API structure for the Finnit Assistant MVP.

## 🏗️ Architecture Overview

The API follows a modular architecture with the following patterns:
- **Code-first GraphQL** approach using NestJS decorators
- **Cursor-based pagination** for all list queries
- **JWT authentication** with guards on protected routes
- **Prisma ORM** for database operations
- **Strict TypeScript** with comprehensive error handling
- **Validation** using class-validator decorators

## 📦 Modules Implemented

### 1. Authentication Module (`/auth`)
- **Resolver**: `AuthResolver`
- **Service**: `AuthService`
- **Features**:
  - User registration/login with JWT tokens
  - Password hashing with bcrypt
  - Token refresh functionality
  - Password reset flow (framework ready)

**Key Mutations:**
- `signUp(input: SignUpInput): AuthPayload`
- `signIn(input: SignInInput): AuthPayload`
- `refreshToken(input: RefreshTokenInput): AuthPayload`

**Key Queries:**
- `me: User` (protected)
- `validateToken(token: String): TokenValidationResult`

### 2. Users Module (`/users`)
- **Resolver**: `UsersResolver`
- **Service**: `UsersService`
- **Features**:
  - User profile management
  - Profile updates with validation

**Key Operations:**
- `updateUser(input: UpdateUserInput): User`

### 3. Accounts Module (`/accounts`)
- **Resolver**: `AccountsResolver`
- **Service**: `AccountsService`
- **Features**:
  - Multiple account types (cash, credit, debit, savings, ewallet)
  - Balance tracking and adjustments
  - Cursor-based pagination
  - Account archiving

**Key Operations:**
- `accounts(filters): AccountConnection`
- `createAccount(input: CreateAccountInput): Account`
- `adjustAccountBalance(input: AdjustBalanceInput): Account`

### 4. Categories Module (`/categories`)
- **Resolver**: `CategoriesResolver`
- **Service**: `CategoriesService`
- **Features**:
  - Hierarchical category structure
  - User-specific and global default categories
  - Circular reference prevention

**Key Operations:**
- `categories: [Category]`
- `rootCategories: [Category]` (tree structure)
- `createCategory(input: CreateCategoryInput): Category`

### 5. Transactions Module (`/transactions`)
- **Resolver**: `TransactionsResolver`
- **Service**: `TransactionsService`
- **Features**:
  - Full transaction CRUD with validation
  - Advanced filtering (date range, category, type, search)
  - Attachment support
  - Automatic balance updates
  - Cursor-based pagination

**Key Operations:**
- `transactions(filters): TransactionConnection`
- `createTransaction(input: CreateTransactionInput): Transaction`
- `addTransactionAttachment(input: CreateAttachmentInput): Attachment`

### 6. Transfers Module (`/transfers`)
- **Resolver**: `TransfersResolver`
- **Service**: `TransfersService`
- **Features**:
  - Inter-account transfers with validation
  - Atomic dual-transaction creation
  - Balance validation and updates

**Key Operations:**
- `createTransfer(input: CreateTransferInput): Transfer`

### 7. Budgets Module (`/budgets`)
- **Resolver**: `BudgetsResolver`
- **Service**: `BudgetsService`
- **Features**:
  - Monthly budget creation with category limits
  - Budget usage tracking and calculations
  - Spending analysis

**Key Operations:**
- `createBudget(input: CreateBudgetInput): Budget`
- `budgetUsage(id: String): [BudgetUsage]`

### 8. Goals Module (`/goals`)
- **Resolver**: `GoalsResolver`
- **Service**: `GoalsService`
- **Features**:
  - Financial goal tracking
  - Progress calculation with time analysis
  - Contribution tracking

**Key Operations:**
- `createGoal(input: CreateGoalInput): Goal`
- `goalProgress(id: String): GoalProgress`

### 9. Notifications Module (`/notifications`)
- **Resolver**: `NotificationsResolver`
- **Service**: `NotificationsService`
- **Features**:
  - Real-time notifications via GraphQL subscriptions
  - Status management (scheduled, sent, read)
  - Cursor-based pagination

**Key Operations:**
- `notifications(filters): NotificationConnection`
- `notificationAdded: Notification` (subscription)

### 10. Reports Module (`/reports`)
- **Resolver**: `ReportsResolver`
- **Service**: `ReportsService`
- **Features**:
  - Monthly financial reports with category breakdown
  - Cash flow projections
  - What-if scenario analysis

**Key Operations:**
- `monthlyReport(year: Int, month: Int): MonthlyReport`
- `cashFlowProjection(monthsAhead: Int): [CashFlowProjection]`
- `whatIfScenario(input: WhatIfInput): WhatIfResult`

## 🔒 Security Features

### Authentication & Authorization
- **JWT Strategy**: Configurable token expiration
- **Route Protection**: `@UseGuards(JwtAuthGuard)` on protected endpoints
- **User Context**: `@CurrentUser()` decorator for accessing authenticated user

### Data Validation
- **Input Validation**: Class-validator decorators on all inputs
- **Business Logic Validation**: Custom validation in services
- **Database Constraints**: Prisma schema enforced at DB level

## 🛠️ Common Utilities

### Pagination System
- **Cursor-based pagination** following GraphQL best practices
- **PaginationUtil** helper for consistent connection patterns
- **Configurable limits** with sensible defaults

### Error Handling
- **Typed GraphQL Errors**: Custom error classes with specific codes
- **Business Logic Errors**: Domain-specific error types (InsufficientBalance, etc.)
- **Validation Errors**: Automatic class-validator integration

## 🗄️ Database Integration

### Prisma Setup
- **PrismaService**: Singleton connection service
- **Type Safety**: Generated Prisma client with full TypeScript support
- **Transaction Support**: Atomic operations for complex business logic

### Data Mapping
- **DTO Mapping**: Clean separation between Prisma models and GraphQL types
- **Decimal Handling**: Proper number conversion from Prisma Decimal
- **Relationship Loading**: Explicit includes for performance

## 🚀 Development Workflow

### Environment Configuration
- **Environment Variables**: JWT_SECRET, DATABASE_URL, PORT
- **Example File**: `.env.example` provided
- **Validation**: Environment validation at startup

### GraphQL Schema
- **Auto-generated Schema**: `schema.gql` generated from code
- **Playground**: Available in development mode
- **Introspection**: Enabled for development

## 📝 Next Steps

To complete the MVP, consider implementing:

1. **Bank Connections Module**: Integration with Belvo/Paybook APIs
2. **Debts Module**: Debt tracking and payment strategies  
3. **Recurring Transactions**: Automated transaction creation
4. **Advanced Reconciliation**: Bank transaction matching
5. **Email/SMS Notifications**: External notification delivery
6. **File Upload**: Attachment handling with cloud storage
7. **Advanced Analytics**: More sophisticated reporting

## 🧪 Testing

The scaffolded API includes:
- **Unit Tests**: Service layer business logic testing
- **Integration Tests**: End-to-end GraphQL operations
- **Type Safety**: Compile-time validation

Run tests with:
```bash
npm run test          # Unit tests
npm run test:e2e      # Integration tests
```

## 🔄 GraphQL Introspection

Once running, explore the API at `http://localhost:3000/graphql` with full schema documentation and interactive playground.