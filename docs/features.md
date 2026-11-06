# Funcionalidades — Finnit Assistant

Inventario de funcionalidades y su estado **real**, verificado contra el código. Es la fuente de verdad del avance; [prd.md](./prd.md) describe el alcance y [user-stories.md](./user-stories.md) los criterios de aceptación.

**Última revisión:** 6 de noviembre de 2026

**Leyenda:** ✅ hecho · 🟡 parcial · ⏳ pendiente · — no aplica

- **API**: existe la operación GraphQL/REST y la lógica en el servicio.
- **Móvil** (`apps/finnit-app`) y **Web** (`apps/web`): ✅ solo si la pantalla usa datos reales de la API. Una pantalla con datos mock cuenta como 🟡 (hay UI, falta conectarla).

## Resumen

| Área | API | Móvil | Web |
|---|---|---|---|
| 1. Autenticación y seguridad | 🟡 | ✅ | 🟡 |
| 2. Cuentas y balances | ✅ | 🟡 | 🟡 |
| 3. Transacciones | 🟡 | ✅ | 🟡 |
| 4. Categorías | ✅ | 🟡 | ✅ |
| 5. Presupuestos | ✅ | ✅ | ✅ |
| 6. Deudas y tarjetas | ✅ | 🟡 | ✅ |
| 7. Metas y ahorro | ✅ | ✅ | ✅ |
| 8. Reportes e insights | 🟡 | ✅ | 🟡 |
| 9. Integración bancaria (Syncfy) | ✅ | 🟡 | 🟡 |
| 10. Flujo de caja y proyecciones | ✅ | ✅ | ✅ |
| 11. Notificaciones | 🟡 | ✅ | 🟡 |
| 12. Gastos recurrentes *(nuevo)* | ✅ | 🟡 | 🟡 |
| 13. Estados de cuenta y conciliación *(nuevo)* | 🟡 | 🟡 | ✅ |
| 14. Panel administrativo *(nuevo)* | ✅ | — | ✅ |
| 15. Pantalla de pagos recurrentes y sugerencias *(nuevo)* | ✅ | 🟡 | ✅ |
| 16. Clasificación de movimientos *(nuevo)* | ✅ | ✅ | ✅ |
| 17. Alias de movimientos *(nuevo)* | ✅ | 🟡 | ✅ |
| 18. Personalización de cuentas y tarjetas *(nuevo)* | ✅ | 🟡 | ✅ |
| 19. Flujo para crear movimientos *(nuevo)* | ✅ | 🟡 | ✅ |
| 20. Cuentas y tarjetas manuales *(nuevo)* | ✅ | ⏳ | ✅ |
| 21. Landing pública y lista de espera *(nuevo)* | ✅ | — | ✅ |

## Detalle

## App móvil (`apps/finnit-app`)

Expo SDK 58 (React Native 0.88, React 19.3) con NativeWind v5 (`5.0.0-rc.1`). Las pantallas usan datos reales y la misma lógica que la web: los mappers, formatos, formularios, consultas y mutaciones viven en `@finnit/core` (`packages/core`) y los componentes en `@finnit/ui-native` (`packages/ui-native`, mismos nombres y props que `@finnit/ui`). Español e inglés con los mismos mensajes que la web; los 4 temas (finnit, glass, suave, mono) en claro y oscuro, generados de los tokens de la web. Probado: tipos, lint, bundle completo de iOS y build en simulador; el login y los temas se vieron en el simulador. **Las pantallas con sesión no se han probado en un dispositivo o simulador con datos** (falta iniciar sesión con un usuario real).

| Pantalla | Estado | Qué falta frente a la web |
|---|---|---|
| Login (contraseña, Google, "Mantener sesión iniciada") | ✅ | Google requiere *development build* con `EXPO_PUBLIC_GOOGLE_*`; sin probar en dispositivo. |
| Sesión: renovación del token, guardia de rutas, idioma de la cuenta | ✅ | — |
| Inicio (saldo, mes, presupuesto, próximos pagos, deudas) | ✅ | — |
| Movimientos (búsqueda, tipo, mes, filtros, por día, "Cargar más") | ✅ | — |
| Detalle y edición de un movimiento, PIN de privacidad | ✅ | Convertir en transferencia, adjuntos, crear nombre automático desde el editor. |
| Nuevo movimiento: gasto, ingreso, transferencia / pago de tarjeta, duplicados | ✅ | Adjuntar comprobante al crear. |
| Escanear ticket (cámara/galería → gasto prellenado) | ✅ | Tickets pendientes, "¿es este?" con coincidencias del ticket. |
| Importar captura del banco | ⏳ | Todo. |
| Cuentas y tarjetas (pila de tarjetas, detalle con cifras y movimientos; "Nueva cuenta": conectar el banco con Syncfy o alta manual) | 🟡 | Diseño de la tarjeta al darla de alta, edición, archivado, "Actualizar saldo", gráfica de saldo diario. |
| Análisis | ✅ | — |
| Calendario de pagos (calendario mensual con fechas de tarjetas, pagar/omitir/reabrir; Resumen con tarjetas y 4 gráficas) | 🟡 | Vistas día/semana, editar el pago desde el calendario. |
| Pagos recurrentes (Mis pagos con filtros; Sugeridos: agregar o descartar) | 🟡 | Crear y editar recurrentes, ajustar una sugerencia antes de agregarla, guardarla como préstamo. |
| Notificaciones | ✅ | — |
| Presupuestos (crear, editar, copiar, eliminar, sugerencias) | ✅ | — |
| Deudas (resumen, préstamos, otras; detalle con calendario y pagos; ligar o desligar un gasto a un pago) | 🟡 | Registrar pagos, agregar dinero, alta y edición de deudas, plan de pago. |
| Metas (crear, editar, aportar, quitar aportación, eliminar) | ✅ | Proyección con aportación editable. |
| Simulador | 🟡 | Gastos mensuales y movimientos únicos del escenario. |
| Clasificar (mover, recordar comercio, IA, aceptar/rechazar) | ✅ | Filtros por cuenta y periodo; sugerencias de transferencia. |
| Estados de cuenta (subir PDF, lista, líneas) | 🟡 | Conciliar líneas (ligar, ignorar, crear) y confirmar. |
| Configuración (idioma, apariencia, PIN, cerrar sesión) | ✅ | Editar perfil y foto. |
| Categorías (mostrar/ocultar) | 🟡 | Crear, editar y eliminar categorías propias. |
| Nombres automáticos (activar, eliminar, desbloquear) | 🟡 | Crear y editar con vista previa y sugerencia de IA. |
| Conectar banco | 🟡 | Pantalla anterior (sin migrar a `@finnit/ui-native`). |
| Administración | — | Solo web. |


### 1. Autenticación y seguridad

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Acceso solo por invitación (sin registro abierto) | ✅ | ✅ | ✅ | No existe `signUp`. Un administrador da de alta a cada persona desde el panel (`createUser`); el login explica que el acceso es por invitación. |
| Login con Google | ✅ | 🟡 | ✅ | `signInWithGoogle(idToken)`: solo entra si su correo de Google coincide con un usuario dado de alta; nunca crea cuentas. Web: OAuth con PKCE en el servidor (`/api/auth/google`). Móvil: `@react-native-google-signin`, requiere *development build*; sin probar en dispositivo. |
| Usuarios desactivados y cierre de sesiones | ✅ | — | — | Desactivar a alguien o cambiarle la contraseña invalida sus tokens (`tokenVersion`), se revisa en cada petición y al refrescar. |
| Login con email y contraseña (JWT) | ✅ | ✅ | ✅ | `signIn`; la contraseña la asigna un administrador. Móvil guarda tokens en SecureStore; web en cookies httpOnly (backend-for-frontend con Server Actions). |
| Refresh token | ✅ | ✅ | ✅ | Web: `proxy.ts` renueva el token antes de que expire. Móvil: `@urql/exchange-auth` renueva con `refreshToken` al recibir UNAUTHENTICATED y reintenta. |
| Usuario actual / validar token | ✅ | ⏳ | ✅ | `me`, `validateToken`. Web: nombre e iniciales reales en la app. |
| Protección de rutas según sesión | — | ⏳ | ✅ | Web: sin sesión, las páginas redirigen a `/login?next=…` (sin redirecciones abiertas) y `/api/*` responde 401; solo `/`, `/login`, robots, sitemap y la imagen OG son públicos (`lib/auth/route-access.ts`, con tests). |
| Superficie pública de la API | ✅ | — | — | `auth-surface.spec.ts` falla si alguna query/mutación/ruta no tiene `JwtAuthGuard` y no está en la lista pública (auth + `joinWaitlist` + `/health`). Se quitó `user(id)` (dejaba leer el perfil de cualquier usuario) y el `updateUser` propio pasó a `updateMyProfile` (solo nombre). |
| Límite de intentos | ✅ | — | ✅ | `@nestjs/throttler` en las operaciones públicas, por IP y por correo; responde `TOO_MANY_REQUESTS` y el login lo muestra. La web pasa la IP del visitante con `FINNIT_BFF_SECRET`. Listas paginadas con tope de 200. |
| Recuperar contraseña por email | 🟡 | ⏳ | ⏳ | `requestPasswordReset`/`resetPassword` existen, pero **no se envía correo** (no hay servicio de email). |
| Aislamiento de datos por usuario | ✅ | — | — | Todas las consultas filtran por `userId`. |
| Validación de inputs | ⏳ | — | — | **Bug:** los DTOs tienen decoradores de `class-validator`, pero no hay `ValidationPipe`; se aceptan montos negativos, tasas > 100, etc. |

### 2. Cuentas y balances

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| CRUD de cuentas (efectivo, débito, crédito, ahorro, e-wallet) | ✅ | 🟡 | ✅ | Web: `/accounts` (Cuentas y tarjetas): **Nueva cuenta** pregunta primero si conectar el banco (el flujo de Syncfy dentro del mismo modal; `?add=bank`) o agregarla a mano (`?add=1`); edición y archivado; Inicio muestra disponible, deuda en tarjetas y patrimonio neto. Móvil: ver «App móvil». |
| Cuenta de efectivo de cada usuario | ✅ | ✅ | ✅ | Todo usuario tiene una cuenta **Efectivo** ("Cash" en inglés) que no se puede eliminar, archivar ni cambiar de tipo (`Account.isDefaultCash`, índice único parcial por usuario). Se crea al dar de alta al usuario y, por si falta, al iniciar sesión (`ensureDefaultCashAccount`); la migración marcó la cuenta de efectivo más antigua de cada usuario o creó una. Se puede renombrar. Insignia "Tu efectivo". |
| Ajuste de saldo sin ingreso/gasto falso | ✅ | ⏳ | ✅ | `setAccountBalance`: el usuario escribe el saldo real (tarjetas: lo que debe) y la diferencia se guarda como ajuste con signo, fechado hoy. Web: botón **Actualizar saldo** en `/accounts`. Los ajustes no se pueden eliminar (los antiguos no guardan su dirección): se corrige el saldo otra vez. `adjustAccountBalance` (delta) sigue disponible. |
| Términos de tarjeta de crédito (corte, pago, tasa) | ✅ | 🟡 | ✅ | Modelo `CreditCardTerms`; `accounts` ya los incluye. Web: se capturan al dar de alta o editar la tarjeta; próximo corte y fecha de pago en Cuentas y en el Calendario. `setCreditCardTerms` / `removeCreditCardTerms`. |
| Efecto de cada movimiento en el saldo | ✅ | — | ✅ | `Transaction.balanceEffect`: lo que sumó (+) o restó (−) al saldo, con signo; los pendientes lo guardan pero no cuentan. Todas las rutas que mueven saldos lo escriben (`common/utils/balance-effect.util.ts`). La web lo usa para la dirección de ajustes y transferencias. Ajustes antiguos sin dirección quedan en `null`. |
| Saldo por día (histórico) | ✅ | ⏳ | ✅ | `accountBalanceHistory(accountId, from, to)` (≤ 366 días): saldo al iniciar y cerrar cada día, entradas, salidas y movimientos, calculado hacia atrás desde el saldo actual (un movimiento con fecha anterior corrige solo esos días). `complete` es falso antes de que la cuenta estuviera en Finnit (o de su historial importado). Todas las cuentas juntas: `accountsBalanceHistory(from, to, currency?)` suma por día el disponible (débito, efectivo, ahorro) y la deuda en tarjetas de las cuentas no archivadas en una moneda (MXN por omisión). Una cuenta sin movimientos no vuelve incompleto el histórico. Web: en `/accounts` sin cuenta elegida (chip "Todas las cuentas" o tocar de nuevo la tarjeta activa) se ve el conjunto con dos líneas, cifras del día y movimientos de todas las cuentas; con una cuenta elegida (o `/accounts/<id>`, la cuenta sola a todo el ancho con "Expandir"), selector de día (`?day=`), aviso de saldo histórico con "Volver a hoy", cifras del día, sus movimientos y gráfica de 90 días (toca un día para abrirlo; tabla accesible). |
| Conciliación con el banco (Syncfy) | ✅ | — | 🟡 | Tras importar, el saldo de una cuenta ligada queda igual al del banco; lo que los movimientos registrados desde la última conciliación no explican se guarda en un único ajuste abierto "Diferencia con el banco" (`Account.bankDifferenceTransactionId`, `LinkedAccount.reconciledBalance/reconciledAt`) que se recalcula en cada sincronización y desaparece al registrar lo que faltaba. Si sigue en la siguiente sincronización se crea una notificación `balance_mismatch` (una por cuenta y día) que abre la cuenta. La primera sincronización tras ligar solo toma el saldo del banco como punto de partida. |
| Alta guiada con explicación de tipos | — | ⏳ | ✅ | Asistente de 4 pasos en `/accounts?add=1` (tipo, banco, saldo/deuda y diseño). |
| Escaneo de tarjeta con foto | ⏳ | ⏳ | ⏳ | |

### 3. Transacciones

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Alta rápida (fecha, cuenta, monto, tipo, categoría) | ✅ | ⏳ | ✅ | Web: botón "+" (gasto, ingreso o transferencia), categoría sugerida por comercio y comprobante opcional. |
| Listado con filtros y paginación por cursor | ✅ | 🟡 | ✅ | Web: Historial por mes (`?month=YYYY-MM`, el actual por omisión; `month=all` todo el historial; `from`/`to` un rango que reemplaza el mes), agrupado por día con el neto del día; el título de cada día se queda fijo bajo la barra hasta que pasa su último movimiento. Las dos patas de una transferencia salen como un solo movimiento ("Transferencia · BBVA → Nu") con cada lado como sub-movimiento que abre su detalle (`Transaction.transferId`; un lado sin su par en la lista sale solo). Barra fija con búsqueda, tipo, "‹ mes ›" y "Filtros" (cuenta, categoría, rango, todo el historial); la barra y el top de categorías se fijan exactamente donde empiezan (medido del encabezado), sin moverse al hacer scroll. "Cargar más" dentro del mes y "Ver <mes anterior>" al final. Top categorías sigue el mes, como lista o gráfica de dona (las 5 principales y "Otras categorías"; la elección se recuerda en el navegador). Móvil: transferencias agrupadas y top como lista o dona; los títulos de día aún no se quedan fijos. Cada fila tiene "⋮": ver detalle, editar descripción y convertir en transferencia. Móvil: ver «App móvil». |
| Varias transacciones por cuenta en el mismo día | ✅ | — | — | Se quitó la restricción única `[userId, accountId, txnDate]` (migración `20261012120000`). |
| Categorización sugerida por comercio | 🟡 | ⏳ | ⏳ | Busca por la primera palabra del comercio en transacciones previas; no aprende reglas. |
| Categoría sugerida al editar | ✅ | ⏳ | ✅ | `similarCategory(transactionId)`, sin IA: la regla de comercio aprendida, si no la categoría del nombre automático (activo) que lo nombra, si no la favorita clara de los movimientos del mismo comercio del último año (`history-category.ts`). Web: pill "Sugerida: X · como N movimientos parecidos" debajo de la categoría en **Editar**; un clic la elige. Junto al selector, un botón con ícono pide la categoría a la IA (`suggestCategoryWithAi(transactionId, name)`: el nombre propio que se está escribiendo, si no el comercio/descripción de un manual, si no el texto del banco —nunca el de un nombre automático protegido sin PIN—, y el monto); la elige en el formulario sin guardar nada. |
| Búsqueda en selectores | — | — | ✅ | `Combobox` (`@finnit/ui`) ordena lo que se escribe con `rankOptions` (`lib/option-search.ts`), sin búsqueda difusa: sin mayúsculas ni acentos, cada palabra debe empezar una palabra de la opción (o estar dentro) o de su grupo; primero la que es igual, empieza igual o tiene una palabra que empieza así, al final las que solo coinciden por su categoría padre. Al escribir se ve una sola lista con el padre como texto secundario. |
| Notas de un movimiento | ✅ | ⏳ | ✅ | `Transaction.notes` (migración `20261116090000_transaction_notes`), editables en cualquier movimiento, también los del banco (`updateTransaction.notes`, "" las borra). Se ocultan con el texto del banco en los privados fuera del detalle. Web: área de texto en **Editar** y fila "Notas" en el detalle. En los manuales, la "Descripción" sigue siendo su texto (título cuando no hay comercio). |
| Clasificación automática al sincronizar (y con botón) | ✅ | — | ✅ | Tras cada sincronización de Syncfy, `CategorizationService.autoCategorize` da categoría a todos los gastos e ingresos sin ella: reglas de comercio, categoría de alias y, sin IA, la categoría que el usuario dio al mismo comercio en el último año (`history-category.ts`: la única usada, o la favorita con 2+ y 60 %). Lo que queda (y las posibles transferencias) se avisa en una notificación viva `uncategorized` que se actualiza mientras no se lea (`NotificationsService.upsertLive`) y abre Clasificar movimientos en todo el tiempo. También se lanza a mano con **Clasificar automáticamente** en Clasificar movimientos: un modal pide cómo (`autoCategorizeTransactions(mode)`): solo con las clasificaciones anteriores (se aplican), solo con IA (sugerencias para aceptar o rechazar, hasta 300 por vez en lotes de 100) o ambas (primero las anteriores, la IA para lo que quede). Actualiza la misma notificación. |
| Transferencias entre cuentas | ✅ | ⏳ | ✅ | `createTransfer`; `Transaction.transferDirection` indica el lado (in/out). Web: incluye "Pago de tarjeta". |
| Convertir un gasto o ingreso en transferencia | ✅ | ⏳ | ✅ | `convertToTransfer` liga el movimiento opuesto de la otra cuenta (`transferCandidates`: mismo monto, ±2 días) o crea ese lado; el saldo de los movimientos existentes no cambia. `Transaction.originalType` y `Transfer.convertedAt` permiten `undoTransferConversion` ("Deshacer transferencia" en el detalle). Un cargo del banco se liga al lado que sale de una transferencia registrada, así no se duplica. |
| Detección automática de transferencias internas | ✅ | — | ✅ | Al sincronizar, `TransferSuggestionsService.detect` sugiere (no convierte) los movimientos nuevos que tienen su opuesto en otra cuenta propia (`pair`), cuyo texto parece transferencia (SPEI, traspaso, "P INT", "P TER"… `text`) o que un alias manda a una cuenta (`MerchantAlias.transferAccountId`, `rule`). Web: "Posibles transferencias" arriba de Clasificar movimientos: "A mi cuenta", "A otra persona" (concepto y categoría) o "Ignorar"; con "Recordar" se crea el alias. Un movimiento revisado no se vuelve a sugerir. |
| Adjuntos (tickets, comprobantes) | ✅ | ⏳ | ✅ | `POST /transactions/:id/attachments` (PDF, JPEG, PNG, WEBP, HEIC; máx. 10 MB, 10 por transacción) al bucket privado; descarga solo del dueño en `GET /attachments/:id/file`. |
| Importar captura de pantalla de movimientos | ✅ | ⏳ | ✅ | `POST /screenshots` → `screenshotImport`: OCR (`apps/ocr`) y reglas locales (`screenshots/screenshot-rules.ts`: cabecera de cuenta con `**482`, renglones "comercio $monto" + "02 Nov En proceso"); IA de respaldo solo con el texto y posiciones (`screenshot_parsing`, apagada por defecto). Detecta la cuenta por sus últimos dígitos, compara cada línea con lo ya registrado (cualquier fuente: otra captura, Syncfy, estado de cuenta) y la deja como "Ya registrado". El usuario elige la cuenta, corrige o quita líneas (`updateScreenshotLine`) y guarda todo (`confirmScreenshotImport`, con `externalId` estable por línea para no duplicar). Web: "Importar captura" en Nuevo movimiento y en el "+". |
| Movimientos "En proceso" | ✅ | ⏳ | ✅ | `Transaction.inProcess`: el banco los muestra pero no los aplica; **cuentan** en el saldo y totales y solo se marcan ("En proceso" en filas y detalle). Se quitan al llegar el movimiento aplicado por Syncfy (se liga aunque cambie: ±15 % o $50, hasta 7 días después y con una palabra en común; se adopta el monto del banco y la diferencia ajusta el saldo conciliado) o a mano ("Marcar como aplicado"). |
| Captura por foto de ticket | ✅ | ⏳ | ✅ | Servicio interno `apps/ocr` (RapidOCR PP-OCRv5); QR del CFDI, luego reglas (total, fecha, RFC); IA solo de respaldo con el texto (`receipt_parsing`, apagada por defecto). Web: "Escanear ticket" en el "+". [document-ocr.md](./document-ocr.md). |
| Captura por SMS | ⏳ | ⏳ | — | |
| CEP de Banxico | ⏳ | ⏳ | ⏳ | |
| Etiquetas (tags) | ⏳ | ⏳ | ⏳ | Modelo `Tag` sin API. |

### 4. Categorías

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Catálogo global por defecto | ✅ | ⏳ | ✅ | Un solo catálogo para todos (`userId` null, `isDefault`), curado en `default-categories.ts` (17 categorías principales, ~80 subcategorías, con tipo gasto/ingreso e icono) y sincronizado al arrancar la API (`CategoryCatalogService`: crea y actualiza por `key`, nunca borra). Nadie lo edita; cada usuario oculta las que no usa (`hideCategory` / `showCategory`, tabla `CategoryHidden`): los selectores no las ofrecen, pero los movimientos que ya las tienen las siguen mostrando. Migración `20261113090000_global_categories` (las copias por usuario pasaron al catálogo). |
| Categorías propias (privadas) | ✅ | ⏳ | ✅ | Configuración → **Categorías** (`/settings/categories`): pestañas Gastos / Ingresos, cada principal se despliega con sus subcategorías y el conteo del mes. Crear principal o subcategoría (también dentro de una del catálogo), nombre en cualquier idioma, icono; dos niveles como máximo; la subcategoría hereda el tipo. Borrar una en uso pide a cuál mover sus movimientos, topes, reglas, alias y pagos recurrentes (`deleteCategory(id, moveToId)`, `categoryReferences`). |
| Selectores por tipo | ✅ | ⏳ | ✅ | `Category.kind`: un gasto ofrece categorías de gasto y un ingreso las de ingreso; Clasificar y Alias muestran ambas. |
| Uso por categoría | ✅ | ⏳ | ✅ | `categoryUsage`. |
| Reglas de comercio que aprenden de correcciones | ✅ | ⏳ | ✅ | Ver sección 16. |

### 5. Presupuestos

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Presupuesto mensual y por categoría | ✅ | ⏳ | ✅ | `/planning/budgets`: crear, editar, copiar del mes anterior (`createBudgetFromTemplate`) y topes sugeridos del promedio de 3 meses. Un tope incluye sus subcategorías. |
| Uso y resumen en tiempo real | ✅ | 🟡 | ✅ | Web: uso por categoría y tarjeta en Inicio. Móvil: ver «App móvil». |
| Alertas 80% / 100% | 🟡 | ⏳ | ✅ | Web: alertas en la pantalla de presupuestos. Aún no se envían como notificación. |

### 6. Deudas y tarjetas

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Registro de deudas (préstamo, tarjeta) | ✅ | ⏳ | ✅ | `/planning/debts`: resumen (saldo, mínimos y tasa ponderada), alta, edición y baja. |
| Pagos de deuda | ✅ | ⏳ | ✅ | `createDebtPayment`. Web: gasto, o transferencia a la tarjeta si la deuda está ligada a una. |
| Estrategias avalanche / snowball | ✅ | ⏳ | ✅ | `payoffStrategy` simula mes a mes (intereses, mínimos y excedente en cascada). Web: comparación lado a lado con pago extra. |
| Resumen de deudas | ✅ | ⏳ | ✅ | `debtSummary`. Deuda total = monto inicial con intereses + aumentos; saldo = eso − todos los pagos. |
| Préstamos por tipo (institucional, personal, compra a plazos) | ✅ | ⏳ | ✅ | Bancos y financieras: tasa de interés ordinaria anual (no el CAT) y comisión por apertura (se descuenta del depósito; no es gasto; el formulario bloquea guardar si el depósito no cuadra) y comisión fija por pago (administración o seguro, con IVA; se suma a cada pago y al total, no a los intereses; editable desde el detalle, que recalcula los pagos pendientes). Planeación → **Deudas** tiene tres pestañas (`?tab=summary|loans|other`): Resumen (totales, gráficas y plan para liquidar, préstamos incluidos), **Préstamos** (resumen, lista con tipo y gráficas de préstamos) y Tarjetas y otras; `/planning/loans` redirige a la pestaña. `createDebt` con `loanType`: términos por tasa (amortización francesa, IVA opcional), total o pago por periodo; periodicidad semanal/catorcenal/quincenal/mensual; calendario como gasto recurrente ligado (`debtId`). |
| Pagos hechos antes de registrar el préstamo | ✅ | ⏳ | ✅ | `installmentsPaid` / `historicalPayments`: pagos sin movimiento (no cuentan en ingresos/gastos); con cuenta se crea el gasto y sí cuentan. `createDebtPayment` con `isHistorical`. |
| Aumentos del préstamo (otro préstamo, compra a plazos) | ✅ | ⏳ | ✅ | `addDebtCharge` / `updateDebtCharge` / `deleteDebtCharge` (cada monto se edita desde su fila; el depósito sigue al nuevo monto, fecha o cuenta). Depósito a una cuenta (ajuste, o ingreso si se pide) o compra directa. El préstamo y cada monto pueden *no sumarse al saldo* (`depositAddsToBalance: false`, dinero ya gastado; guardado en `Debt.depositAddsToBalance` y `DebtCharge.depositAddsToBalance`): solo se registra la deuda; el formulario lo apaga solo cuando la fecha tiene más de 31 días. En compra a plazos cada compra suma sus parcialidades a las mismas fechas. Cada compra (y cada monto a meses de un préstamo personal) acepta *pagos ya hechos* (`installmentsPaid`): sus primeras parcialidades quedan como pagos históricos ligados a la compra (`DebtPayment.chargeId`, fuera de totales), el calendario ya no las pide y en la tabla salen con su etiqueta (01/04). Borrar uno de esos pagos lo vuelve a pedir. Cada compra con pagos guarda su *primer pago* (`firstPaymentDate`, puede ser futuro: p. ej. la quincena siguiente a la próxima fecha) y cómo se dio su interés (modo, tasa anual e IVA), que el diálogo de edición muestra tal como se capturó. El primer pago puede ser el mismo día de la compra. La compra inicial (o el préstamo inicial de un préstamo personal) tiene su descripción (`Debt.description`), y cada fila de la tabla de amortización se etiqueta con la compra a la que pertenece, también los pagos hechos antes de registrar el préstamo. Cada pago pendiente ya generado (próximos ~60 días) se puede mover a otro día desde la tabla (`rescheduleLoanPayment`); guarda su fecha del calendario (`RecurringOccurrence.originalDueDate`), no se vuelve a generar ahí y no puede caer en otra fecha del calendario. |
| Préstamos recibidos (personales) | ✅ | ⏳ | ✅ | Pestaña con el préstamo inicial y cada monto agregado después (`addDebtCharge`), con fecha, cómo te prestó (`lendingMethod`: efectivo, transferencia, su tarjeta de crédito o débito, otro), para qué y monto. En compras a plazos la misma pestaña lista las compras. La fecha del préstamo es opcional y se puede borrar. Un préstamo personal puede empezar en $0 (sin depósito ni método) y se va llenando con cada monto; no cuenta como liquidado mientras no se deba nada. Compras a meses (p. ej. 3 MSI con la tarjeta de quien te prestó): un monto con número de pagos crea el calendario mensual del préstamo (primer pago opcional; por defecto un mes después) y cada pago dice qué compra y cuál de sus pagos es (`01/03`); se ven en Pagos → *Pagos programados* y se pagan desde ahí. Un préstamo personal con pago fijo no acepta montos con pagos propios. El detalle del préstamo personal no tiene tabla de amortización. |
| Contactos (quién te prestó) | ✅ | ⏳ | ✅ | `contacts` / `createContact` (solo nombre por ahora). En préstamos personales "¿Quién te prestó?" es un combobox que permite agregar personas; `lenderContactId` en el préstamo (un `lenderName` nuevo crea el contacto). |
| Categoría de los pagos y "en qué se usó" | ✅ | ⏳ | ✅ | Categoría predeterminada **Préstamos y deudas** (*Pago de préstamos*, *Pagos a plazos*): la usan por defecto los pagos de préstamos, compras a plazos y MSI (calendario, pago manual, sugerencias y movimientos de banco sin categoría al conciliarlos). `purposeCategoryId` en el préstamo y en cada aumento: categoría informativa de en qué se usó el dinero (no cuenta como gasto); se edita en el detalle. |
| Pago desde una cuenta | ✅ | ⏳ | ✅ | `recordDebtPayment`: crea el gasto, el pago de la deuda y marca la parcialidad, en una transacción. Pagar una parcialidad (manual o conciliada con banco/estado de cuenta) registra el pago de la deuda; sin movimiento se rechaza. Al llegar a 0 la deuda queda `paid_off`. |
| Sugerencia recurrente → préstamo (con IA) | ✅ | — | ✅ | `recurringSuggestionLoanDraft` (IA propone tipo, prestamista y nombre; se guarda en caché) y `acceptRecurringSuggestionAsLoan` (los cargos detectados quedan como parcialidades pagadas). |
| Detalle del préstamo y calendario completo | ✅ | ⏳ | ✅ | `/planning/debts/[id]` en tres pestañas: **Detalles** (editables con `updateLoan`: nombre, institución, monto, número de pagos, fecha, comisión por apertura y por pago, uso; recalcula términos, pagos pendientes y el depósito; `depositAddsToBalance: false` quita el depósito de la cuenta cuando ese dinero ya se gastó), **Tabla de amortización** (`loanSchedule` con capital, interés, IVA, comisión y saldo por pago en préstamos por tasa; pagos hechos, abiertos y proyectados; pagar una parcialidad) y **Pagos registrados** (con los movimientos detectados). |
| Conciliación de pagos de préstamo | ✅ | ⏳ | ✅ | `loanPaymentCandidates`: monto ±15% (±50% compra a plazos) y fecha ±10 días, más fuerte si el texto nombra al prestamista o el comercio ya pagó antes; la IA desempata. `confirmLoanPayment` liga el movimiento y aprende el patrón del comercio para que las siguientes sincronizaciones concilien solas. |
| Gráficas de deuda | ✅ | ⏳ | ✅ | `debtInsights`: deuda actual vs total, deuda actual por tipo, pagado por mes (en gastos / antes de registrar / MSI), proyección del saldo, por pagar a 30/60/90 días y carga de deuda (pagos ÷ ingreso promedio de 3 meses). Interruptor para incluir los MSI. Colores categóricos validados para daltonismo (`--chart-1…6`), con etiquetas directas y vista de tabla. |
| Ligar gastos a pagos de préstamo | ✅ | ✅ | ✅ | Desde el **detalle del movimiento** (gasto que aún no paga nada): "Ligar a préstamo" elige el préstamo y el pago (`loanLinkOptions`; sugiere el pago con la misma fecha del gasto, o uno cercano en fecha y monto; preselecciona el préstamo si su nombre coincide). Desde el **detalle del préstamo**: al pagar una parcialidad, "Gasto existente" lista los gastos cercanos en monto (±10%, ±50% en compra a plazos) y fecha (±30 días), primero los que mencionan el préstamo, o busca por descripción en el último año (`loanExpenseCandidates`); un pago ya hecho sin movimiento (antes de registrar el préstamo) acepta un gasto con "Ligar gasto" y pasa a contar con su monto. `linkLoanPayment` rechaza un pago que ya tiene gasto: primero se desliga (`unlinkLoanPayment`, desde el movimiento o la fila del pago): el gasto queda como gasto normal y el pago vuelve a por pagar o queda pagado sin movimiento. El movimiento muestra su préstamo (`Transaction.loanPayment`). Móvil: ligar desde el movimiento y desde cada pago del préstamo, desligar; aún no registra pagos nuevos. |
| MSI / MCI de tarjetas en Deudas | ✅ | ⏳ | ✅ | Siguen siendo gastos recurrentes `installment` (usan la línea de crédito, no son préstamos); Deudas los lista aparte con su avance y los suma a las gráficas solo si se pide. |

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
| Comparativa con el mes anterior y tendencias 3–6 meses | ⏳ | 🟡 | ✅ | Web: Analytics pide 6 `monthlyReport` en una consulta (cambio vs. mes anterior, ingresos vs. gastos de 6 meses). Móvil: ver «App móvil». |
| Insights (gastos inusuales, top categorías) | ⏳ | ⏳ | ⏳ | |
| Exportar a CSV | ⏳ | ⏳ | ⏳ | |

### 9. Integración bancaria (Syncfy)

Belvo dejó de ofrecer datos bancarios de México (solo Brasil), por eso se usa Syncfy (antes Paybook). El usuario conecta su banco en el widget de Syncfy: Finnit nunca ve el usuario ni la contraseña del banco.

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Conectar banco con formulario propio (headless) | ✅ | ⏳ | ✅ | Desde Cuentas y tarjetas → **Nueva cuenta** → "Conectar mi banco" (web: en el mismo modal, `ConnectBankSteps`; móvil: abre la pantalla de conexión) y desde Configuración → Bancos. Paquete `@finnit/bank-connect` (web y React Native): formulario del banco, token, captcha, imágenes, opciones y QR; los datos van del dispositivo a Syncfy, nunca a Finnit. Probado contra el sandbox (8/8 casos). Respaldo con el widget de Syncfy para sitios no soportados. API: `createBankConnectSession` + `registerBankConnection`. |
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
| Movimientos por revisar tras sincronizar | ✅ | — | ✅ | Tipo `uncategorized`: una sola notificación viva por usuario con cuántos movimientos siguen sin clasificar y cuántas posibles transferencias hay; se marca leída sola cuando no queda nada. |
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
| Lista de espera | ✅ | — | ✅ | `/admin/waitlist`: correos, origen (utm) e idioma (`waitlistEntries`, solo admins). |

### 15. Pantalla de pagos recurrentes y sugerencias *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Calendario día / semana / mes con la lista de pagos del periodo | ✅ | 🟡 | ✅ | Pantalla propia **Calendario** (`/calendar`, en el menú): pestañas Calendario (calendario, pagos y fechas de corte y pago de tarjetas; pagar, omitir, editar) y **Resumen** (por pagar, pagado y gasto fijo del mes; gráficas de los próximos 6 meses por serie —recurrentes, préstamos y pago de tarjetas estimado con la deuda de hoy—, avance del mes, gasto fijo por tipo y por cuenta; `@finnit/core/calendar/summary`). Los enlaces viejos `/recurring?tab=calendar|view|date|month` redirigen. Móvil: solo vista mensual. |
| Pagos recurrentes: Mis pagos y Sugeridos | ✅ | 🟡 | ✅ | `/recurring` solo con los recurrentes: barra de filtros (buscar, estado, tipo y cuenta con casillas, orden por próximo pago, monto o nombre; chips quitables) en la URL (`?q=&status=&kind=&account=&sort=`, `@finnit/core/recurring/filters`). |
| Alta, edición, pausa y baja; marcar pagado u omitido | ✅ | ⏳ | ✅ | |
| Sugerencias detectadas en los movimientos sincronizados | ✅ | ⏳ | ✅ | `recurringSuggestions` (sin IA): mismo comercio, monto parecido (±15%, variable hasta ±50%) e intervalo regular; 3 apariciones; bastan 2 si caen el mismo día del mes (± 1 día, fines de mes como el mismo día) aunque el monto varíe, o si el monto es fijo en pagos mensuales a trimestrales, o si es semestral/anual. `acceptRecurringSuggestion` crea el pago y marca pagados los cargos de la evidencia; `dismissRecurringSuggestion`. |
| Clasificación de la sugerencia con IA (tipo, categoría, nombre) | ✅ | — | ✅ | Funcionalidad `recurring_classification`, en lote y guardada en `RecurringSuggestionState`; solo se envía comercio, monto y frecuencia. El usuario siempre confirma. |

### 16. Clasificación de movimientos *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Lista por cuenta y periodo, primero los sin categoría | ✅ | ✅ | ✅ | `/transactions/categorize`; filtros `uncategorized`, `hasSuggestion` y `categorizable` (solo gastos e ingresos sin transferencia pendiente: las transferencias y ajustes no se pueden clasificar, así que no salen; la misma condición que el conteo, `categorizableWhere`). |
| Sugerencia de categoría con IA, aceptar una por una o todas | ✅ | ⏳ | ✅ | `suggestTransactionCategories` (primero reglas, el resto en un lote de IA `transaction_categorization`; solo nombre mostrado, monto y tipo), `acceptCategorySuggestions` / `rejectCategorySuggestions`. |
| Mover uno o varios movimientos a otra categoría | ✅ | ⏳ | ✅ | `categorizeTransactions` (hasta 500), con "Recordar para este comercio". |
| Reglas de comercio que aprenden de las correcciones | ✅ | — | ✅ | `MerchantRule`; se aplican al crear, importar del banco y de estados de cuenta, antes que la sugerencia por frecuencia. Lista y borrado en Ajustes → Alias. |

### 17. Nombres automáticos y privacidad *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Nombres automáticos (reglas: contiene, empieza con, exacto o expresión regular) | ✅ | ⏳ | ✅ | Configuración → **Nombres automáticos** (`/settings/aliases`). Coincidencia materializada en `Transaction.aliasId`, aplicada a pasados y a los que llegan; sin acentos ni mayúsculas (`unaccent`); la expresión regular solo se evalúa en Postgres (límite 5 s). Vista previa en vivo, que dice cuántos conservan un nombre propio o el de una regla de mayor prioridad. Al editar o apagar una regla se conserva su cuenta de transferencia. |
| Crear el nombre automático desde un movimiento | ✅ | ⏳ | ✅ | **Editar** (detalle) → "Usar un nombre automático para los parecidos": abre ahí mismo una sección con la regla prellenada (patrón probable con las palabras sin números del texto del banco, "Sugerir con IA", vista previa, nombre, privacidad y PIN); usa la categoría elegida para el movimiento. Al guardar se crea la regla y se quita el nombre propio del movimiento. |
| Patrón sugerido con IA | ✅ | ⏳ | ✅ | `suggestAliasPattern(transactionIds)`: la IA (feature `alias_pattern`) propone contiene / empieza con / regex; se comprueba en Postgres que cubra los ejemplos (un reintento diciéndole cuál no cubrió), y si no, las palabras que comparten los ejemplos. En Configuración usa como ejemplos los movimientos de la vista previa. |
| Gasto por nombre automático | ✅ | ⏳ | ✅ | `MerchantAlias.spending(from, to)`: lo que suman los movimientos que muestra (sin nombre propio). Las tarjetas muestran mes y año, y "Ver movimientos" abre el historial filtrado (`?alias=`, `TransactionFilters.aliasId`). La regla también puede poner una categoría. |
| Nombre propio de un movimiento | ✅ | ⏳ | ✅ | `setTransactionAlias`; le gana al nombre automático. En las listas (historial, Clasificar, cuenta), el lápiz junto al nombre (al pasar el mouse) lo edita ahí mismo en la card. Un solo modal (**Editar**, en el detalle) junta el nombre y la privacidad con la categoría, los datos y las notas: muestra el texto del banco, el nombre automático que aplica y si la privacidad viene de la regla (`ownPrivate`, `aliasRule`); el interruptor "Privado" va debajo del nombre propio. |
| Privado y PIN de privacidad | ✅ | ⏳ | ✅ | Privado: en listas y búsquedas solo se ve el nombre; el texto del banco, con "Ver original" en el detalle. Un nombre automático **protegido con PIN** (`isProtected`, siempre privado) no muestra su patrón, no se edita, apaga ni borra, y sus movimientos no dan el texto del banco (`originalLocked`) sin el PIN de privacidad. Tampoco salen en la vista previa ni en la sugerencia de IA de otra regla, y siempre gana a las reglas no protegidas. PIN de 4 a 8 dígitos en Configuración → Seguridad (`setPrivacyPin`); `unlockPrivacy` da un desbloqueo de 10 min (cookie httpOnly `finnit_privacy`, header `x-privacy-unlock`); 5 intentos fallidos pausan 15 min. "Olvidé mi PIN" manda un enlace de 30 min (`requestPrivacyPinReset`, `/settings/privacy/reset`); por ahora el correo solo se registra en el log (`MailService` de prueba, `MAIL_TRANSPORT=console`). |

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
| Alta manual de débito y crédito | ✅ | ✅ | ✅ | `createAccount` (nombre repetido → `CONFLICT`); también efectivo y ahorro. Liga desde Bancos conectados: "¿Tu banco no aparece?". |
| Corte, fecha de pago y tasa de la tarjeta | ✅ | ⏳ | ✅ | `setCreditCardTerms`. |
| Saldo inicial sin contarlo como ingreso o gasto | ✅ | — | — | Se registra como ajuste ("Initial balance") en la misma transacción de BD. |
| Ligar después una cuenta manual a una conexión bancaria | 🟡 | ⏳ | ⏳ | `linkBankAccount` ya acepta una cuenta existente. |

### Idiomas *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Interfaz en español e inglés | ✅ | ⏳ | ✅ | Web con `next-intl`; selector en Ajustes (`updateMyPreferences`, `User.locale`). |
| Categorías traducidas | ✅ | ⏳ | ✅ | `CategoryTranslation` (en/es); las del usuario se traducen con Google Cloud Translation (respaldo con IA). |

### Apariencia *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Temas Finnit, Glass, Suave y Mono (claro y oscuro) | — | ⏳ | ✅ | Una paleta para todo el sitio (`FINNIT_THEME`), rendereada en `<html data-theme>` (sin parpadeo). Los usuarios solo eligen claro / oscuro / sistema (`next-themes`). Los administradores tienen "Vista previa de tema" en el menú de perfil: cambia solo su navegador (cookie `finnit-theme-preview`). |
| Header de vidrio con saludo | — | ⏳ | ✅ | Barra flotante siempre en vidrio; el inicio muestra "Hola, {nombre}" y la fecha. |
| Detalle desde las listas | — | ⏳ | ✅ | Toda la card de un movimiento (`TransactionCard` de `@finnit/ui`; sugerencia de categoría dentro) abre su detalle: drawer a la derecha cuando se ve el menú lateral (lg), modal abajo de eso; cargado con una server action (`loadTransactionDetailAction`). Los movimientos no tienen página propia: también la línea de un estado de cuenta y el otro lado de una transferencia abren el detalle ahí. Lo que cambia en el detalle recarga la lista que lo abrió (`open(id, { onChange })`): en Clasificar, el que ya tiene categoría sale de la lista. Sin menú de tres puntos. |
| Menú lateral colapsable | — | — | ✅ | Rail flotante de vidrio que pasa de 256 px a solo íconos (con tooltips) con animación; ⌘B / Ctrl+B; estado en la cookie `finnit-sidebar`. Ítem **Calendario** propio; submenús **Movimientos** (Historial, Clasificar, Recurrentes, Estados de cuenta) y **Planeación** (Presupuestos, Deudas, Metas, Simulador): se despliegan en su lugar (cookie `finnit-nav-groups`; el del módulo actual se abre solo) y, colapsado, abren un menú flotante al lado. |
| Perfil y foto | ✅ | ⏳ | ✅ | Perfil fijo abajo del menú lateral (en el header por debajo de lg) con menú: claro / oscuro / sistema, vista previa de tema (admins), Configuración y cerrar sesión. Foto: la subida por el usuario (`POST/GET /me/avatar`, S3 privado, recortada a 256 px en el navegador; `removeMyAvatar`), si no la de Google (claim `picture`, se actualiza al entrar con Google), si no las iniciales. Configuración → Editar perfil cambia foto y nombre. |

### 21. Landing pública y lista de espera *(nuevo)*

| Funcionalidad | API | Móvil | Web | Notas |
|---|---|---|---|---|
| Landing en `/` | — | — | ✅ | Qué es Finnit y cómo usa la IA (tickets, capturas del banco, categorías que aprenden, conexión bancaria, deudas, conciliación), vista previa con componentes reales, privacidad. Se ve con y sin sesión ("Ir a mi cuenta"). es/en, claro/oscuro y las 4 paletas. |
| Lista de espera | ✅ | — | ✅ | `joinWaitlist` (público, con límite de intentos; siempre responde `ok`, no revela quién está). Guarda correo, idioma y `utm_source`/`ref`. Honeypot contra bots. |
| SEO | — | — | ✅ | Metadata, OpenGraph/Twitter, imagen OG generada, `robots.txt` (solo `/`) y `sitemap.xml`. |
| Vercel Web Analytics | — | — | ✅ | `@vercel/analytics` en el layout raíz; sin query strings, sin `/admin`; evento `waitlist_joined` (planes Pro). Activarlo en Vercel: [deployment.md](./deployment.md). |

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
