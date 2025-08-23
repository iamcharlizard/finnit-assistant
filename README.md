# Finnit Assistant

A comprehensive financial management application built with modern web technologies. This monorepo contains a NestJS GraphQL API, React Native mobile app, and shared database package using Prisma ORM.

## 🏗️ Architecture Overview

This project is built as a **Turborepo monorepo** with the following structure:

### 📱 Applications
- **API** (`apps/api/`) - NestJS GraphQL API with Prisma integration
- **Mobile App** (`apps/finnit-app/`) - React Native with Expo

### 📦 Shared Packages
- **Database** (`packages/database/`) - Prisma client and schema for PostgreSQL
- **ESLint Config** (`packages/eslint-config/`) - Shared linting rules
- **TypeScript Config** (`packages/typescript-config/`) - Shared TS configurations

### 🛠️ Technology Stack
- **Runtime**: Node.js ≥18
- **Package Manager**: Yarn (required)
- **Database**: PostgreSQL
- **API**: NestJS + GraphQL + Prisma ORM
- **Mobile**: React Native + Expo
- **Language**: TypeScript (strict mode)
- **Monorepo**: Turborepo

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js** ≥18
- **Yarn** (not npm)
- **Docker** and **Docker Compose**
- **Git**

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd finnit-assistant

# Install all dependencies (uses Yarn workspaces)
yarn install
```

### Step 2: Database Setup

1. **Start the PostgreSQL database using Docker:**
   ```bash
   # Start the database container in the background
   docker-compose up -d postgres

   # Verify the database is running
   docker-compose ps
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example environment file
   cp apps/api/.env.example apps/api/.env

   # The DATABASE_URL is already configured for the Docker database:
   # DATABASE_URL="postgresql://finnit_user:finnit_password@localhost:5432/finnit_db"
   ```

3. **Generate Prisma client and run migrations:**
   ```bash
   # Generate Prisma client
   turbo run db:generate

   # Run database migrations
   turbo run db:migrate:dev

   # Optional: Seed the database with sample data (genera cliente automáticamente)
   turbo run db:seed
   ```

4. **Optional: Use pgAdmin for database management:**
   ```bash
   # Start pgAdmin (web-based database administration)
   docker-compose up -d pgadmin

   # Access pgAdmin at http://localhost:8080
   # Login: admin@finnit.com / admin123
   ```

### Step 3: Start Development Servers

Choose one of the following options:

#### Option A: Start All Services
```bash
# Start API and mobile app simultaneously
yarn dev
```

#### Option B: Start Individual Services

**API Server:**
```bash
# Start API with database build
yarn api:dev

# Or just the API (if database is already built)
yarn start:api

# API will be available at http://localhost:3000
# GraphQL Playground at http://localhost:3000/graphql
```

**Mobile App:**
```bash
# Start Expo development server
turbo run start --filter=finnit-app

# Or with specific platform
turbo run android --filter=finnit-app  # Android
turbo run ios --filter=finnit-app      # iOS
turbo run web --filter=finnit-app      # Web
```

### Step 4: Verify Setup

1. **Check API:**
   - Visit http://localhost:3000/graphql
   - Ensure GraphQL Playground loads

2. **Check Mobile App:**
   - Scan QR code with Expo Go app
   - Or use simulator/emulator

3. **Check Database:**
   ```bash
   # Open Prisma Studio to browse your data
   turbo run studio --filter=@finnit/database

   # Or use pgAdmin at http://localhost:8080 (if started)
   ```

## 🔧 Development Commands

### Root Level Commands
```bash
yarn dev          # Start all development servers
yarn build        # Build all applications and packages
yarn lint         # Run linting across all packages
yarn format       # Format code using Prettier
yarn check-types  # Run TypeScript type checking
```

### Database Commands
```bash
# Start/stop database container
docker-compose up -d postgres    # Start database
docker-compose stop postgres     # Stop database
docker-compose down              # Stop and remove containers

# Generate Prisma client
turbo run db:generate

# Run migrations in development
turbo run db:migrate:dev

# Push schema changes without migration
turbo run db:push

# Open Prisma Studio
turbo run studio

# Seed database
turbo run db:seed

# Seed database (limpiar primero)
turbo run db:seed:clean

# Reset completo de la base de datos
turbo run db:reset

# Reset completo y sembrar datos
turbo run db:reset:seed

# Database administration
docker-compose up -d pgadmin     # Start pgAdmin (http://localhost:8080)
```

### API Commands
```bash
# Start API in development mode
turbo run start:dev --filter=@finnit/api

# Run API tests
turbo run test --filter=@finnit/api

# Run API E2E tests
turbo run test:e2e --filter=@finnit/api

# Check API types
turbo run check-types --filter=@finnit/api
```

### Mobile App Commands
```bash
# Start development server
turbo run start --filter=finnit-app

# Run on specific platforms
turbo run android --filter=finnit-app
turbo run ios --filter=finnit-app
turbo run web --filter=finnit-app

# Lint mobile app
turbo run lint --filter=finnit-app
```

## 📝 Environment Configuration

### Required Environment Variables

Create `apps/api/.env` with the following variables:

```bash
# Database (Docker configuration)
DATABASE_URL="postgresql://finnit_user:finnit_password@localhost:5432/finnit_db"

# JWT Authentication
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Server
PORT=3000
NODE_ENV="development"

# Email (optional - for password reset)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
FROM_EMAIL="noreply@finnit.app"
```

See `apps/api/.env.example` for all available configuration options.

## 🗄️ Database Schema

The application uses a comprehensive financial data model including:

- **Users & Authentication** - User management and JWT auth
- **Accounts** - Multiple account types (cash, credit, debit, savings, ewallet)
- **Transactions** - Full transaction lifecycle with categories and attachments
- **Budgeting & Goals** - Budget management and financial goal tracking
- **Recurring Patterns** - Support for recurring transactions
- **Bank Integration** - Connect external bank accounts
- **Debt Management** - Track loans and payment schedules
- **Notifications** - In-app notification system

## 🧪 Testing

### Run Tests
```bash
# Run all tests
turbo run test

# API tests only
turbo run test --filter=@finnit/api

# API E2E tests
turbo run test:e2e --filter=@finnit/api

# Run tests in watch mode
turbo run test:watch --filter=@finnit/api
```

### Test Coverage
```bash
turbo run test:cov --filter=@finnit/api
```

## 📱 Mobile Development

### Development Setup
1. Install Expo CLI: `npm install -g @expo/cli`
2. Install Expo Go app on your device
3. Run `turbo run start --filter=finnit-app`
4. Scan QR code with Expo Go

### Platform-Specific Commands
```bash
# iOS Simulator (requires Xcode)
turbo run ios --filter=finnit-app

# Android Emulator (requires Android Studio)
turbo run android --filter=finnit-app

# Web browser
turbo run web --filter=finnit-app
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Error:**
- Ensure Docker is running: `docker --version`
- Start the database container: `docker-compose up -d postgres`
- Check container status: `docker-compose ps`
- Verify DATABASE_URL matches Docker configuration

**Prisma Client Error:**
- Run `turbo run db:generate`
- Try deleting `node_modules` and reinstalling

**"@prisma/client did not initialize yet" Error:**
- Run `turbo run db:generate` first
- Or use `turbo run db:seed` which generates automatically

**Migration Error (constraint conflicts):**
- Reset database completely: `turbo run db:reset`
- Reset and seed: `turbo run db:reset:seed`
- Or manually: `docker-compose down && docker-compose up -d postgres && turbo run db:migrate:dev`

**New Schema Changes:**
- Run migrations: `turbo run db:migrate:dev`
- Generate client: `turbo run db:generate`
- Seed database: `turbo run db:seed`

**Mobile App Not Loading:**
- Ensure Expo CLI is installed globally
- Check if port 19000 is available
- Try restarting the Expo development server

**TypeScript Errors:**
- Run `yarn check-types` to see all type errors
- Ensure all workspaces are built: `yarn build`

### Development Workflow

1. **Before Starting Work:**
   - Pull latest changes: `git pull`
   - Install dependencies: `yarn install`
   - Start database: `docker-compose up -d postgres`
   - Run migrations: `turbo run db:migrate:dev`

2. **Before Committing:**
   - Run linting: `yarn lint`
   - Run type checking: `yarn check-types`
   - Run tests: `turbo run test`
   - Format code: `yarn format`

3. **Database Changes:**
   - Modify `packages/database/prisma/schema.prisma`
   - Create migration: `turbo run db:migrate:dev`
   - Generate client: `turbo run db:generate`

## 📚 Additional Resources

- [Turborepo Documentation](https://turborepo.org/docs)
- [NestJS Documentation](https://nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Expo Documentation](https://docs.expo.dev/)
- [GraphQL Documentation](https://graphql.org/learn/)

## 🤝 Contributing

1. Follow conventional commit messages
2. Ensure all tests pass
3. Run linting and type checking
4. Update documentation as needed
5. Create pull requests with clear descriptions

---

For more detailed development guidelines, see `CLAUDE.md` in the project root.
