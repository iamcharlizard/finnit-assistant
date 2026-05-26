import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { FadeIn, FadeInUp } from 'react-native-reanimated';

import { TwView, TwText, TwPressable, TwScrollView } from '@/lib/tw';
import { TwAnimatedView } from '@/lib/tw/animated';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import { BalanceCard } from '@/components/features/finance/balance-card';
import { QuickAction } from '@/components/features/finance/quick-action';
import {
  TransactionItemExpense,
  TransactionItemIncome,
} from '@/components/features/finance/transaction-item';
import { useTheme } from '@/contexts/ThemeContext';

// Neon S-curve line chart rendered as inline SVG — decorative, aria-hidden
const CHART_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">` +
  `<defs>` +
  `<linearGradient id="g" x1="0" x2="1" y1="0" y2="0">` +
  `<stop offset="0" stop-color="#00f0ff" stop-opacity="0.2"/>` +
  `<stop offset=".5" stop-color="#00f0ff" stop-opacity="1"/>` +
  `<stop offset="1" stop-color="#00f0ff" stop-opacity="0.5"/>` +
  `</linearGradient>` +
  `<filter id="f">` +
  `<feGaussianBlur stdDeviation="2" result="b"/>` +
  `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>` +
  `</filter>` +
  `</defs>` +
  `<path d="M0,60 Q50,52 100,65 T200,28 T300,45 T400,8" fill="none" stroke="url(#g)" stroke-width="3" filter="url(#f)"/>` +
  `<path d="M0,60 Q50,52 100,65 T200,28 T300,45 T400,8 L400,80 L0,80 Z" fill="#00f0ff" fill-opacity="0.05"/>` +
  `</svg>`
)}`;

// TODO: replace with real API calls
// const { data } = useQuery({ queryKey: ['summary', 'financials'], queryFn: fetchFinancialSummary })
// const { data: transactions } = useQuery({ queryKey: ['transactions', 'recent'], queryFn: fetchRecentTransactions })

interface FinancialSummaryData {
  balance: string;
  trend: string;
  trendPositive: boolean;
  monthlyIncome: string;
  monthlyExpenses: string;
}

interface TransactionData {
  id: string;
  merchant: string;
  category: string;
  time: string;
  amount: string;
  type: 'income' | 'expense';
  symbolName: SymbolViewProps['name'];
}

const MOCK_FINANCIAL_DATA: FinancialSummaryData = {
  balance: '$45,280.00',
  trend: '+2.4%',
  trendPositive: true,
  monthlyIncome: '$8,240.00',
  monthlyExpenses: '$3,960.00',
};

const RECENT_TRANSACTIONS: TransactionData[] = [
  {
    id: '1',
    merchant: 'Amazon Store',
    category: 'Compras',
    time: 'Hoy, 14:20',
    amount: '-$142.50',
    type: 'expense',
    symbolName: 'cart.fill',
  },
  {
    id: '2',
    merchant: 'La Parrilla Gourmet',
    category: 'Comida',
    time: 'Ayer, 21:05',
    amount: '-$85.00',
    type: 'expense',
    symbolName: 'fork.knife',
  },
  {
    id: '3',
    merchant: 'Depósito de Nómina',
    category: 'Ingresos',
    time: '15 Oct, 09:00',
    amount: '+$3,200.00',
    type: 'income',
    symbolName: 'arrow.down.circle.fill',
  },
  {
    id: '4',
    merchant: 'Iberia Airlines',
    category: 'Viajes',
    time: '12 Oct, 11:45',
    amount: '-$540.20',
    type: 'expense',
    symbolName: 'airplane',
  },
];

const QUICK_CATEGORIES: Array<{ label: string; symbolName: SymbolViewProps['name'] }> = [
  { label: 'Compras', symbolName: 'bag.fill' },
  { label: 'Comida', symbolName: 'fork.knife' },
  { label: 'Viajes', symbolName: 'airplane' },
  { label: 'Ocio', symbolName: 'film' },
  { label: 'Salud', symbolName: 'heart.fill' },
  { label: 'Más', symbolName: 'ellipsis' },
];

function SparklineChart({ isDark }: { isDark: boolean }) {
  const points = [12, 18, 15, 24, 20, 30, 26, 38, 34, 44, 40, 50, 46, 56, 52, 60, 56, 64, 60, 68];
  const lineColor = isDark ? '#6c72cb' : '#003ec7';

  return (
    <TwView style={{ height: 88, position: 'relative', paddingHorizontal: 4, paddingBottom: 4 }} accessibilityElementsHidden>
      <TwView
        style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          right: 4,
          height: '60%',
          borderRadius: 4,
          // @ts-ignore — experimental RN prop
          experimental_backgroundImage: isDark
            ? 'linear-gradient(to top, rgba(108,114,203,0.14), transparent)'
            : 'linear-gradient(to top, rgba(0,62,199,0.10), transparent)',
        }}
      />
      <TwView className="flex-row items-end justify-between" style={{ height: '100%' }}>
        {points.map((h, i) => (
          <TwView
            key={i}
            style={{
              width: 3,
              height: h,
              backgroundColor: lineColor,
              borderRadius: 2,
              opacity: 0.45 + (i / points.length) * 0.55,
            }}
          />
        ))}
      </TwView>
    </TwView>
  );
}

interface StatCardProps {
  variant: 'income' | 'expense';
  label: string;
  amount: string;
  isDark: boolean;
}

function StatCard({ variant, label, amount, isDark }: StatCardProps) {
  const isIncome = variant === 'income';
  const bgColor = isIncome ? '#006688' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)';
  const iconBg = isIncome ? 'rgba(255, 255, 255, 0.22)' : isDark ? 'rgba(186, 26, 26, 0.22)' : 'rgba(186, 26, 26, 0.08)';
  const iconColor = isIncome ? '#ffffff' : '#ba1a1a';
  const labelColor = isIncome ? 'rgba(255,255,255,0.78)' : isDark ? '#a0a0a0' : '#5c6370';
  const amountColor = isIncome ? '#ffffff' : isDark ? '#f8f9fa' : '#1a1b22';
  const symbolName: SymbolViewProps['name'] = isIncome ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill';

  return (
    <TwView
      className={`rounded-[24px] p-5 ${!isIncome ? (isDark ? 'border border-white/10' : 'border border-outline') : ''}`}
      style={{
        backgroundColor: bgColor,
        boxShadow: isIncome ? '0 4px 20px rgba(0,102,136,0.28)' : isDark ? '0 2px 12px rgba(0,0,0,0.2)' : '0 2px 12px rgba(0,0,0,0.04)',
      }}
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${amount}`}
    >
      <TwView className="flex-row items-center justify-between">
        <TwView className="flex-1 mr-3">
          <TwText className="text-[11px] uppercase tracking-widest mb-1.5" style={{ fontFamily: 'Ubuntu Medium', color: labelColor }} numberOfLines={2}>
            {label}
          </TwText>
          <TwText className="text-[22px] leading-[28px] font-bold" style={{ fontFamily: 'Ubuntu Bold', color: amountColor }}>
            {amount}
          </TwText>
        </TwView>
        <TwView className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: iconBg, flexShrink: 0 }}>
          <SymbolView name={symbolName} size={20} tintColor={iconColor} accessibilityLabel="" />
        </TwView>
      </TwView>
    </TwView>
  );
}

export function DashboardScreen() {
  const { isDark } = useTheme();
  const cardBg = isDark ? 'rgba(26, 27, 34, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDark ? 'border-white/10' : 'border-outline';
  const cardShadow = isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.05)';

  return (
    <TwView className={`flex-1 ${isDark ? 'bg-background-dark' : 'bg-background'}`}>
      <TopAppBar
        title="Finnit"
        notificationCount={2}
        onNotificationsPress={() => {}}
        onAvatarPress={() => {}}
      />

      <TwScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-5 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: Balance Card */}
        <TwAnimatedView entering={FadeIn.duration(400)} className="mb-4">
          <BalanceCard.Root>
            <BalanceCard.Header
              amount={MOCK_FINANCIAL_DATA.balance}
              trend={MOCK_FINANCIAL_DATA.trend}
              trendPositive={MOCK_FINANCIAL_DATA.trendPositive}
            />
            <BalanceCard.Chart>
              {isDark ? (
                <Image source={{ uri: CHART_URI }} style={{ width: '100%', height: '100%' }} contentFit="fill" accessibilityElementsHidden />
              ) : (
                <SparklineChart isDark={false} />
              )}
            </BalanceCard.Chart>
          </BalanceCard.Root>
        </TwAnimatedView>

        {/* Income / Expense Stat Cards */}
        <TwView className="gap-3 mb-6">
          <TwAnimatedView entering={FadeInUp.duration(400).delay(100)}>
            <StatCard variant="income" label="Ingresos Mensuales" amount={MOCK_FINANCIAL_DATA.monthlyIncome} isDark={isDark} />
          </TwAnimatedView>
          <TwAnimatedView entering={FadeInUp.duration(400).delay(160)}>
            <StatCard variant="expense" label="Gastos Mensuales" amount={MOCK_FINANCIAL_DATA.monthlyExpenses} isDark={isDark} />
          </TwAnimatedView>
        </TwView>

        {/* Quick Categories */}
        <TwAnimatedView entering={FadeInUp.duration(400).delay(220)} className="mb-6">
          <TwText
            className={`text-[18px] font-bold mb-4 px-1 ${isDark ? 'text-on-background-dark' : 'text-on-background'}`}
            style={{ fontFamily: 'Ubuntu Bold' }}
          >
            Categorías Rápidas
          </TwText>
          <TwView
            className={`rounded-[24px] p-4 border ${cardBorder}`}
            style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
          >
            <TwView className="flex-row mb-4">
              {QUICK_CATEGORIES.slice(0, 3).map((cat, i) => (
                <TwAnimatedView key={cat.label} entering={FadeInUp.duration(300).delay(260 + i * 50)} className="flex-1 items-center">
                  <QuickAction label={cat.label} symbolName={cat.symbolName} onPress={() => {}} accessibilityLabel={`Filtrar por ${cat.label}`} />
                </TwAnimatedView>
              ))}
            </TwView>
            <TwView className="flex-row">
              {QUICK_CATEGORIES.slice(3).map((cat, i) => (
                <TwAnimatedView key={cat.label} entering={FadeInUp.duration(300).delay(410 + i * 50)} className="flex-1 items-center">
                  <QuickAction label={cat.label} symbolName={cat.symbolName} onPress={() => {}} accessibilityLabel={`Filtrar por ${cat.label}`} />
                </TwAnimatedView>
              ))}
            </TwView>
          </TwView>
        </TwAnimatedView>

        {/* Recent Activity */}
        <TwAnimatedView entering={FadeInUp.duration(400).delay(320)}>
          <TwView className="flex-row justify-between items-center mb-4 px-1">
            <TwText
              className={`text-[18px] font-bold ${isDark ? 'text-on-background-dark' : 'text-on-background'}`}
              style={{ fontFamily: 'Ubuntu Bold' }}
            >
              Actividad Reciente
            </TwText>
            <TwPressable
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Ver todas las transacciones"
              style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}
            >
              <TwText className="text-[14px] font-medium" style={{ fontFamily: 'Ubuntu Medium', color: '#006688' }}>
                Ver todo
              </TwText>
            </TwPressable>
          </TwView>

          <TwView
            className={`rounded-[24px] overflow-hidden border ${cardBorder}`}
            style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
          >
            {RECENT_TRANSACTIONS.map((tx, i) => (
              <TwAnimatedView key={tx.id} entering={FadeInUp.duration(300).delay(380 + i * 60)}>
                {tx.type === 'income' ? (
                  <TransactionItemIncome
                    merchant={tx.merchant}
                    category={tx.category}
                    time={tx.time}
                    amount={tx.amount}
                    symbolName={tx.symbolName}
                    onPress={() => {}}
                  />
                ) : (
                  <TransactionItemExpense
                    merchant={tx.merchant}
                    category={tx.category}
                    time={tx.time}
                    amount={tx.amount}
                    symbolName={tx.symbolName}
                    onPress={() => {}}
                  />
                )}
                {i < RECENT_TRANSACTIONS.length - 1 ? (
                  <TwView className={`mx-4 ${isDark ? 'bg-outline-dark' : 'bg-outline'}`} style={{ height: 1, opacity: 0.4 }} />
                ) : null}
              </TwAnimatedView>
            ))}
          </TwView>
        </TwAnimatedView>
      </TwScrollView>

    </TwView>
  );
}
