# Finnit Component Code Implementation Guide

Esta guía proporciona implementaciones de ejemplo para los componentes clave de Finnit, diseñadas para ser utilizadas tanto en **React Native (Expo)** como en **Next.js (Tailwind CSS)** mediante un enfoque de diseño atómico y tokens compartidos.

---

## 1. BalanceCard (Tarjeta de Balance)

Este componente utiliza los tokens de `surface` y `primary` definidos en la especificación.

### React Native (Tailwind / NativeWind)

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';

interface BalanceCardProps {
  totalBalance: string;
  percentageChange: string;
  // chartData omitido por brevedad
}

export const BalanceCard = ({
  totalBalance,
  percentageChange,
}: BalanceCardProps) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`p-6 rounded-[32px] ${isDark ? 'bg-[#1a1b22] border border-white/10' : 'bg-white shadow-sm'}`}
    >
      <Text
        className={`font-ubuntu text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
      >
        BALANCE TOTAL
      </Text>
      <Text
        className={`font-ubuntu-bold text-3xl mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        {totalBalance}
      </Text>
      <View className="flex-row items-center">
        <Text className="text-primary font-ubuntu-medium mr-2">
          {percentageChange}
        </Text>
        <Text
          className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-xs`}
        >
          este mes
        </Text>
      </View>
      {/* Implementar Gráfico Lineal con react-native-svg o similar */}
    </View>
  );
};
```

---

## 2. QuickAction (Acción Rápida)

Botones circulares con iconos para la navegación rápida.

### React Native / Next.js (Mapeo de Estilos)

```tsx
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Para Expo

interface QuickActionProps {
  label: string;
  iconName: string;
  onPress: () => void;
  theme: 'light' | 'dark';
}

export const QuickAction = ({
  label,
  iconName,
  onPress,
  theme,
}: QuickActionProps) => {
  const isDark = theme === 'dark';
  const bgColor = isDark
    ? 'rgba(108, 114, 203, 0.2)'
    : 'rgba(0, 245, 255, 0.1)';
  const iconColor = isDark ? '#6c72cb' : '#00f5ff';

  return (
    <TouchableOpacity onPress={onPress} className="items-center mr-4">
      <View
        style={{ backgroundColor: bgColor }}
        className="w-14 h-14 rounded-full justify-center items-center mb-2"
      >
        <MaterialIcons name={iconName} size={24} color={iconColor} />
      </View>
      <Text
        className={`text-xs font-ubuntu ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
```

---

## 3. TransactionItem (Actividad Reciente)

Fila detallada para transacciones.

### Next.js (Tailwind CSS)

```tsx
import React from 'react';

interface TransactionProps {
  merchant: string;
  category: string;
  amount: number;
  date: string;
  icon: React.ReactNode;
}

export const TransactionItem = ({
  merchant,
  category,
  amount,
  date,
  icon,
}: TransactionProps) => {
  const isPositive = amount > 0;

  return (
    <div className="flex items-center justify-between p-4 mb-2 bg-transparent border-b border-gray-100 dark:border-white/5">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-50 dark:bg-[#1a1b22]">
          {icon}
        </div>
        <div>
          <h4 className="font-ubuntu font-medium text-gray-900 dark:text-white">
            {merchant}
          </h4>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {date} • {category}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span
          className={`font-ubuntu font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}
        >
          {isPositive ? '+' : ''}
          {amount.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
          })}
        </span>
      </div>
    </div>
  );
};
```

---

## 4. Estilos Globales (Tailwind Config)

Para asegurar que los tokens se apliquen correctamente en Next.js.

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#00f5ff', // Finnit Light
        'primary-dark': '#6c72cb', // Finnit Dark
        surface: {
          light: '#ffffff',
          dark: '#1a1b22',
        },
        'accent-neon': '#6c72cb',
      },
      fontFamily: {
        ubuntu: ['Ubuntu', 'sans-serif'],
      },
    },
  },
};
```

## Sugerencia de Estructura de Archivos

```
/components
  /ui
    Button.tsx
    Input.tsx
    Typography.tsx
  /finance
    BalanceCard.tsx
    TransactionItem.tsx
    QuickAction.tsx
  /navigation
    BottomNavBar.tsx
    TopAppBar.tsx
```

Esta estructura te permitirá mantener la lógica de negocio separada de la presentación y aplicar los tokens de `Finnit Unified Design Spec` de forma centralizada.
