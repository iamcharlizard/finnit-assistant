# Funcionalidades — Finnit Assistant

Inventario de funcionalidades y su estado **real**, verificado contra el código. Es la fuente de verdad del avance; [prd.md](./prd.md) describe el alcance y [user-stories.md](./user-stories.md) los criterios de aceptación.

**Última revisión:** 15 de octubre de 2026

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
| 5. Presupuestos | ✅ | ⏳ | ✅ |
| 6. Deudas y tarjetas | ✅ | ⏳ | ✅ |
| 7. Metas y ahorro | ✅ | ⏳ | ✅ |
| 8. Reportes e insights | 🟡 | 🟡 | 🟡 |
| 9. Integración bancaria (Syncfy) | ✅ | ⏳ | 🟡 |
| 10. Flujo de caja y proyecciones | ✅ | 🟡 | ✅ |
| 11. Notificaciones | 🟡 | ⏳ | 🟡 |
| 12. Gastos recurrentes *(nuevo)* | ✅ | ⏳ | 🟡 |
| 13. Estados de cuenta y conciliación *(nuevo)* | 🟡 | ⏳ | ✅ |
| 14. Panel administrativo *(nuevo)* | ✅ | — | ✅ |
| 15. Pantalla de pagos recurrentes y sugerencias *(nuevo)* | ✅ | ⏳ | ✅ |
| 16. Clasificación de movimientos *(nuevo)* | ✅ | ⏳ | ✅ |
| 17. Alias de movimientos *(nuevo)* | ✅ | ⏳ | ✅ |
| 18. Personalización de cuentas y tarjetas *(nuevo)* | ✅ | ⏳ | ✅ |
| 19. Flujo para crear movimientos *(nuevo)* | ✅ | ⏳ | ✅ |
| 20. Cuentas y tarjetas manuales *(nuevo)* | ✅ | ⏳ | ✅ |

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
| CRUD de cuentas (efectivo, débito, crédito, ahorro, e-wallet) | ✅ | 🟡 | ✅ | Web: `/accounts` (Cuentas y tarjetas) con alta manual, edición y archivado; Inicio muestra disponible, deuda en tarjetas y patrimonio neto. Móvil: datos mock. |
| Ajuste de saldo sin ingreso/gasto falso | ✅ | ⏳ | ⏳ | `adjustAccountBalance` (tipo `adjustment`). |
| Términos de tarjeta de crédito (corte, pago, tasa) | ✅ | 🟡 | ✅ | Modelo `CreditCardTerms`; `accounts` ya los incluye. Web: se capturan al dar de alta o editar la tarjeta; próximo corte y fecha de pago en Cuentas y en el Calendario. `setCreditCardTerms` / `removeCreditCardTerms`. |
| Alta guiada con explicación de tipos | — | ⏳ | ✅ | Asistente de 4 pasos en `/accounts?add=1` (tipo, banco, saldo/deuda y diseño). |
| Escaneo de tarjeta con foto | ⏳ | ⏳ | ⏳ | |

### 3. Transacciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Alta rápida (fecha, cuenta, monto, tipo, categoría) | ✅ | ⏳ | ✅ | Web: botón "+" (gasto, ingreso o transferencia), categoría sugerida por comercio y comprobante opcional. |
| Listado con filtros y paginación por cursor | ✅ | 🟡 | ✅ | Web: Historial agrupado por día, filtros en la URL (tipo, cuenta, categoría, fechas, búsqueda) y "Cargar más". Móvil: datos mock. |
| Varias transacciones por cuenta en el mismo día | ✅ | — | — | Se quitó la restricción única `[userId, accountId, txnDate]` (migración `20261012120000`). |
| Categorización sugerida por comercio | 🟡 | ⏳ | ⏳ | Busca por la primera palabra del comercio en transacciones previas; no aprende reglas. |
| Transferencias entre cuentas | ✅ | ⏳ | ✅ | `createTransfer`; `Transaction.transferDirection` indica el lado (in/out). Web: incluye "Pago de tarjeta". |
| Detección automática de transferencias internas | ⏳ | — | — | |
| Adjuntos (tickets, comprobantes) | ✅ | ⏳ | ✅ | `POST /transactions/:id/attachments` (PDF, JPEG, PNG, WEBP, HEIC; máx. 10 MB, 10 por transacción) al bucket privado; descarga solo del dueño en `GET /attachments/:id/file`. |
| Captura por foto de ticket | ✅ | ⏳ | ✅ | Servicio interno `apps/ocr` (RapidOCR PP-OCRv5); QR del CFDI, luego reglas (total, fecha, RFC); IA solo de respaldo con el texto (`receipt_parsing`, apagada por defecto). Web: "Escanear ticket" en el "+". [document-ocr.md](./document-ocr.md). |
| Captura por SMS | ⏳ | ⏳ | — | |
| CEP de Banxico | ⏳ | ⏳ | ⏳ | |
| Etiquetas (tags) | ⏳ | ⏳ | ⏳ | Modelo `Tag` sin API. |

### 4. Categorías

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Lista jerárquica por defecto | ✅ | ⏳ | ⏳ | |
| CRUD de categorías propias | ✅ | ⏳ | ⏳ | |
| Uso por categoría | ✅ | ⏳ | ⏳ | `categoryUsage`. |
| Reglas de comercio que aprenden de correcciones | ✅ | ⏳ | ✅ | Ver sección 16. |

### 5. Presupuestos

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Presupuesto mensual y por categoría | ✅ | ⏳ | ✅ | `/planning/budgets`: crear, editar, copiar del mes anterior (`createBudgetFromTemplate`) y topes sugeridos del promedio de 3 meses. Un tope incluye sus subcategorías. |
| Uso y resumen en tiempo real | ✅ | 🟡 | ✅ | Web: uso por categoría y tarjeta en Inicio. Móvil: datos mock. |
| Alertas 80% / 100% | 🟡 | ⏳ | ✅ | Web: alertas en la pantalla de presupuestos. Aún no se envían como notificación. |

### 6. Deudas y tarjetas

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Registro de deudas (préstamo, tarjeta) | ✅ | ⏳ | ✅ | `/planning/debts`: resumen (saldo, mínimos y tasa ponderada), alta, edición y baja. |
| Pagos de deuda | ✅ | ⏳ | ✅ | `createDebtPayment`. Web: gasto, o transferencia a la tarjeta si la deuda está ligada a una. |
| Estrategias avalanche / snowball | ✅ | ⏳ | ✅ | `payoffStrategy` simula mes a mes (intereses, mínimos y excedente en cascada). Web: comparación lado a lado con pago extra. |
| Resumen de deudas | ✅ | ⏳ | ✅ | `debtSummary`. |

### 7. Metas y ahorro

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Crear meta y ver progreso | ✅ | ⏳ | ✅ | `createGoal`, `goalProgress`. |
| Editar / borrar meta, registrar aportaciones | ✅ | ⏳ | ✅ | `updateGoal`, `deleteGoal`, `addGoalContribution`, `removeGoalContribution`, `goalContributions`. |
| Proyección y sugerencias de ahorro | ✅ | ⏳ | ✅ | `goalProjection`, `goalRecommendations`. Web: `/planning/goals` con estado (en camino, atrasada, alcanzada) y aportación mensual editable. |

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
| Simulador "What If" | ✅ | ⏳ | ✅ | `/planning/simulator`: base real (`cashFlowBaseline`) contra escenario (ingreso, gastos mensuales, gastos únicos, pago extra), gráfica y mes en que el saldo se vuelve negativo. El cálculo con gastos únicos se hace en la web. |

### 11. Notificaciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Listar / marcar como leídas | ✅ | ⏳ | ✅ | Web: panel en la campana y `/notifications` (filtro no leídas, paginación). |
| Recordatorios de gastos recurrentes | ✅ | — | — | Tarea diaria del módulo de gastos recurrentes. |
| Generación automática (presupuesto, deudas, resúmenes) | ⏳ | — | — | |
| Push / email | ⏳ | ⏳ | ⏳ | |

### 12. Gastos recurrentes *(nuevo)*

Compromisos periódicos (semanal, quincenal, mensual, anual…) agrupados por tipo: suscripción, servicio, préstamo, meses sin intereses, seguro, vivienda, membresía, otro.

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de gastos recurrentes con frecuencia y tipo | ✅ | ⏳ | ✅ | `recurringExpenses`, `create/update/deleteRecurringExpense`. Frecuencias: semanal, catorcenal, quincenal (15 y fin de mes), mensual, bimestral, trimestral, semestral, anual. |
| Modo de seguimiento: automático / manual / solo recordatorio | ✅ | ⏳ | ✅ | Manual: `markRecurringPaymentPaid`, `skipRecurringPayment`, `reopenRecurringPayment`. Automático: se marcará pagado al conciliar con la tarjeta (sección 13). |
| Próximos pagos y costo mensual por tipo | ✅ | ⏳ | ✅ | `upcomingPayments`, `recurringExpensesSummary` (por tipo y por cuenta). Web: Inicio (próximos 14 días) y Pagos recurrentes. |
| Meses sin intereses (progreso x de y) | ✅ | ⏳ | ✅ | Cierra el plan al pagar la última mensualidad. |
| Recordatorios generados | ✅ | ⏳ | ⏳ | Tarea diaria (6:00, hora CDMX): genera ocurrencias, marca vencidas las manuales y crea notificaciones 3 días antes. |

### 13. Estados de cuenta y conciliación *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Subir PDF del estado de cuenta (almacenado en S3) | ✅ | ⏳ | ✅ | `POST /statements` (multipart, máx. 10 MB, deduplica por hash). Bucket privado; descarga solo del dueño en `GET /statements/:id/file`. |
| Extracción: parser Banamex + IA para otros formatos | ✅ | — | — | Parser local `banamex_v1` (tarjeta titular y digital, mensualidades MSI, pagos y devoluciones), verificado con un estado real. Otros bancos: lectura con IA. Valida saldo anterior + cargos − abonos = saldo al corte. |
| Catálogo de modelos de IA (Anthropic, OpenAI, Gemini) | ✅ | ⏳ | ⏳ | `aiModels`: activos/desactivados, predeterminado y orden de respaldo; solo administradores lo modifican, desde el panel (`/admin/ai`). Llaves por proveedor en variables de entorno. |
| Revisión y confirmación de movimientos importados | ✅ | ⏳ | ✅ | `statementImport`, `updateStatementLine` (ignorar, categoría, ligar a mano), `confirmStatementImport`, `reprocessStatementImport`. Web: `/statements` y `/statements/[id]` con totales, diferencia y líneas. |
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

### 15. Pantalla de pagos recurrentes y sugerencias *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Calendario día / semana / mes con la lista de pagos del periodo | ✅ | ⏳ | ✅ | `/recurring` (sustituye a `/calendar`): resumen, calendario y lista del día o periodo. |
| Alta, edición, pausa y baja; marcar pagado u omitido | ✅ | ⏳ | ✅ | |
| Sugerencias detectadas en los movimientos sincronizados | ✅ | ⏳ | ✅ | `recurringSuggestions` (sin IA): mismo comercio, monto parecido (±15%, variable hasta ±50%) e intervalo regular; 3 apariciones (2 si es mensual a trimestral con monto fijo, o semestral/anual). `acceptRecurringSuggestion` crea el pago y marca pagados los cargos de la evidencia; `dismissRecurringSuggestion`. |
| Clasificación de la sugerencia con IA (tipo, categoría, nombre) | ✅ | — | ✅ | Funcionalidad `recurring_classification`, en lote y guardada en `RecurringSuggestionState`; solo se envía comercio, monto y frecuencia. El usuario siempre confirma. |

### 16. Clasificación de movimientos *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Lista por cuenta y periodo, primero los sin categoría | ✅ | ⏳ | ✅ | `/transactions/categorize`; filtros `uncategorized` y `hasSuggestion`. |
| Sugerencia de categoría con IA, aceptar una por una o todas | ✅ | ⏳ | ✅ | `suggestTransactionCategories` (primero reglas, el resto en un lote de IA `transaction_categorization`; solo nombre mostrado, monto y tipo), `acceptCategorySuggestions` / `rejectCategorySuggestions`. |
| Mover uno o varios movimientos a otra categoría | ✅ | ⏳ | ✅ | `categorizeTransactions` (hasta 500), con "Recordar para este comercio". |
| Reglas de comercio que aprenden de las correcciones | ✅ | — | ✅ | `MerchantRule`; se aplican al crear, importar del banco y de estados de cuenta, antes que la sugerencia por frecuencia. Lista y borrado en Ajustes → Alias. |

### 17. Alias de movimientos *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Reglas de alias (contiene, empieza con, exacto o expresión regular) | ✅ | ⏳ | ✅ | `/settings/aliases`. Coincidencia materializada en `Transaction.aliasId`; sin acentos ni mayúsculas (`unaccent`); la expresión regular solo se evalúa en Postgres, con límite de 5 s. Vista previa en vivo. |
| Alias para un solo movimiento | ✅ | ⏳ | ✅ | `setTransactionAlias`; "Renombrar" en Clasificar movimientos. |
| Nombre original oculto, visible a demanda | ✅ | ⏳ | 🟡 | El original nunca se modifica; en listas los privados muestran solo el alias (candado) y no se encuentran buscando el original. Botón "Ver original" en el detalle (`/transactions/[id]`). |

### 18. Personalización de cuentas y tarjetas *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Renombrar cuenta o tarjeta (solo visible al usuario) | ✅ | ⏳ | ✅ | `metadata.nickname`; `updateAccount` combina el JSON en vez de reemplazarlo. |
| Diseño: un color o degradado de dos; texto con contraste automático | ✅ | ⏳ | ✅ | `metadata.design`; editor con vista previa en vivo. El apodo se usa en todas las pantallas (`accountLabel`). |

### 19. Flujo para crear movimientos *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Elegir gasto, ingreso o transferencia | ✅ | ⏳ | ✅ | `createTransaction`, `createTransfer`. |
| Capturar ticket para crear un gasto | ✅ | ⏳ | ✅ | `POST /receipts` → `receiptImport` (borrador prellenado) → `confirmReceiptImport` (nuevo gasto o adjuntar a uno existente). Con los 5 tickets de prueba: total y fecha correctos en 5, RFC en 4. |
| Aviso de duplicado contra movimientos sincronizados | ✅ | ⏳ | ✅ | `similarTransactions`. Ofrece adjuntar el ticket al movimiento existente. |
| Fecha en hora local | ✅ | — | — | `toLocalDateOnly`: se guarda el día de CDMX. |

### 20. Cuentas y tarjetas manuales *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Alta manual de débito y crédito | ✅ | ⏳ | ✅ | `createAccount` (nombre repetido → `CONFLICT`); también efectivo y ahorro. Liga desde Bancos conectados: "¿Tu banco no aparece?". |
| Corte, fecha de pago y tasa de la tarjeta | ✅ | ⏳ | ✅ | `setCreditCardTerms`. |
| Saldo inicial sin contarlo como ingreso o gasto | ✅ | — | — | Se registra como ajuste ("Initial balance") en la misma transacción de BD. |
| Ligar después una cuenta manual a una conexión bancaria | 🟡 | ⏳ | ⏳ | `linkBankAccount` ya acepta una cuenta existente. |

### Idiomas *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Interfaz en español e inglés | ✅ | ⏳ | ✅ | Web con `next-intl`; selector en Ajustes (`updateMyPreferences`, `User.locale`). |
| Categorías traducidas | ✅ | ⏳ | ✅ | `CategoryTranslation` (en/es); las del usuario se traducen con Google Cloud Translation (respaldo con IA). |

## Plataforma

| Funcionalidad | Estado | Notas |
|---|---|---|
| Despliegue de la API (Dokploy, production + testing) | ✅ | [deployment.md](./deployment.md) |
| Despliegue web (Vercel) | ✅ | Rama `testing` y `main`; variables en [deployment.md](./deployment.md). |
| Builds móviles (EAS) | ⏳ | |
| CI de calidad en PRs (lint, tipos, tests) | ⏳ | |
| Tests unitarios de la API | 🟡 | 515 pasan, 6 omitidos que documentan bugs (`TODO(bug)`); faltan categorías, transferencias, notificaciones y usuarios. `pnpm turbo run test --filter=@finnit/api`. |
| Paginación por cursor consistente | ✅ | Transacciones, cuentas, deudas y notificaciones paginan por (campo de orden, id). |
| Tests E2E | ⏳ | |
| Logs y monitoreo | ⏳ | |
