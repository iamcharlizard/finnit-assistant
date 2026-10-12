# 📋 Checklist de Próximos Pasos - Finnit Assistant

**Creado:** 23 de Agosto, 2025
**Última actualización:** 12 de Octubre, 2026
**Prioridad:** Alta

## 🎯 Objetivo
Llevar la app móvil de "UI con datos mock" a "app funcional conectada a la API", y dejar la API probada y desplegable.

## ✅ Estado Actual
- [x] API backend completa (11 módulos GraphQL)
- [x] Base de datos PostgreSQL + Prisma con migraciones aplicadas
- [x] Autenticación JWT implementada en la API
- [x] App móvil Expo con navegación, pantallas y componentes de finanzas (NativeWind v5)
- [x] Login móvil conectado a la API (urql + SecureStore)
- [x] Unit tests para 6 servicios de la API
- [x] Web app (Next.js) + librería `@finnit/ui` + Storybook, con datos mock
- [x] API desplegada (Hetzner + Dokploy) en production y testing
- [x] Inventario de funcionalidades verificado: `docs/features.md`

## 🚀 Próximas Tareas Prioritarias

### 🔥 CRÍTICO

#### 0. **Gastos recurrentes y estados de cuenta (API primero)**
- [ ] Quitar la restricción única `[userId, accountId, txnDate]` de `Transaction`
- [ ] Gastos recurrentes: tipos, frecuencias, modo de seguimiento (automático/manual/recordatorio), ocurrencias y recordatorios
- [ ] Subida de estados de cuenta PDF a S3, parser Banamex + respaldo con Claude
- [ ] Conciliación de movimientos con transacciones y gastos recurrentes; resumen del mes de la tarjeta
- [ ] Belvo en sandbox
- [ ] UI móvil y web de estas secciones

#### 1. **Conectar pantallas móviles a la API**
- [ ] Crear `lib/graphql/queries/` con las queries necesarias (urql, no React Query)
- [ ] Dashboard: resumen financiero (módulo reports) + transacciones recientes
- [ ] History: transacciones con paginación por cursor y filtros
- [ ] Cards: cuentas y límite de crédito (módulo accounts)
- [ ] Calendar: pagos programados y proyecciones
- [ ] Analytics: distribución mensual y salud financiera (módulo reports)
- [ ] Estados de carga, vacío y error en cada pantalla
- [ ] Eliminar los datos mock (`MOCK_FINANCIAL_DATA`, `RECENT_TRANSACTIONS`, `CARDS`, etc.)

#### 2. **Completar autenticación móvil**
- [ ] Pantalla de Signup (mutación `signUp`)
- [ ] Refresh automático del access token (mutación `refreshToken`)
- [ ] Guard de rutas: redirigir a `/dashboard` si hay sesión y a `/login` si no
- [ ] Flujo de recuperación de contraseña (opcional para MVP)

#### 3. **Tests de la API**
- [ ] Unit tests para categories, transfers, notifications, reports, users
- [ ] E2E: register → login → create transaction
- [ ] Probar manejo de errores tipados

### 🔶 IMPORTANTE

#### 4. **Formularios de creación en móvil**
- [ ] Crear transacción (ingreso/gasto) con categoría y cuenta
- [ ] Crear transferencia entre cuentas
- [ ] Pantalla de deudas: listado, agregar deuda, registrar pago
- [ ] Crear presupuesto y meta

#### 5. **CI/CD y Deploy**
- [ ] GitHub Actions: `pnpm lint`, `pnpm check-types`, `pnpm turbo run test`
- [x] Deploy API (Hetzner + Dokploy, production y testing)
- [ ] Respaldos diarios de las bases en Dokploy
- [ ] Validar flujos completos en producción

#### 6. **File Upload**
- [ ] Confirmar/implementar signed URLs de S3 en la API
- [ ] Selección de archivos en móvil y subida a S3
- [ ] Mostrar adjuntos en transacciones

### 🔵 NICE TO HAVE

#### 7. **Web App (Next.js)**
- [x] Scaffold `apps/web` con Next.js 16 y `@finnit/ui` (shadcn + Radix)
- [x] Storybook con todos los componentes
- [x] Pantallas con datos mock
- [ ] Cliente GraphQL (compartir operaciones con mobile)
- [ ] Autenticación real
- [ ] Formularios para transacciones y deudas
- [ ] Deploy en Vercel

#### 8. **Features Avanzadas**
- [ ] Notificaciones push para pagos de deudas
- [ ] Export de datos (CSV/PDF)
- [ ] Búsqueda de transacciones
- [ ] Integración bancaria (Belvo/Paybook)

#### 9. **Monitoreo y Analytics**
- [ ] Logging de errores
- [ ] Métricas de performance
- [ ] Analytics de uso

## 🛠️ Recursos Necesarios

### Herramientas
- [ ] Expo account para builds (EAS)
- [ ] Vercel account para web deploy
- [ ] AWS S3 bucket configurado

### Documentación
- [ ] API documentation (GraphQL schema)
- [ ] Setup guides para desarrolladores
- [ ] Deployment procedures

## 🚨 Riesgos Identificados

### Alto Riesgo
- **Mocks vs. contrato real:** los tipos de las pantallas se diseñaron sobre datos mock; pueden no coincidir con el schema GraphQL.
- **Integración con AWS S3:** no verificada en el código.

### Medio Riesgo
- **Expiración de tokens:** sin refresh, la sesión móvil fallará al expirar el access token.
- **Cobertura de tests:** el PRD declara >90%, pero solo 6 de 11 módulos tienen tests.

### Bajo Riesgo
- **UI/UX:** puede requerir iteraciones.

## 🔗 Documentación
- [Plan de desarrollo](./development-plan.md)
- [Resolución de errores API](./api-error-resolution.md)
- [Progreso actual](./progress.md)

---

**Nota:** Esta checklist debe actualizarse con el progreso real y ajustarse según las prioridades del negocio.
