#!/bin/bash
set -e

STITCH_DIR="stitch"
APP_DIR="apps/finnit-app"


# ─── AGENTES N: Uno por pantalla ─────────────────────────────────────────────
echo ""
echo "🚀 Lanzando agentes por pantalla..."

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
