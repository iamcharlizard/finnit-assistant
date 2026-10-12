# 📊 Progreso del Desarrollo - Finnit Assistant

**Última actualización:** 11 de Octubre, 2026 (web app UI)
**Estado general:** 🟡 En progreso

## 🎯 Estado por Etapas

### ✅ STEP 0: CONTEXT LOAD
- [x] Leer PRD (`docs/prd.md`)
- [x] Entender tech stack: NestJS (GraphQL), React Native, Next.js, PostgreSQL (Prisma), AWS S3
- [x] Inicializar documentación de progreso

### ✅ STEP 1: BACKEND API - NESTJS + GRAPHQL
- [x] **Project Scaffold**
  - [x] NestJS project con GraphQL setup (code-first, Apollo Server 5)
  - [x] Prisma + PostgreSQL integration
  - [x] Configuración `.env` (`apps/api/.env.example`) y conexión inicial DB

- [x] **Entities & Models**
  - [x] Modelos definidos en `packages/database/prisma/schema.prisma`
  - [x] Migraciones aplicadas: `20250813091847_init`, `20250823110041_unique_indexes_created`

- [x] **Módulos GraphQL (11)**
  - [x] auth, users, accounts, categories, transactions, transfers, budgets, goals, debts, notifications, reports
  - [x] Auth: `signUp`, `signIn`, `refreshToken`, `requestPasswordReset`, `resetPassword`, `validateToken`
  - [x] Paginación por cursor, errores tipados, DTOs separados de entidades Prisma

- [x] **Business Logic**
  - [x] Servicios para transactions, debts, budgets, goals, etc.
  - [x] Validación de inputs y guard de ownership

- [ ] **File Upload (S3)** — sin verificar en el código; pendiente de confirmar/implementar

- [ ] **CI/CD**
  - [ ] GitHub Actions para lint, test y build (hoy solo existen `claude.yml` y `claude-code-review.yml`)
  - [ ] Deploy a Railway

### 🔧 **RESOLUCIÓN DE ERRORES CRÍTICOS** ✅
- [x] DebtsArgs - Extensión de Interfaz Incorrecta
- [x] Campos pageInfo con tipo 'any'
- [x] Campos JSON con tipo 'any'
- [x] CategoryUsageArgs - Tipo Incorrecto
- [x] Duplicación de Clase User
- [x] Configuración de Resolvers JSON

Detalle en [api-error-resolution.md](./api-error-resolution.md).

### 🟡 STEP 2: MOBILE APP - REACT NATIVE + EXPO
- [x] **Scaffold App**
  - [x] Expo app con TypeScript (`apps/finnit-app`, Expo SDK 56, RN 0.85)
  - [x] Navegación con Expo Router: grupo `(app)` + `BottomNavBar` y `TopAppBar` propios
  - [x] Styling con NativeWind v5 + Tailwind v4; componentes UI base (`button`, `input`, `typography`, `glass-view`)
  - [x] ThemeContext (dark/light)

- [ ] **Authentication**
  - [x] Pantalla de Login
  - [x] Cliente GraphQL (urql) con token Bearer desde SecureStore (`lib/graphql/client.ts`)
  - [x] `AuthContext` conectado a la mutación `signIn`; tokens y usuario persistidos en SecureStore
  - [ ] Pantalla de Signup (mutación `signUp` ya existe en la API)
  - [ ] Refresh automático del access token (`refreshToken`)
  - [ ] Protección de rutas del grupo `(app)` según sesión (hoy `/` redirige siempre a `/login`)

- [ ] **Dashboard**
  - [x] UI: balance, ingresos/gastos mensuales, transacciones recientes, acciones rápidas
  - [ ] Conectar a la API (hoy usa `MOCK_FINANCIAL_DATA` / `RECENT_TRANSACTIONS`)

- [ ] **History (Transactions)**
  - [x] UI de listado con filtros
  - [ ] Conectar a la API con paginación por cursor
  - [ ] Formulario para crear transacción

- [ ] **Cards (Accounts)**
  - [x] UI de tarjetas y límite de crédito
  - [ ] Conectar a la API

- [ ] **Calendar**
  - [x] UI de pagos programados y proyecciones
  - [ ] Conectar a la API

- [ ] **Analytics**
  - [x] UI de distribución mensual y salud financiera
  - [ ] Conectar al módulo reports

- [x] **Settings** — UI implementada

- [ ] **Debts**
  - [ ] Listado de deudas con estado actual
  - [ ] Agregar deuda
  - [ ] Registrar pago

- [ ] **File Upload**
  - [ ] Seleccionar documento desde el teléfono
  - [ ] Subir a S3 vía signed URL

> Nota: las queries comentadas en las pantallas usan sintaxis de React Query, pero el cliente del proyecto es urql. Ajustar al conectar.

### 🟡 STEP 3: WEB APP - NEXT.JS
- [x] **Librería de componentes `@finnit/ui`** (`packages/ui`)
  - [x] shadcn/ui + Radix UI + Tailwind v4, tokens portados de `apps/finnit-app/global.css` (light/dark)
  - [x] Primitivas: button, input, label, card, badge, switch, checkbox, toggle-group, avatar, progress, separator, dropdown-menu, sheet, tooltip, typography
  - [x] Equivalentes web de todos los componentes móviles (finanzas, navegación, settings) con los mismos nombres y props
- [x] **Storybook** (`apps/storybook`, Storybook 10) con stories para cada componente, tema claro/oscuro y addon a11y
- [x] **Scaffold Next.js App** (`apps/web`, Next.js 16 App Router)
  - [x] Rutas espejo de mobile: `/login`, `/dashboard`, `/history`, `/analytics`, `/calendar`, `/cards`, `/settings`
  - [x] Layout responsivo: sidebar en desktop, top bar + bottom nav en móvil
  - [x] Modo oscuro con `next-themes`
- [ ] **Datos reales**: reemplazar `apps/web/lib/mocks/` por GraphQL
- [ ] **Auth**: conectar `/login` a `signIn`, Signup, guardar/renovar JWT, proteger rutas
- [ ] **Forms**: nueva transacción/deuda/pago, file upload
- [ ] Deploy en Vercel

### 🟡 STEP 4: TESTING & MONITORING
- [x] Unit tests (Jest) para: auth (service + resolver), accounts, budgets, debts, goals, transactions
- [ ] Unit tests para: categories, transfers, notifications, reports, users
- [ ] E2E tests de la API (flujo register → login → create transaction)
- [ ] Tests en la app móvil
- [ ] Log de errores clave y tiempos de respuesta

### ⏳ STEP 5: DEPLOYMENT & VALIDATION
- [ ] Deploy backend a Railway
- [ ] Deploy frontend web a Vercel
- [x] `.env.example` de la API
- [ ] Validar core flows: register → create debt → add transactions → see dashboard

## 📈 Métricas de Progreso

- **Backend API:** ~95% ✅ (falta CI/CD y confirmar file upload)
- **Mobile App:** ~40% 🟡 (UI + login listos; falta conectar datos y formularios)
- **Web App:** ~35% 🟡 (UI + Storybook listos; falta datos reales, auth y formularios)
- **Testing:** ~30% 🟡 (6 de 11 módulos de la API con unit tests)
- **Deployment:** 0% ⏳

## 🚀 Próximos Pasos Inmediatos

1. **Conectar la app móvil a la API** — crear queries urql en `lib/graphql/queries/` y reemplazar los mocks, empezando por Dashboard e History.
2. **Completar auth móvil** — Signup, refresh de token y guard de rutas.
3. **Formularios de creación** — transacción, deuda y pago.
4. **Completar tests de la API** y montar CI (lint + check-types + test).

Lista detallada en [next-steps-checklist.md](./next-steps-checklist.md).

## 🔗 Enlaces Útiles

- [Documentación de resolución de errores](./api-error-resolution.md)
- [Plan de desarrollo original](./development-plan.md)
- [PRD del proyecto](../docs/prd.md)
