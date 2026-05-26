import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { TwView, TwText, TwScrollView, TwTextInput } from '@/lib/tw';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import {
  TransactionItemWithStatus,
  type StatusVariant,
  type ItemVariant,
} from '@/components/features/finance/transaction-item-with-status';
import { LabelSm } from '@/components/ui/typography';
import { FilterChipGroup } from '@/components/features/finance/filter-chips';
import { NeoTipCard } from '@/components/features/finance/neo-tip-card';
import type { SymbolViewProps } from 'expo-symbols';
import { useTheme } from '@/contexts/ThemeContext';

// TODO: replace with real API calls
// const { data } = useQuery({ queryKey: ['transactions'], queryFn: fetchTransactions })
// const { data: monthlyStats } = useQuery({ queryKey: ['monthly-stats'], queryFn: fetchMonthlyStats })

type FilterValue = 'all' | 'income' | 'expenses' | 'investment';

interface Transaction {
  id: string;
  merchant: string;
  category: string;
  time: string;
  amount: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  itemVariant: ItemVariant;
  symbolName: SymbolViewProps['name'];
}

interface TransactionGroup {
  id: string;
  dateLabel: string;
  transactions: Transaction[];
}

interface CategoryRow {
  id: string;
  label: string;
  percentage: string;
  dotColor: string;
}

const FILTER_OPTIONS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expenses', label: 'Gastos' },
  { value: 'investment', label: 'Inversiones' },
];

const MOCK_GROUPS: readonly TransactionGroup[] = [
  {
    id: 'today',
    dateLabel: 'Hoy, 24 de Octubre',
    transactions: [
      { id: 'tx1', merchant: 'Apple Store', category: 'Electrónica', time: '14:32', amount: '-$1,299.00', statusLabel: 'Completado', statusVariant: 'completado', itemVariant: 'expense', symbolName: 'cart.fill' },
      { id: 'tx2', merchant: 'Transferencia Recibida', category: 'De: Marcos Soler', time: '10:15', amount: '+$450.00', statusLabel: 'Vía SEPA', statusVariant: 'info', itemVariant: 'income', symbolName: 'banknote.fill' },
    ],
  },
  {
    id: 'yesterday',
    dateLabel: 'Ayer, 23 de Octubre',
    transactions: [
      { id: 'tx3', merchant: 'Sushi Zen Master', category: 'Restaurantes', time: '21:05', amount: '-$84.20', statusLabel: 'Pendiente', statusVariant: 'pendiente', itemVariant: 'pending', symbolName: 'fork.knife' },
      { id: 'tx4', merchant: 'Suscripción Netflix', category: 'Entretenimiento', time: '04:00', amount: '-$15.99', statusLabel: 'Fallida', statusVariant: 'fallida', itemVariant: 'failed', symbolName: 'exclamationmark.triangle.fill' },
    ],
  },
];

const POPULAR_CATEGORIES: readonly CategoryRow[] = [
  { id: 'tech', label: 'Tecnología', percentage: '45%', dotColor: '#00f5ff' },
  { id: 'food', label: 'Alimentación', percentage: '22%', dotColor: '#6c72cb' },
  { id: 'leisure', label: 'Ocio', percentage: '18%', dotColor: '#ffaedd' },
];

function matchesFilter(variant: ItemVariant, filter: FilterValue): boolean {
  if (filter === 'all') return true;
  if (filter === 'income') return variant === 'income';
  if (filter === 'expenses') return variant === 'expense' || variant === 'failed' || variant === 'pending';
  return false;
}

function matchesSearch(tx: Transaction, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return tx.merchant.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q);
}

export function HistoryScreen() {
  const { isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = MOCK_GROUPS.map((group) => ({
    ...group,
    transactions: group.transactions.filter(
      (tx) => matchesFilter(tx.itemVariant, activeFilter) && matchesSearch(tx, searchQuery),
    ),
  })).filter((group) => group.transactions.length > 0);

  const staggerDelays = new Map<string, number>();
  let baseDelay = 0;
  for (const group of filteredGroups) {
    for (const tx of group.transactions) {
      staggerDelays.set(tx.id, baseDelay);
      baseDelay += 60;
    }
  }

  const cardBg = isDark ? 'rgba(23, 31, 51, 0.70)' : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.07)';
  const textPrimary = isDark ? '#f8f9fa' : '#1a1b22';
  const textSecondary = isDark ? '#a0a0a0' : '#5c6370';
  const accentColor = isDark ? '#6c72cb' : '#00b8c0';
  const progressFill = isDark ? '#00f5ff' : '#006688';

  return (
    <TwView className="flex-1" style={{ backgroundColor: isDark ? '#12131a' : '#f8f9fa' }}>
      <TopAppBar title="Finnit" />

      <TwScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-5 pb-24"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page header */}
        <Animated.View entering={FadeInUp.duration(300)}>
          <TwText
            className={`text-[32px] font-bold mb-1 ${isDark ? 'text-on-background-dark' : 'text-on-background'}`}
            style={{ fontFamily: 'Ubuntu Bold' }}
          >
            Historial
          </TwText>
          <TwText
            className={`text-[14px] mb-6 ${isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}`}
            style={{ fontFamily: 'Ubuntu' }}
          >
            Revisa y filtra todos tus movimientos financieros en tiempo real.
          </TwText>
        </Animated.View>

        {/* Search bar */}
        <TwView
          className={`flex-row items-center rounded-[12px] border mb-4 px-4 ${isDark ? 'bg-surface-dark border-outline-dark' : 'bg-surface border-outline'}`}
          style={{ gap: 10, minHeight: 52 }}
          accessibilityRole="search"
        >
          <SymbolView name="magnifyingglass" size={18} tintColor={isDark ? '#a0a0a0' : '#9ba0a8'} accessibilityLabel="" />
          <TwTextInput
            className={`flex-1 py-3 text-[16px] ${isDark ? 'text-on-background-dark' : 'text-on-background'}`}
            style={{ fontFamily: 'Ubuntu' }}
            placeholder="Buscar transacción, comercio..."
            placeholderTextColor={isDark ? '#a0a0a0' : '#9ba0a8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Buscar transacciones por comercio o categoría"
            clearButtonMode="while-editing"
          />
        </TwView>

        {/* Filter chips */}
        <FilterChipGroup items={FILTER_OPTIONS} activeValue={activeFilter} onSelect={(v) => setActiveFilter(v as FilterValue)} className="mb-6" />

        {/* Transaction groups */}
        {filteredGroups.length === 0 ? (
          <TwView className="items-center justify-center py-16 gap-3">
            <SymbolView name="tray" size={44} tintColor={isDark ? '#5c6370' : '#c0c4cc'} accessibilityLabel="" />
            <TwText
              className={`text-[16px] ${isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}`}
              style={{ fontFamily: 'Ubuntu' }}
            >
              Sin resultados
            </TwText>
          </TwView>
        ) : (
          filteredGroups.map((group) => (
            <TwView key={group.id} className="mb-8">
              <LabelSm className="px-1 mb-3">{group.dateLabel}</LabelSm>
              <TwView className="gap-2">
                {group.transactions.map((tx) => (
                  <Animated.View key={tx.id} entering={FadeInUp.duration(280).delay(staggerDelays.get(tx.id) ?? 0)}>
                    <TransactionItemWithStatus
                      merchant={tx.merchant}
                      category={tx.category}
                      time={tx.time}
                      amount={tx.amount}
                      statusLabel={tx.statusLabel}
                      statusVariant={tx.statusVariant}
                      itemVariant={tx.itemVariant}
                      symbolName={tx.symbolName}
                    />
                  </Animated.View>
                ))}
              </TwView>
            </TwView>
          ))
        )}

        {/* Monthly spending card */}
        <Animated.View entering={FadeInUp.duration(350).delay(300)}>
          <TwView style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)', borderRadius: 24, padding: 24, marginBottom: 16, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: 16, top: 16, opacity: 0.07 }} pointerEvents="none">
              <SymbolView name="chart.bar.fill" size={80} tintColor="#a0a0a0" accessibilityLabel="" />
            </View>

            <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 16, color: accentColor, marginBottom: 12 }}>
              Gasto Mensual
            </TwText>

            <TwView className="flex-row items-end" style={{ gap: 4, marginBottom: 12 }}>
              <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 40, lineHeight: 48, color: textPrimary }}>$2,480</TwText>
              <TwText style={{ fontFamily: 'Ubuntu', fontSize: 20, lineHeight: 24, color: textSecondary, marginBottom: 4 }}>.50</TwText>
            </TwView>

            <TwView style={{ height: 6, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 9999, overflow: 'hidden', marginBottom: 10 }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: 75 }}>
              <TwView style={{ width: '75%', height: '100%', backgroundColor: progressFill, borderRadius: 9999, boxShadow: '0 0 8px rgba(0, 245, 255, 0.5)' }} />
            </TwView>

            <TwText style={{ fontFamily: 'Ubuntu', fontSize: 13, color: textSecondary }}>
              Has consumido el 75% de tu presupuesto.
            </TwText>
          </TwView>
        </Animated.View>

        {/* Finnit AI Tip */}
        <NeoTipCard
          title="Finnit AI"
          body='"Tus gastos en tecnología han subido un 12% este mes. Considera revisar tus suscripciones activas."'
          actionLabel="Ver Análisis"
        />

        {/* Popular categories */}
        <Animated.View entering={FadeInUp.duration(350).delay(500)}>
          <TwView style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder, boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)', borderRadius: 24, padding: 24, marginTop: 16, marginBottom: 8 }}>
            <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 16, color: textPrimary, marginBottom: 16 }}>
              Categorías Populares
            </TwText>

            {POPULAR_CATEGORIES.map((cat, idx) => (
              <TwView key={cat.id} className="flex-row items-center justify-between" style={{ marginBottom: idx < POPULAR_CATEGORIES.length - 1 ? 16 : 0 }}>
                <TwView className="flex-row items-center" style={{ gap: 12 }}>
                  <TwView style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: cat.dotColor }} />
                  <TwText style={{ fontFamily: 'Ubuntu', fontSize: 14, color: textPrimary }}>{cat.label}</TwText>
                </TwView>
                <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 12, letterSpacing: 0.5, color: textSecondary }}>
                  {cat.percentage}
                </TwText>
              </TwView>
            ))}
          </TwView>
        </Animated.View>
      </TwScrollView>

    </TwView>
  );
}
