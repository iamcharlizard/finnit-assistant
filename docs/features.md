# Funcionalidades — Finnit Assistant

Inventario de funcionalidades y su estado **real**, verificado contra el código. Es la fuente de verdad del avance; [prd.md](./prd.md) describe el alcance y [user-stories.md](./user-stories.md) los criterios de aceptación.

**Última revisión:** 14 de octubre de 2026

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
| 9. Integración bancaria (Syncfy) | ✅ | ⏳ | 🟡 |
| 10. Flujo de caja y proyecciones | ✅ | 🟡 | 🟡 |
| 11. Notificaciones | 🟡 | ⏳ | 🟡 |
| 12. Gastos recurrentes *(nuevo)* | ✅ | ⏳ | 🟡 |
| 13. Estados de cuenta y conciliación *(nuevo)* | 🟡 | ⏳ | 🟡 |
| 14. Panel administrativo *(nuevo)* | ✅ | — | ✅ |

## Detalle

### 1. Autenticación y seguridad

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Acceso solo por invitación (sin registro abierto) | ✅ | ✅ | ✅ | No existe `signUp`. Un administrador da de alta a cada persona desde el panel (`createUser`); el login explica que el acceso es por invitación. |
| Login con Google | ✅ | 🟡 | ✅ | `signInWithGoogle(idToken)`: solo entra si su correo de Google coincide con un usuario dado de alta; nunca crea cuentas. Web: OAuth con PKCE en el servidor (`/api/auth/google`). Móvil: `@react-native-google-signin`, requiere *development build*; sin probar en dispositivo. |
| Usuarios desactivados y cierre de sesiones | ✅ | — | — | Desactivar a alguien o cambiarle la contraseña invalida sus tokens (`tokenVersion`), se revisa en cada petición y al refrescar. |
| Login con email y contraseña (JWT) | ✅ | ✅ | ✅ | `signIn`; la contraseña la asigna un administrador. Móvil guarda tokens en SecureStore; web en cookies httpOnly (backend-for-frontend con Server Actions). |
| Refresh token | ✅ | ⏳ | ✅ | Web: `proxy.ts` renueva el token antes de que expire. Móvil: pendiente. |
| Usuario actual / validar token | ✅ | ⏳ | ✅ | `me`, `validateToken`. Web: nombre e iniciales reales en la app. |
| Protección de rutas según sesión | — | ⏳ | ✅ | Web: sin sesión redirige a `/login?next=…` (sin redirecciones abiertas). |
| Recuperar contraseña por email | 🟡 | ⏳ | ⏳ | `requestPasswordReset`/`resetPassword` existen, pero **no se envía correo** (no hay servicio de email). |
| Aislamiento de datos por usuario | ✅ | — | — | Todas las consultas filtran por `userId`. |
| Validación de inputs | ⏳ | — | — | **Bug:** los DTOs tienen decoradores de `class-validator`, pero no hay `ValidationPipe`; se aceptan montos negativos, tasas > 100, etc. |

### 2. Cuentas y balances

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de cuentas (efectivo, débito, crédito, ahorro, e-wallet) | ✅ | 🟡 | 🟡 | Web: saldos reales de solo lectura (Inicio: disponible, deuda en tarjetas y patrimonio neto; Tarjetas: crédito y débito). Sin formularios de alta: las cuentas llegan al conectar el banco. Móvil: datos mock. |
| Ajuste de saldo sin ingreso/gasto falso | ✅ | ⏳ | ⏳ | `adjustAccountBalance` (tipo `adjustment`). |
| Términos de tarjeta de crédito (corte, pago, tasa) | 🟡 | 🟡 | ✅ | Modelo `CreditCardTerms`; `accounts` ya los incluye. Web: próximo corte y fecha de pago en Tarjetas y en el Calendario. **Falta:** ninguna mutación permite capturarlos. |
| Alta guiada con explicación de tipos | — | ⏳ | ⏳ | Es UI. |
| Escaneo de tarjeta con foto | ⏳ | ⏳ | ⏳ | |

### 3. Transacciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Alta rápida (fecha, cuenta, monto, tipo, categoría) | ✅ | ⏳ | ⏳ | Sin formularios en clientes. |
| Listado con filtros y paginación por cursor | ✅ | 🟡 | ✅ | Web: Historial agrupado por día, filtros en la URL (tipo, cuenta, categoría, fechas, búsqueda) y "Cargar más". Móvil: datos mock. |
| Varias transacciones por cuenta en el mismo día | ✅ | — | — | Se quitó la restricción única `[userId, accountId, txnDate]` (migración `20261012120000`). |
| Categorización sugerida por comercio | 🟡 | ⏳ | ⏳ | Busca por la primera palabra del comercio en transacciones previas; no aprende reglas. |
| Transferencias entre cuentas | ✅ | ⏳ | ⏳ | `createTransfer`. |
| Detección automática de transferencias internas | ⏳ | — | — | |
| Adjuntos (tickets, comprobantes) | ✅ | ⏳ | ⏳ | `POST /transactions/:id/attachments` (PDF, JPEG, PNG, WEBP, HEIC; máx. 10 MB, 10 por transacción) al bucket privado; descarga solo del dueño en `GET /attachments/:id/file`. |
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
| Uso y resumen en tiempo real | ✅ | 🟡 | ⏳ | Web: se quitó la tarjeta de presupuesto mock; aún no hay pantalla. Móvil: datos mock. |
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
| Resumen mensual (ingresos, gastos por categoría, neto) | ✅ | 🟡 | ✅ | `monthlyReport` (cuenta el mes completo en UTC). Web: Inicio (ingresos y gastos del mes), Analytics (gasto, tasa de ahorro y gastos por categoría agrupados en la categoría principal) e Historial (top categorías). |
| Comparativa con el mes anterior y tendencias 3–6 meses | ⏳ | 🟡 | ✅ | Web: Analytics pide 6 `monthlyReport` en una consulta (cambio vs. mes anterior, ingresos vs. gastos de 6 meses). Móvil: datos mock. |
| Insights (gastos inusuales, top categorías) | ⏳ | ⏳ | ⏳ | |
| Exportar a CSV | ⏳ | ⏳ | ⏳ | |

### 9. Integración bancaria (Syncfy)

Belvo dejó de ofrecer datos bancarios de México (solo Brasil), por eso se usa Syncfy (antes Paybook). El usuario conecta su banco en el widget de Syncfy: Finnit nunca ve el usuario ni la contraseña del banco.

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Conectar banco con formulario propio (headless) | ✅ | ⏳ | ✅ | Paquete `@finnit/bank-connect` (web y React Native): formulario del banco, token, captcha, imágenes, opciones y QR; los datos van del dispositivo a Syncfy, nunca a Finnit. Probado contra el sandbox (8/8 casos). Respaldo con el widget de Syncfy para sitios no soportados. API: `createBankConnectSession` + `registerBankConnection`. |
| Ligar cuentas del banco a cuentas de Finnit | ✅ | ⏳ | ✅ | `linkBankAccount` (existente o nueva); importa 90 días. Saldo, límite y crédito disponible desde el banco. |
| Importar movimientos y crear transacciones | ✅ | ⏳ | ⏳ | Incremental, sin duplicados; ignora autorizaciones pendientes y conversiones a meses sin intereses. |
| Conciliación banco ↔ estado de cuenta PDF | ✅ | — | — | El estado de cuenta empata los movimientos ya importados del banco (probado: 105 de 105). |
| Sincronización automática | ✅ | — | ✅ | 7:00 y 15:00 (CDMX); pide al banco datos nuevos como máximo cada 20 h. Manual: `syncBankConnection` (web: botón "Sincronizar ahora" en Ajustes → Bancos conectados). |
| Conciliación semanal guiada | ⏳ | ⏳ | ⏳ | Modelos `ReconciliationSession/Item` sin API. |

### 10. Flujo de caja y proyecciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Proyección 30/60 días | ✅ | 🟡 | ✅ | `cashFlowProjection`: saldo actual + promedio mensual de ingresos y gastos de los últimos 6 meses (o de los meses con datos). Web: Analytics → Flujo de caja, 6 meses. |
| Simulador "What If" | ✅ | ⏳ | ⏳ | `whatIfScenario`. |

### 11. Notificaciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Listar / marcar como leídas | ✅ | ⏳ | 🟡 | Web: la campana muestra el número real de no leídas; aún no hay lista. |
| Recordatorios de gastos recurrentes | ✅ | — | — | Tarea diaria del módulo de gastos recurrentes. |
| Generación automática (presupuesto, deudas, resúmenes) | ⏳ | — | — | |
| Push / email | ⏳ | ⏳ | ⏳ | |

### 12. Gastos recurrentes *(nuevo)*

Compromisos periódicos (semanal, quincenal, mensual, anual…) agrupados por tipo: suscripción, servicio, préstamo, meses sin intereses, seguro, vivienda, membresía, otro.

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de gastos recurrentes con frecuencia y tipo | ✅ | ⏳ | ⏳ | `recurringExpenses`, `create/update/deleteRecurringExpense`. Frecuencias: semanal, catorcenal, quincenal (15 y fin de mes), mensual, bimestral, trimestral, semestral, anual. |
| Modo de seguimiento: automático / manual / solo recordatorio | ✅ | ⏳ | ⏳ | Manual: `markRecurringPaymentPaid`, `skipRecurringPayment`, `reopenRecurringPayment`. Automático: se marcará pagado al conciliar con la tarjeta (sección 13). |
| Próximos pagos y costo mensual por tipo | ✅ | ⏳ | ✅ | `upcomingPayments`, `recurringExpensesSummary` (por tipo y por cuenta). Web: Inicio (próximos 14 días) y Calendario (mes, por pagar y gasto fijo mensual). |
| Meses sin intereses (progreso x de y) | ✅ | ⏳ | ⏳ | Cierra el plan al pagar la última mensualidad. |
| Recordatorios generados | ✅ | ⏳ | ⏳ | Tarea diaria (6:00, hora CDMX): genera ocurrencias, marca vencidas las manuales y crea notificaciones 3 días antes. |

### 13. Estados de cuenta y conciliación *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Subir PDF del estado de cuenta (almacenado en S3) | ✅ | ⏳ | ⏳ | `POST /statements` (multipart, máx. 10 MB, deduplica por hash). Bucket privado; descarga solo del dueño en `GET /statements/:id/file`. |
| Extracción: parser Banamex + IA para otros formatos | ✅ | — | — | Parser local `banamex_v1` (tarjeta titular y digital, mensualidades MSI, pagos y devoluciones), verificado con un estado real. Otros bancos: lectura con IA. Valida saldo anterior + cargos − abonos = saldo al corte. |
| Catálogo de modelos de IA (Anthropic, OpenAI, Gemini) | ✅ | ⏳ | ⏳ | `aiModels`: activos/desactivados, predeterminado y orden de respaldo; solo administradores lo modifican, desde el panel (`/admin/ai`). Llaves por proveedor en variables de entorno. |
| Revisión y confirmación de movimientos importados | ✅ | ⏳ | ⏳ | `statementImport`, `updateStatementLine` (ignorar, categoría, ligar a mano), `confirmStatementImport`, `reprocessStatementImport`. |
| Conciliación con transacciones y gastos recurrentes | ✅ | ⏳ | ⏳ | No duplica compras ya registradas (mismo monto, ±3 días); marca pagados los recurrentes por patrón de comercio (±10 días, ±15% o ±50% si el monto es variable). |
| Resumen del mes de la tarjeta vs total a pagar | ✅ | ⏳ | 🟡 | `cardMonthSummary`: total a pagar, recurrentes esperados vs cobrados, cargos nuevos. Web: Tarjetas muestra recurrentes esperados y cobrados, saldo al corte, pago mínimo y pago para no generar intereses. |
| Sincronización con el banco (Syncfy) | ✅ | ⏳ | ⏳ | Ver sección 9. |

### 14. Panel administrativo *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Usuario maestro | ✅ | — | — | Se crea una vez por ambiente con `create-master` ([deployment.md](./deployment.md)). No se le puede quitar el rol ni desactivar. |
| Administradores | ✅ | — | ✅ | `role: admin`. Solo el maestro nombra o quita administradores. |
| Dar y quitar acceso a usuarios | ✅ | — | ✅ | `/admin/users`: alta con contraseña opcional, asignar o quitar contraseña, desligar Google, desactivar y reactivar. No se borran usuarios. |
| Modelos de IA | ✅ | — | ✅ | `/admin/ai`: activar, predeterminado, orden, alta y baja. |
| Funcionalidades de IA | ✅ | — | ✅ | `aiFeatures` / `updateAiFeature`: hoy solo "Leer estados de cuenta en PDF"; se enciende o apaga, con modelo propio y respaldos opcionales. |

## Plataforma

| Funcionalidad | Estado | Notas |
|---|---|---|
| Despliegue de la API (Dokploy, production + testing) | ✅ | [deployment.md](./deployment.md) |
| Despliegue web | ⏳ | |
| Builds móviles (EAS) | ⏳ | |
| CI de calidad en PRs (lint, tipos, tests) | ⏳ | |
| Tests unitarios de la API | 🟡 | 6 de 11 módulos; 226 pasan, 8 omitidos que documentan bugs (`TODO(bug)`). `pnpm turbo run test --filter=@finnit/api`. |
| Paginación por cursor consistente | 🟡 | Transacciones: corregido (cursor por fecha + id). **Bug pendiente:** deudas y cuentas ordenan por fecha pero paginan con `id > cursor`. |
| Tests E2E | ⏳ | |
| Logs y monitoreo | ⏳ | |
