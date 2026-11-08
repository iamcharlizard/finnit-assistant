import { useState } from 'react';
import {
  ArrowRight,
  CircleArrowDown,
  CircleArrowUp,
  House,
  List,
  Plus,
  Wallet,
} from 'lucide-react-native';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_THEMES, isAppTheme } from '@finnit/core/theme/app-theme';
import { TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { ThemeRoot } from '@finnit/ui-native/theme/theme-root';
import { BottomNavBar } from '@finnit/ui-native/components/navigation/bottom-nav-bar';
import { Badge } from '@finnit/ui-native/components/ui/badge';
import { Button } from '@finnit/ui-native/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finnit/ui-native/components/ui/card';
import { GlassSurface } from '@finnit/ui-native/components/ui/glass-surface';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { LogoSpinner } from '@finnit/ui-native/components/ui/logo-spinner';
import { MoneyInput } from '@finnit/ui-native/components/ui/money-input';
import { Progress } from '@finnit/ui-native/components/ui/progress';
import { Segmented } from '@finnit/ui-native/components/ui/segmented';
import { Text } from '@finnit/ui-native/components/ui/text';
import {
  HeadlineLg,
  LabelSm,
} from '@finnit/ui-native/components/ui/typography';

/**
 * Development only: the shared components in the four palettes at once
 * (light or dark follows the simulator). Open finnitapp://dev/theme-preview,
 * or ?theme=glass for one palette; ?bar=1 adds the bottom bar on top.
 */
export default function ThemePreview() {
  const insets = useSafeAreaInsets();
  const { theme: only, bar } = useLocalSearchParams<{
    theme?: string;
    bar?: string;
  }>();
  const themes = isAppTheme(only) ? [only] : APP_THEMES;
  const [amount, setAmount] = useState('1250000.5');
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  if (!__DEV__) return null;
  const noop = () => {};
  return (
    <View style={{ flex: 1 }}>
      <TwScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        {themes.map((theme) => (
          <TwView key={theme} style={{ height: isAppTheme(only) ? 900 : 640 }}>
            <ThemeRoot theme={theme}>
              <TwView className="gap-3 p-4">
                <LabelSm>{theme}</LabelSm>
                <HeadlineLg>$ 12,480.50</HeadlineLg>
                <Card>
                  <CardHeader>
                    <TwView className="flex-1 gap-1">
                      <CardTitle>Cuenta de nómina</CardTitle>
                      <CardDescription>BBVA ·· 4821</CardDescription>
                    </TwView>
                    <Icon icon={Wallet} color="--brand-ink" />
                  </CardHeader>
                  <TwView className="flex-row flex-wrap gap-2">
                    <Badge label="Ingreso" variant="income" />
                    <Badge label="Gasto" variant="expense" />
                    <Badge label="Marca" variant="brand" />
                    <Badge label="Neutro" variant="muted" />
                  </TwView>
                  <Text className="text-income">+ $ 1,250.00</Text>
                </Card>
                <TwView className="flex-row flex-wrap gap-2">
                  <Button
                    label="Guardar"
                    trailing={
                      <Icon
                        icon={ArrowRight}
                        size={16}
                        color="--primary-foreground"
                      />
                    }
                  />
                  <Button label="Nuevo" variant="secondary" icon={Plus} />
                  <Button label="Cancelar" variant="outline" />
                  <Button
                    label="Agregar"
                    variant="ghost"
                    size="icon"
                    icon={Plus}
                  />
                </TwView>
                <MoneyInput
                  label="Monto"
                  value={amount}
                  onValueChange={setAmount}
                />
                <Segmented
                  options={[
                    { value: 'month', label: 'Mes' },
                    { value: 'year', label: 'Año' },
                  ]}
                  value={period}
                  onValueChange={setPeriod}
                />
                <Progress value={62} />
                <TwView className="items-center">
                  <LogoSpinner size={40} />
                </TwView>
                <GlassSurface className="h-16 flex-row items-center justify-around rounded-full">
                  <Text weight="medium">Inicio</Text>
                  <Text weight="medium" className="text-on-surface-variant">
                    Movimientos
                  </Text>
                </GlassSurface>
              </TwView>
            </ThemeRoot>
          </TwView>
        ))}
      </TwScrollView>
      {bar ? (
        <BottomNavBar
          label="Navegación"
          tabs={[
            {
              key: 'home',
              label: 'Inicio',
              icon: House,
              active: true,
              onPress: noop,
            },
            {
              key: 'history',
              label: 'Movimientos',
              icon: List,
              active: false,
              onPress: noop,
            },
            {
              key: 'accounts',
              label: 'Cuentas',
              icon: Wallet,
              active: false,
              onPress: noop,
            },
          ]}
          more={{ label: 'Más', active: false, onPress: noop }}
          addLabel="Nuevo movimiento"
          closeLabel="Cerrar"
          actions={[
            {
              key: 'expense',
              label: 'Gasto',
              icon: CircleArrowUp,
              tone: '--expense',
              onPress: noop,
            },
            {
              key: 'income',
              label: 'Ingreso',
              icon: CircleArrowDown,
              tone: '--income',
              onPress: noop,
            },
          ]}
        />
      ) : null}
    </View>
  );
}
