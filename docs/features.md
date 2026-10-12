# Funcionalidades — Finnit Assistant

Inventario de funcionalidades y su estado **real**, verificado contra el código. Es la fuente de verdad del avance; [prd.md](./prd.md) describe el alcance y [user-stories.md](./user-stories.md) los criterios de aceptación.

**Última revisión:** 12 de octubre de 2026

**Leyenda:** ✅ hecho · 🟡 parcial · ⏳ pendiente · — no aplica

- **API**: existe la operación GraphQL/REST y la lógica en el servicio.
- **Móvil** (`apps/finnit-app`) y **Web** (`apps/web`): ✅ solo si la pantalla usa datos reales de la API. Una pantalla con datos mock cuenta como 🟡 (hay UI, falta conectarla).

## Resumen

| Área | API | Móvil | Web |
|---|---|---|---|
| 1. Autenticación y seguridad | 🟡 | 🟡 | 🟡 |
| 2. Cuentas y balances | ✅ | 🟡 | 🟡 |
| 3. Transacciones | 🟡 | 🟡 | 🟡 |
| 4. Categorías | 🟡 | ⏳ | ⏳ |
| 5. Presupuestos | ✅ | ⏳ | ⏳ |
| 6. Deudas y tarjetas | ✅ | ⏳ | ⏳ |
| 7. Metas y ahorro | 🟡 | ⏳ | ⏳ |
| 8. Reportes e insights | 🟡 | 🟡 | 🟡 |
| 9. Integración bancaria (Belvo) | ⏳ | ⏳ | ⏳ |
| 10. Flujo de caja y proyecciones | ✅ | 🟡 | 🟡 |
| 11. Notificaciones | 🟡 | ⏳ | ⏳ |
| 12. Gastos recurrentes *(nuevo)* | ✅ | ⏳ | ⏳ |
| 13. Estados de cuenta y conciliación *(nuevo)* | 🟡 | ⏳ | ⏳ |

## Detalle

### 1. Autenticación y seguridad

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Registro con email y contraseña | ✅ | ⏳ | ⏳ | `signUp`. Crea categorías por defecto. |
| Login con JWT | ✅ | ✅ | ⏳ | `signIn`. Móvil guarda tokens en SecureStore; el login web es solo UI. |
| Refresh token | ✅ | ⏳ | ⏳ | `refreshToken`; ningún cliente renueva el token. |
| Usuario actual / validar token | ✅ | ⏳ | ⏳ | `me`, `validateToken`. |
| Protección de rutas según sesión | — | ⏳ | ⏳ | |
| Recuperar contraseña por email | 🟡 | ⏳ | ⏳ | `requestPasswordReset`/`resetPassword` existen, pero **no se envía correo** (no hay servicio de email). |
| Aislamiento de datos por usuario | ✅ | — | — | Todas las consultas filtran por `userId`. |
| Validación de inputs | ⏳ | — | — | **Bug:** los DTOs tienen decoradores de `class-validator`, pero no hay `ValidationPipe`; se aceptan montos negativos, tasas > 100, etc. |

### 2. Cuentas y balances

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de cuentas (efectivo, débito, crédito, ahorro, e-wallet) | ✅ | 🟡 | 🟡 | Cards con datos mock. |
| Ajuste de saldo sin ingreso/gasto falso | ✅ | ⏳ | ⏳ | `adjustAccountBalance` (tipo `adjustment`). |
| Términos de tarjeta de crédito (corte, pago, tasa) | ✅ | 🟡 | 🟡 | Modelo `CreditCardTerms`. |
| Alta guiada con explicación de tipos | — | ⏳ | ⏳ | Es UI. |
| Escaneo de tarjeta con foto | ⏳ | ⏳ | ⏳ | |

### 3. Transacciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Alta rápida (fecha, cuenta, monto, tipo, categoría) | ✅ | ⏳ | ⏳ | Sin formularios en clientes. |
| Listado con filtros y paginación por cursor | ✅ | 🟡 | 🟡 | History con datos mock. |
| Varias transacciones por cuenta en el mismo día | ✅ | — | — | Se quitó la restricción única `[userId, accountId, txnDate]` (migración `20261012120000`). |
| Categorización sugerida por comercio | 🟡 | ⏳ | ⏳ | Busca por la primera palabra del comercio en transacciones previas; no aprende reglas. |
| Transferencias entre cuentas | ✅ | ⏳ | ⏳ | `createTransfer`. |
| Detección automática de transferencias internas | ⏳ | — | — | |
| Adjuntos (tickets, comprobantes) | 🟡 | ⏳ | ⏳ | Solo guarda una URL; la subida a S3 existe para estados de cuenta, falta usarla en adjuntos. **Bug:** `transaction`/`transactions` nunca devuelven los adjuntos (el mapper los descarta). |
| Captura por foto de ticket / SMS | ⏳ | ⏳ | ⏳ | |
| CEP de Banxico | ⏳ | ⏳ | ⏳ | |
| Etiquetas (tags) | ⏳ | ⏳ | ⏳ | Modelo `Tag` sin API. |

### 4. Categorías

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Lista jerárquica por defecto | ✅ | ⏳ | ⏳ | |
| CRUD de categorías propias | ✅ | ⏳ | ⏳ | |
| Uso por categoría | ✅ | ⏳ | ⏳ | `categoryUsage`. |
| Reglas de comercio que aprenden de correcciones | ⏳ | ⏳ | ⏳ | |

### 5. Presupuestos

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Presupuesto mensual y por categoría | ✅ | ⏳ | ⏳ | Incluye plantillas (`createBudgetFromTemplate`). |
| Uso y resumen en tiempo real | ✅ | 🟡 | 🟡 | La UI de presupuesto usa datos mock. |
| Alertas 80% / 100% | 🟡 | ⏳ | ⏳ | Se calculan al consultar (`budgetAlerts`); no se envían como notificación. |

### 6. Deudas y tarjetas

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Registro de deudas (préstamo, tarjeta) | ✅ | ⏳ | ⏳ | |
| Pagos de deuda | ✅ | ⏳ | ⏳ | `createDebtPayment`. |
| Estrategias avalanche / snowball | ✅ | ⏳ | ⏳ | `payoffStrategy`. |
| Resumen de deudas | ✅ | ⏳ | ⏳ | `debtSummary`. |

### 7. Metas y ahorro

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Crear meta y ver progreso | ✅ | ⏳ | ⏳ | `createGoal`, `goalProgress`. |
| Editar / borrar meta, registrar aportaciones | 🟡 | ⏳ | ⏳ | Existe en el servicio, **no expuesto** en el resolver. |
| Proyección y sugerencias de ahorro | 🟡 | ⏳ | ⏳ | `getGoalProjection`/`getGoalRecommendations` en el servicio, **no expuestos**. |

### 8. Reportes e insights

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Resumen mensual (ingresos, gastos por categoría, neto) | ✅ | 🟡 | 🟡 | `monthlyReport`. |
| Comparativa con el mes anterior y tendencias 3–6 meses | ⏳ | 🟡 | 🟡 | Solo en la UI mock. |
| Insights (gastos inusuales, top categorías) | ⏳ | ⏳ | ⏳ | |
| Exportar a CSV | ⏳ | ⏳ | ⏳ | |

### 9. Integración bancaria (Belvo)

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Conectar banco | ⏳ | ⏳ | ⏳ | Modelos `BankConnection`/`LinkedAccount` sin API. |
| Importar movimientos | ⏳ | ⏳ | ⏳ | Modelo `ImportedTransaction` sin API. |
| Conciliación semanal | ⏳ | ⏳ | ⏳ | Modelos `ReconciliationSession/Item` sin API. |

### 10. Flujo de caja y proyecciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Proyección 30/60 días | ✅ | 🟡 | 🟡 | `cashFlowProjection`. |
| Simulador "What If" | ✅ | ⏳ | ⏳ | `whatIfScenario`. |

### 11. Notificaciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Listar / marcar como leídas | ✅ | ⏳ | ⏳ | |
| Recordatorios de gastos recurrentes | ✅ | — | — | Tarea diaria del módulo de gastos recurrentes. |
| Generación automática (presupuesto, deudas, resúmenes) | ⏳ | — | — | |
| Push / email | ⏳ | ⏳ | ⏳ | |

### 12. Gastos recurrentes *(nuevo)*

Compromisos periódicos (semanal, quincenal, mensual, anual…) agrupados por tipo: suscripción, servicio, préstamo, meses sin intereses, seguro, vivienda, membresía, otro.

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de gastos recurrentes con frecuencia y tipo | ✅ | ⏳ | ⏳ | `recurringExpenses`, `create/update/deleteRecurringExpense`. Frecuencias: semanal, catorcenal, quincenal (15 y fin de mes), mensual, bimestral, trimestral, semestral, anual. |
| Modo de seguimiento: automático / manual / solo recordatorio | ✅ | ⏳ | ⏳ | Manual: `markRecurringPaymentPaid`, `skipRecurringPayment`, `reopenRecurringPayment`. Automático: se marcará pagado al conciliar con la tarjeta (sección 13). |
| Próximos pagos y costo mensual por tipo | ✅ | ⏳ | ⏳ | `upcomingPayments`, `recurringExpensesSummary` (por tipo y por cuenta). |
| Meses sin intereses (progreso x de y) | ✅ | ⏳ | ⏳ | Cierra el plan al pagar la última mensualidad. |
| Recordatorios generados | ✅ | ⏳ | ⏳ | Tarea diaria (6:00, hora CDMX): genera ocurrencias, marca vencidas las manuales y crea notificaciones 3 días antes. |

### 13. Estados de cuenta y conciliación *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Subir PDF del estado de cuenta (almacenado en S3) | ✅ | ⏳ | ⏳ | `POST /statements` (multipart, máx. 10 MB, deduplica por hash). Bucket privado, descarga con URL firmada (`statementFileUrl`). |
| Extracción: parser Banamex + IA para otros formatos | ✅ | — | — | Parser local `banamex_v1` (tarjeta titular y digital, mensualidades MSI, pagos y devoluciones), verificado con un estado real. Otros bancos: lectura con IA. Valida saldo anterior + cargos − abonos = saldo al corte. |
| Revisión y confirmación de movimientos importados | ✅ | ⏳ | ⏳ | `statementImport`, `updateStatementLine` (ignorar, categoría, ligar a mano), `confirmStatementImport`, `reprocessStatementImport`. |
| Conciliación con transacciones y gastos recurrentes | ✅ | ⏳ | ⏳ | No duplica compras ya registradas (mismo monto, ±3 días); marca pagados los recurrentes por patrón de comercio (±10 días, ±15% o ±50% si el monto es variable). |
| Resumen del mes de la tarjeta vs total a pagar | ✅ | ⏳ | ⏳ | `cardMonthSummary`: total a pagar, recurrentes esperados vs cobrados, cargos nuevos. |
| Sincronización con Belvo (sandbox) | ⏳ | ⏳ | ⏳ | Ver sección 9. |

## Plataforma

| Funcionalidad | Estado | Notas |
|---|---|---|
| Despliegue de la API (Dokploy, production + testing) | ✅ | [deployment.md](./deployment.md) |
| Despliegue web | ⏳ | |
| Builds móviles (EAS) | ⏳ | |
| CI de calidad en PRs (lint, tipos, tests) | ⏳ | |
| Tests unitarios de la API | 🟡 | 6 de 11 módulos; 226 pasan, 8 omitidos que documentan bugs (`TODO(bug)`). `pnpm turbo run test --filter=@finnit/api`. |
| Paginación por cursor consistente | ⏳ | **Bug:** transacciones y deudas ordenan por fecha pero paginan con `id > cursor`; se pueden saltar o repetir filas. |
| Tests E2E | ⏳ | |
| Logs y monitoreo | ⏳ | |
