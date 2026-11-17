# Plan: widget de saldo en iOS

**Creado:** 17 de noviembre, 2026
**Estado:** plan (sin código)
**Alcance:** app móvil (`apps/finnit-app`), solo iOS. Android queda para después.

## Objetivo

Ver el saldo disponible sin abrir Finnit:

- **Pantalla de inicio:** widget pequeño (`systemSmall`) y mediano (`systemMedium`).
- **Pantalla de bloqueo:** `accessoryRectangular` y `accessoryInline`.

Al tocar el widget se abre la app en Inicio.

### Fuera de alcance (por ahora)

- Android (`enableAndroid`).
- Live Activities.
- Widgets configurables (elegir cuenta).
- Botones dentro del widget.

## Decisión técnica

Usar **`expo-widgets`** (oficial de Expo, estable desde SDK 56, con versión para SDK 58), junto con `@expo/ui`:

- El widget se escribe como componente con la directiva `'widget'` y componentes de `@expo/ui/swift-ui`.
- El config plugin genera el target del widget, el App Group y el código SwiftUI en el `prebuild` (CNG). `ios/` sigue fuera de git.
- El widget **no hace llamadas de red**. La app le manda un "snapshot" con los textos ya formateados (`updateSnapshot`). Así los tokens se quedan en SecureStore y el widget no necesita sesión.

Se descartan:

- `@bacons/apple-targets`: obliga a mantener Swift a mano.
- Un config plugin propio: más mantenimiento sin una ventaja clara para un widget de solo lectura.

## Qué muestra

| Familia | Contenido |
|---|---|
| `systemSmall` | "Disponible", monto principal, hora de actualización |
| `systemMedium` | Lo anterior, más deuda en tarjetas (si hay) y el próximo pago (fase 2) |
| `accessoryRectangular` | "Disponible" + monto (oculto con el teléfono bloqueado, ver Privacidad) |
| `accessoryInline` | "Finnit · $12,450" (o "Finnit · ••••") |

Reglas, iguales a las de Inicio:

- **Saldo:** el de `summarizeBalances` (`packages/core/src/finance/accounts.ts`). Solo cuentas no archivadas y con `includeInTotal`.
- **Moneda:** la principal. Si hay otras monedas, el mediano muestra "+N monedas" y no las suma.
- **Estados especiales:**
  - Sin sesión: "Inicia sesión en Finnit".
  - Sin cuentas: "Agrega una cuenta".
  - Datos viejos: se muestra la hora de actualización. No se intenta que sea "tiempo real".

## Privacidad (requisito, no extra)

1. **Ocultar montos.** Si el usuario tiene activado "Ocultar montos" en el dispositivo (`useAmountsVisibility`), el snapshot va enmascarado. Se reutiliza `maskDashboardView` de `@finnit/core/dashboard/view`.
2. **Pantalla de bloqueo.** Mientras el teléfono está bloqueado, el monto se oculta (contenido marcado como privado). Hay que confirmar en el spike que `@expo/ui` expone `privacySensitive` o `redacted`. Si no, las familias `accessory*` muestran solo "Finnit" y un icono hasta que se resuelva.
3. **Ajuste "Mostrar saldo en widgets".** Encendido por defecto en pantalla de inicio y apagado en pantalla de bloqueo. Se guarda en el dispositivo con `lib/session/storage.ts`, igual que `hideAmounts`.
4. **Cerrar sesión o cambiar de usuario.** El snapshot pasa a "Inicia sesión", para no dejar el saldo de otra persona en pantalla. Se engancha en `endSession` de `contexts/AuthContext.tsx`.

## Diseño del código

```
packages/core/src/widgets/
  balance.ts          ← builder puro: DashboardView | estado → props del widget (strings)
  balance.test.ts
packages/core/messages/{es,en}.json
  widgets.balance.*   ← "Disponible", "Actualizado {time}", "Inicia sesión en Finnit", …

apps/finnit-app/widgets/
  balance-widget.tsx  ← createWidget('BalanceWidget', …) con @expo/ui/swift-ui
apps/finnit-app/lib/widgets/
  sync.ts             ← syncBalanceWidget(props) → BalanceWidget.updateSnapshot(...)
  use-widget-sync.ts  ← hook montado en (app)/_layout
```

### Builder en `@finnit/core` (puro, con tests)

```ts
type BalanceWidgetProps =
  | { state: 'signedOut' | 'empty'; title: string; updatedAt: string }
  | {
      state: 'ready';
      title: string;          // "Disponible"
      available: string;      // "$12,450.00" o "••••"
      creditDebt: string | null;
      otherCurrencies: number;
      nextPayment: string | null; // fase 2
      updatedAt: string;      // "Actualizado 14:32"
      masked: boolean;
    };

buildBalanceWidgetProps(view: DashboardView | null, opts: { hidden: boolean; now: Date }, l: Localizer)
```

- Recibe la `DashboardView` que ya construye Inicio. No hay que duplicar reglas de saldo.
- Las horas se formatean en America/Mexico_City, como el resto de core.
- Los textos traducidos salen del `Localizer`: el widget no tiene `use-intl`.

### Cuándo se actualiza el snapshot

`useWidgetSync()` se monta en `app/(app)/_layout.tsx` (la guarda de sesión) y actualiza en estos casos:

- **Al cargar o refrescar Inicio.** `DashboardScreen` ya tiene `fullView`, así que se llama a `syncBalanceWidget` con esa vista.
- **Cuando cambia un movimiento** (`useOnTransactionsChanged`) o una cuenta. Corre una consulta ligera, `WIDGET_BALANCE_QUERY` en `@finnit/core/widgets/request.ts` con solo las cuentas, y vuelve a llamar al builder. No se carga todo `DASHBOARD_QUERY`.
- **Cuando la app pasa a segundo plano** (`AppState` → `background`): última actualización con lo que haya en memoria.
- **Cuando cambia "Ocultar montos"** o el ajuste de widgets.
- **Al cerrar sesión:** estado `signedOut`.

Después de `updateSnapshot` se llama a `reload()` solo si hace falta. `updateSnapshot` ya muestra el cambio, y iOS limita las recargas.

### Componente del widget

- Raíz con `containerBackground`. Es obligatorio desde iOS 17; sin él, iOS muestra un aviso en lugar del widget.
- Toma el tamaño con la familia (`widgetFamily`) y elige el diseño de la tabla de arriba.
- **Colores:** los de la paleta `finnit` (claro y oscuro) escritos directo en el componente, porque el widget no puede importar constantes. Se toman de `packages/ui-native/src/theme/tokens.generated.ts` y se apuntan en un comentario para mantenerlos a mano. Por ahora el widget no sigue la paleta que el usuario eligió.
- **Fuente:** del sistema (SF), salvo que el spike muestre que se puede incluir Ubuntu en la extensión sin trabajo extra.
- **Tap:** `finnitapp://dashboard` (con `widgetURL` o equivalente). Si no está disponible, al tocarlo se abre la app en su última pantalla, que es el comportamiento por defecto.

## Fases

### Fase 0: spike (½–1 día)

- [ ] Instalar `expo-widgets` y `@expo/ui` (versiones de SDK 58) y verificar que funcionen con RN 0.88, React 19.3 y `reactCompiler: true`. La directiva `'widget'` podría no llevarse bien con el compilador; ver si hay que excluir `widgets/`.
- [ ] Un widget "Hola" en `systemSmall`, compilado con `npx expo prebuild --clean` (con `LANG=en_US.UTF-8` para `pod install`) en simulador y en un dispositivo.
- [ ] Confirmar qué expone `@expo/ui`:
  - `containerBackground`;
  - marcar contenido privado o `redacted`;
  - deep link al tocar;
  - colores distintos en claro y oscuro;
  - lectura de `widgetFamily`;
  - fuentes personalizadas.
- [ ] Confirmar la firma del App Group `group.com.karlhub.finnitapp` y del target `com.karlhub.finnitapp.ExpoWidgetsTarget` con el team `DBLC2KXWY6`. Puede requerir registrar el App Group en Apple Developer y regenerar perfiles.
- [ ] Ver si `displayName` y `description` del widget se pueden traducir (`locales/{es,en}.json`) o se quedan en español.

**Salida:** lista de lo que sí y no se puede hacer. Con eso se ajustan las secciones de Privacidad y Componente del widget de este plan.

### Fase 1: widget de saldo (2–3 días)

- [ ] `@finnit/core/widgets/balance.ts` + tests: signedOut, empty, ready, masked, otra moneda, crédito sin crédito.
- [ ] Mensajes `widgets.balance.*` en `es.json` y `en.json`; el test de que ambos archivos coinciden debe pasar.
- [ ] `WIDGET_BALANCE_QUERY` en core (solo las cuentas, con los campos de `ACCOUNT_FIELDS` que pide `summarizeBalances`).
- [ ] `widgets/balance-widget.tsx` con las 4 familias.
- [ ] `lib/widgets/sync.ts` + `use-widget-sync.ts`; enganche en Inicio, en cambios de movimientos, en segundo plano y en cierre de sesión.
- [ ] Ajuste "Mostrar saldo en widgets" (inicio y bloqueo) en `screens/settings.tsx`.
- [ ] Plugin en `app.json`:
  ```json
  ["expo-widgets", {
    "widgets": [{
      "name": "BalanceWidget",
      "displayName": "Saldo",
      "description": "Tu saldo disponible en Finnit",
      "ios": { "supportedFamilies": ["systemSmall", "systemMedium", "accessoryRectangular", "accessoryInline"] }
    }]
  }]
  ```

### Fase 2: próximo pago en el mediano (1 día)

- [ ] Agregar a `WIDGET_BALANCE_QUERY` lo que necesita `upcoming` de Inicio, o reutilizar `view.upcoming[0]` cuando venga de Inicio.
- [ ] "Tarjeta BBVA · vence en 3 días". Con `updateTimeline` se puede programar el cambio de "en 3 días" a "mañana" sin abrir la app.

### Fase 3 (opcional): refresco en segundo plano

- [ ] `expo-background-task`: consultar las cuentas y actualizar el snapshot cuando iOS lo permita.
- [ ] **Riesgo:** necesita leer y renovar el token desde SecureStore en segundo plano, con el keychain en accesibilidad `AFTER_FIRST_UNLOCK`. Revisarlo antes de comprometerse a esta fase.

## Pruebas

**Automáticas:**

- `pnpm --filter @finnit/core test`: builder y mensajes.
- `pnpm check-types` y lint de la app.

**Manuales** (simulador y un iPhone real con iOS 17 o posterior):

1. Iniciar sesión, abrir Inicio, agregar el widget pequeño: muestra el mismo "Disponible" que Inicio.
2. Registrar un gasto desde "+": el widget cambia sin volver a Inicio.
3. Activar "Ocultar montos": el widget pasa a `••••`. Desactivarlo con PIN: vuelve el monto.
4. Agregar `accessoryRectangular` a la pantalla de bloqueo y bloquear el teléfono: no se ve el monto (o se ve solo con el ajuste encendido y el teléfono desbloqueado).
5. Cerrar sesión: el widget dice "Inicia sesión en Finnit".
6. Cuenta con `includeInTotal = false`: no suma en el widget, igual que en Inicio.
7. Usuario con una cuenta en USD: el mediano muestra "+1 moneda".
8. Modo claro y oscuro del sistema: el widget se lee bien en los dos.
9. Tocar el widget: abre Inicio.

## Riesgos

- **Compatibilidad** de `expo-widgets` con React Compiler, RN 0.88 o NativeWind en el build. Se valida en la fase 0.
- **Firma:** el App Group y el nuevo target necesitan perfiles. Si los builds son locales, hay que configurarlos en Xcode o en Apple Developer.
- **Datos viejos:** sin la fase 3, el widget muestra lo de la última vez que se abrió la app. Lo mitiga la hora de actualización visible.
- **Privacidad:** un saldo en la pantalla de bloqueo es sensible. Por eso está apagado por defecto ahí.
- **Colores duplicados:** los del widget pueden quedar desfasados de los tokens. Anotar en `CLAUDE.md` que se actualizan junto con `pnpm --filter @finnit/ui-native tokens`.

## Sin migraciones ni cambios en la API

Solo se lee la query `accounts`, que ya existe.

**Rollback:**

1. Quitar el plugin de `app.json` y las dependencias.
2. `npx expo prebuild --clean` y recompilar.

Los widgets que el usuario ya agregó desaparecen con la actualización.

## Al terminar

- [ ] `docs/features.md`: el widget en "App móvil".
- [ ] `CLAUDE.md`, sección móvil: dónde viven el widget, el builder y la sincronización, y la regla de colores.
- [ ] `docs/prd.md`, *Scope implemented*.
