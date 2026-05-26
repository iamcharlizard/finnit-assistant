#!/bin/bash
set -e

STITCH_DIR="stitch"
APP_DIR="apps/finnit-app"

echo "🚀 Lanzando agente principal..."

claude --dangerously-skip-permissions "
Eres el agente principal de setup para la app Finnit (React Native + Expo Router).
Sigue estos pasos en orden y no omitas ninguno.

## PASO 1 — Leer especificaciones
- Lee DESIGN.md. Extrae: paleta de colores (light y dark), tipografía (escala y
  familia Ubuntu), espaciados, border radius y efectos visuales.
- Lee EXAMPLE.md. Entiende: patrones de componentes, cómo se usan los tokens,
  la estructura de carpetas sugerida, y cómo se mezcla className con style={}.

## PASO 2 — Configurar NativeWind v5 + Tailwind v4 + react-native-css
Este proyecto usa NativeWind v5 (CSS-first). Sigue estos pasos exactos.

### 2a — Instalar dependencias si faltan
Revisa $APP_DIR/package.json. Si no están instalados:
  cd $APP_DIR && npx expo install tailwindcss@^4 nativewind@5.0.0-preview.2 react-native-css@0.0.0-nightly.5ce6396 @tailwindcss/postcss tailwind-merge clsx

Agrega esto a package.json si no está (compatibilidad de lightningcss):
  "resolutions": { "lightningcss": "1.30.1" }

### 2b — Metro config
Crea o actualiza $APP_DIR/metro.config.js:
  const { getDefaultConfig } = require('expo/metro-config');
  const { withNativewind } = require('nativewind/metro');
  const config = getDefaultConfig(__dirname);
  module.exports = withNativewind(config, {
    inlineVariables: false,
    globalClassNamePolyfill: false,
  });

### 2c — PostCSS config
Crea $APP_DIR/postcss.config.mjs:
  export default { plugins: { '@tailwindcss/postcss': {} } };

### 2d — Global CSS con tokens de DESIGN.md
Crea $APP_DIR/src/global.css:
  @import 'tailwindcss/theme.css' layer(theme);
  @import 'tailwindcss/preflight.css' layer(base);
  @import 'tailwindcss/utilities.css';

  @layer theme {
    @theme {
      /* Tokens de DESIGN.md — light (valores base) */
      --color-primary: #00f5ff;
      --color-background: #f8f9fa;
      --color-surface: #ffffff;
      --color-on-background: #1a1b22;
      --color-on-surface-variant: #5c6370;
      --color-outline: #e0e0e0;
      --color-accent-neon: #6c72cb;

      /* Tokens dark */
      --color-primary-dark: #6c72cb;
      --color-background-dark: #12131a;
      --color-surface-dark: #1a1b22;
      --color-on-background-dark: #f8f9fa;
      --color-on-surface-variant-dark: #a0a0a0;
      --color-outline-dark: #2d2e38;
      --color-accent-neon-dark: #00f5ff;

      /* Tipografía */
      --font-ubuntu: 'Ubuntu', sans-serif;
      --font-ubuntu-medium: 'Ubuntu Medium', sans-serif;
      --font-ubuntu-bold: 'Ubuntu Bold', sans-serif;
    }
  }

  @media ios {
    :root {
      --font-sans: system-ui;
      --font-rounded: ui-rounded;
    }
  }
  @media android {
    :root {
      --font-sans: normal;
      --font-rounded: normal;
    }
  }

Verifica que global.css se importe en el entry point de la app.

### 2e — Wrappers CSS para componentes base
Crea $APP_DIR/src/tw/index.tsx con los wrappers de useCssElement para:
View, Text, Pressable, ScrollView, TextInput, TouchableHighlight, Link
(siguiendo el patrón de react-native-css donde className se mapea a style).
Crea $APP_DIR/src/tw/image.tsx para el wrapper de expo-image.
Crea $APP_DIR/src/tw/animated.tsx para Animated.View usando los wrappers.

### 2f — Eliminar configuración legacy si existe
- Si babel.config.js tiene presets de nativewind v4, ELIMÍNALOS
  (nativewind v5 no necesita babel)
- Si existe tailwind.config.js con config de v3, ELIMÍNALO
  (la config ahora va en global.css con @theme)

NOTA: autoprefixer NO es necesario (lightningcss lo maneja).
      postcss viene incluido en Expo por defecto, no instalar por separado.

## PASO 2g — Verificar SDK y habilitar optimizaciones
Lee $APP_DIR/package.json y el app.json/app.config.js del proyecto.

- Detecta la versión de Expo SDK instalada.
- Si SDK >= 54:
  * Verifica que 'react-native-worklets' esté en package.json (requerido para
    Reanimated). Si no está: cd $APP_DIR && npx expo install react-native-worklets
  * Habilita React Compiler en app.json si no está:
    "experiments": { "reactCompiler": true }
    Esto elimina la necesidad de useMemo/useCallback/React.memo manuales.
- NUNCA agregues "newArchEnabled": true — es el default desde SDK 53.
- NUNCA agregues autoprefixer al postcss.config.mjs — lightningcss lo maneja.

## PASO 3 — Configurar tipografía Ubuntu
- Revisa si '@expo-google-fonts/ubuntu' está en package.json.
  - Si NO está: instálalo con 'cd $APP_DIR && npx expo install @expo-google-fonts/ubuntu expo-font'
- Verifica que en el entry point (app/_layout.tsx o App.tsx) se carguen las fuentes
  con useFonts antes de renderizar. Si no está configurado, agrégalo.

## PASO 4 — Configurar efectos visuales (glassmorphism)
- Revisa si 'expo-glass-effect' está en package.json.
  - Si NO está: instálalo con 'cd $APP_DIR && npx expo install expo-glass-effect'
- Revisa si 'expo-blur' está en package.json.
  - Si NO está: instálalo con 'cd $APP_DIR && npx expo install expo-blur'
- Crea $APP_DIR/components/ui/glass-view.tsx con el siguiente patrón:
  * Importa GlassView de 'expo-glass-effect' e isLiquidGlassAvailable
  * Importa BlurView de 'expo-blur' como fallback
  * Si isLiquidGlassAvailable() → usa GlassView
  * Si no → usa BlurView con tint='systemMaterial' intensity=80
  * El componente debe aceptar prop 'isInteractive' para botones/pressables

## PASO 5 — Analizar pantallas de Stitch
- Lista todas las carpetas en $STITCH_DIR/
- Lee el code.html de cada una
- Identifica componentes compartidos entre pantallas

## PASO 6 — Crear componentes base
Crea los componentes en $APP_DIR/components/ con esta estructura:

  components/
  ├── ui/                  ← primitivos puros sin lógica de negocio
  │   ├── button.tsx
  │   ├── input.tsx
  │   ├── typography.tsx
  │   └── glass-view.tsx
  ├── features/
  │   └── finance/         ← componentes de dominio financiero
  │       ├── balance-card.tsx
  │       ├── transaction-item.tsx
  │       └── quick-action.tsx
  └── navigation/          ← componentes de navegación
      ├── bottom-nav-bar.tsx
      └── top-app-bar.tsx

### Reglas de organización
- ui/ no conoce lógica de negocio ni importa de features/ ni navigation/
- features/finance/ puede importar de ui/, nunca al revés
- navigation/ puede importar de ui/, nunca al revés

### Reglas de composición (CRÍTICO)
Estos patrones previenen componentes unmaintainable:

1. NUNCA uses boolean props para cambiar comportamiento:
   ❌ <BalanceCard isLoading isDark isCompact showChart />
   ✅ Crea variantes explícitas: <BalanceCardSkeleton />, <BalanceCardCompact />

2. Componentes complejos deben ser compound components con contexto compartido:
   Si un componente tiene subpartes que comparten estado, expórtalas como:
   const BalanceCard = { Root: ..., Header: ..., Chart: ..., Footer: ... }
   Los subcomponentes acceden al estado vía use(BalanceCardContext), no por props

3. El estado va en providers, no atrapado en el componente:
   Si dos subcomponentes necesitan el mismo estado → Context + Provider
   NUNCA uses useEffect para sincronizar estado hacia arriba

4. Usa children para composición, no render props:
   ❌ <Card renderHeader={() => <Title />} renderFooter={() => <Actions />} />
   ✅ <Card><Card.Header><Title /></Card.Header><Card.Footer><Actions /></Card.Footer></Card>
   Excepción: usa render props solo cuando el padre necesita pasar datos al hijo
   (ej: renderItem en FlatList)

5. Variantes explícitas sobre props booleanas:
   ❌ <TransactionItem isPositive={amount > 0} isExpanded isPending />
   ✅ <TransactionItemIncome />, <TransactionItemExpense />, <TransactionItemPending />
   Cada variante compone las piezas que necesita

6. React 19 APIs (verifica la versión de React en package.json antes de aplicar):
   - Si React >= 19: usa use(Context) en lugar de useContext(Context)
   - Si React >= 19: ref es prop normal, no uses forwardRef
   - Si React < 19: usa useContext y forwardRef normalmente

### Reglas de estilos
- className de NativeWind para valores ESTÁTICOS del config/global.css
- style={{}} inline para valores DINÁMICOS o rgba() con opacidad variable
- StyleSheet.create SOLO cuando los estilos se reutilizan dentro del archivo
- NUNCA 'elevation' ni shadow props legacy; usa style={{ boxShadow: '...' }}
- Para gradientes: style={{ experimental_backgroundImage: 'linear-gradient(...)' }}
  NO instales ni uses expo-linear-gradient
- useColorScheme siempre desde 'nativewind', no desde 'react-native'

### Reglas de componentes React Native
- View, Text, Pressable (no TouchableOpacity salvo casos justificados)
- expo-image para imágenes, no Image de react-native
- SymbolView de 'expo-symbols' para íconos; NUNCA FontAwesome ni Ionicons
- process.env.EXPO_OS en lugar de Platform.OS
- useWindowDimensions en lugar de Dimensions.get()
- react-native-safe-area-context en lugar de SafeAreaView de react-native
- Toda ScrollView con contentInsetAdjustmentBehavior='automatic'
- Props siempre tipadas con TypeScript, nunca 'any'
- Nomenclatura de archivos en kebab-case, componentes exportados en PascalCase

### Reglas de TypeScript
- Usa 'interface' para shapes de objetos con propiedades: interface ButtonProps { ... }
- Usa 'type' para unions, intersecciones y tipos complejos: type Status = 'idle' | 'loading' | 'error' | 'success'
- Usa 'unknown' en lugar de 'any' cuando el tipo no se conoce; luego usa type guards
- Para estados async de componentes, usa discriminated unions en lugar de múltiples booleanos:
  ❌ isLoading: boolean; hasError: boolean; data: T | null
  ✅ type State<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'success'; data: T }
- NUNCA uses type assertions (as SomeType) para resolver errores de tipos; usa type guards
- Si SDK >= 54 y React Compiler está habilitado: NO agregues useMemo, useCallback ni React.memo
  El compilador los maneja automáticamente

### Reglas de Turborepo (este proyecto es un monorepo)
- Todo paquete instalado debe ir en $APP_DIR/package.json, NUNCA en el package.json raíz
- Si agregas scripts nuevos, agrégalos en $APP_DIR/package.json y regístralos en turbo.json raíz
- Los comandos de instalación siempre con 'cd $APP_DIR &&' antes de ejecutarlos

### Reglas de accesibilidad (WCAG AA)
- Todo ícono interactivo necesita accessibilityLabel descriptivo
- Todo input necesita accessibilityLabel o accessibilityLabelledBy
- Elementos touch: mínimo 44×44px
- No depender solo del color para información crítica (añadir ícono o texto)
- Contraste mínimo 4.5:1 texto normal, 3:1 texto grande

### Reglas de animaciones
- Reanimated v4 para animaciones de entrada/salida
  import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
- NUNCA el Animated API nativo de React Native
- Si React Compiler está habilitado (SDK >= 54), no envuelvas callbacks de animación
  en useCallback — el compilador lo optimiza

### Verificación de clases NativeWind
Después de crear cada componente:
- Revisa clases no soportadas en RN y reemplaza con style={{}}:
  backdrop-filter, grid, grid-cols-*, hover:, focus:, group-hover:, active:
- Deja comentario // NW-FALLBACK donde uses style en lugar de className
"

echo "✅ Agente principal terminado"

# ─── AGENTES N: Uno por pantalla ─────────────────────────────────────────────
echo ""
echo "🚀 Lanzando agentes por pantalla..."
mkdir -p logs

for screen_path in "$STITCH_DIR"/*/; do
  screen=$(basename "$screen_path")
  screen_pascal="$(tr '[:lower:]' '[:upper:]' <<< ${screen:0:1})${screen:1}"

  claude --dangerously-skip-permissions "
Eres el agente de la pantalla '$screen' para la app Finnit (React Native + Expo Router).
Tu única responsabilidad es implementar esa pantalla.

## Contexto — lee esto antes de escribir código
- Lee DESIGN.md para tokens de diseño (colores, tipografía, efectos).
- Lee $STITCH_DIR/$screen/code.html para la estructura del diseño.
- Observa la imagen en $STITCH_DIR/$screen/ para validar proporciones visuales.
- Lee $APP_DIR/components/ para conocer los componentes disponibles.
  USA los que ya existen, no los dupliques ni los modifiques.
- Lee $APP_DIR/src/global.css para conocer los tokens disponibles como clases
  (--color-primary, --color-surface, etc. definidos en @theme).

## Dirección visual (IMPORTANTE)
No generes UI genérica. Finnit tiene una dirección estética definida en DESIGN.md:
- Glassmorphism como elemento visual distintivo (usa GlassView de components/ui/)
- Tipografía Ubuntu en sus variantes (ubuntu, ubuntu-medium, ubuntu-bold)
- Paleta de color con acento cian (#00f5ff) en light y purple (#6c72cb) en dark
- Bordes redondeados generosos (32px según EXAMPLE.md)
- Composición con profundidad: capas, transparencias, sombras sutiles
Al implementar cada pantalla, respeta fielmente esta dirección del diseño original.
Usa la imagen de $STITCH_DIR/$screen/ como referencia visual autoritativa.

## Reglas de TypeScript
- 'interface' para shapes de objetos, 'type' para unions y tipos complejos
- 'unknown' en lugar de 'any'; usa type guards para narrowing
- Para estados async usa discriminated unions:
  ❌ isLoading: boolean; hasError: boolean; data: T | null
  ✅ type ScreenState<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'success'; data: T }
- NUNCA type assertions (as SomeType) para resolver errores; usa type guards
- Si React Compiler activo (SDK >= 54): NO uses useMemo, useCallback ni React.memo

## Reglas de composición
1. NUNCA boolean props para cambiar comportamiento → variantes explícitas
2. Si la pantalla tiene secciones con estado compartido → Context + Provider
   separados del JSX, estado nunca atrapado en el componente raíz
3. children para composición, no render props (salvo FlatList/SectionList)
4. Verifica la versión de React en $APP_DIR/package.json:
   - React >= 19: usa use(Context), ref como prop normal (no forwardRef)
   - React < 19: usa useContext y forwardRef normalmente

## Reglas de componentes de navegación (SDK 55+)
Si la pantalla usa NativeTabs, usa la API correcta de SDK 55:
- NativeTabs.Trigger.Icon (NO el import separado Icon)
- NativeTabs.Trigger.Label (NO el import separado Label)
- NativeTabs.Trigger.Badge (NO el import separado Badge)
- Solo importa: import { NativeTabs } from 'expo-router/unstable-native-tabs'
- Íconos con prop 'md' para Android: <NativeTabs.Trigger.Icon sf="house.fill" md="home" />

## Reglas de estilos
- className de NativeWind para valores estáticos del config
- style={{}} inline para valores dinámicos o rgba() variable
- StyleSheet.create solo si los estilos se reutilizan en el mismo archivo
- NUNCA 'elevation' ni shadow props legacy; usa style={{ boxShadow: '...' }}
- Para gradientes: style={{ experimental_backgroundImage: 'linear-gradient(...)' }}
- Clases NO soportadas en RN → reemplaza con style={{}}:
  backdrop-filter, grid, grid-cols-*, hover:, focus:, group-hover:, active:
- Agrega comentario // NW-FALLBACK donde uses style en lugar de className
- useColorScheme siempre desde 'nativewind'

## Reglas de componentes
- View, Text, Pressable (no TouchableOpacity salvo casos justificados)
- expo-image para imágenes, no Image de react-native
- SymbolView de 'expo-symbols' para íconos; NUNCA FontAwesome ni Ionicons
- process.env.EXPO_OS en lugar de Platform.OS
- useWindowDimensions en lugar de Dimensions.get()
- react-native-safe-area-context en lugar de SafeAreaView de react-native
- ScrollView como primer hijo con contentInsetAdjustmentBehavior='automatic'
- Reanimated v4 para animaciones de entrada (FadeIn, FadeInUp, etc.)
  Añade entering={FadeInUp.duration(300).delay(index * 50)} a listas y cards
- Props tipadas con TypeScript, nunca 'any'

## Reglas de accesibilidad (WCAG AA)
- Todo ícono interactivo: accessibilityLabel descriptivo
- Todo input: accessibilityLabel o accessibilityLabelledBy
- Elementos touch: mínimo 44×44px
- No depender solo del color para información crítica

## Reglas de datos y API
- Usa fetch nativo; NUNCA instales ni uses axios
- Si la pantalla necesita datos del servidor:
  * Deja TODO con el hook de React Query sugerido:
    // TODO: const { data } = useQuery({ queryKey: ['recurso'], queryFn: fetchRecurso })
  * Los fetchers van en lib/api/{recurso}.ts, no inline en el componente
  * Query keys como factory: queryKeys.recurso.list(), queryKeys.recurso.detail(id)
- Si la pantalla llama a una API externa con credenciales o API keys:
  * NO hagas fetch directo desde el cliente (las keys quedan expuestas)
  * Deja TODO apuntando a una API route:
    // TODO: crear app/api/{recurso}+api.ts y llamar a /api/{recurso} desde aquí
  * Variables de entorno públicas (URLs): EXPO_PUBLIC_ en .env
  * Secrets (API keys, tokens): vars sin prefijo, solo accesibles desde API routes
- Para tokens de autenticación: almacenar con expo-secure-store, nunca AsyncStorage
- Si la pantalla puede usarse sin conexión, agrega comentario:
  // TODO: implementar soporte offline con React Query persistence + NetInfo

## Lo que debes crear

### 1. $APP_DIR/screens/${screen}.tsx
- Componente React Native completo de la pantalla
- Importa desde:
    $APP_DIR/components/ui/
    $APP_DIR/components/features/finance/
    $APP_DIR/components/navigation/
- ScrollView como primer hijo con contentInsetAdjustmentBehavior='automatic'

### 2. $APP_DIR/app/${screen}.tsx
- Solo importa y re-exporta la screen (sin lógica, sin JSX adicional):

import { ${screen_pascal}Screen } from '@/screens/${screen}';
export default ${screen_pascal}Screen;

IMPORTANTE: No co-loques componentes, tipos ni utilidades en app/.
app/ es solo para archivos de ruta y _layout.tsx.

## Reglas estrictas
- NO modifiques nada fuera de screens/ y app/
- NO modifiques ni elimines nada en components/ (solo léelos)
- NO instales paquetes
- Si necesitas un componente que no existe en components/, créalo en
  components/features/finance/ con comentario:
  // TODO: evaluar si mover a ui/ si resulta ser genérico
" > "logs/$screen.log" 2>&1 &

  echo "  → Agente '$screen' lanzado (log: logs/$screen.log)"
done

wait
echo ""
echo "✅ Todas las pantallas procesadas"
echo ""
echo "Logs disponibles en logs/:"
ls logs/
