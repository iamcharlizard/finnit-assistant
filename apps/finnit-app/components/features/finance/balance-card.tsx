import { createContext, use } from 'react';
import { useColorScheme } from 'nativewind';
import { TwView, TwText } from '../../../lib/tw';

// --- Context ---

interface BalanceCardContextValue {
  isDark: boolean;
}

const BalanceCardContext = createContext<BalanceCardContextValue>({ isDark: false });

// --- Root ---

interface RootProps {
  children: React.ReactNode;
}

function Root({ children }: RootProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <BalanceCardContext value={{ isDark }}>
      <TwView
        className={`rounded-[24px] p-6 ${
          isDark ? 'border border-white/10' : 'border border-outline'
        }`}
        style={{
          // NW-FALLBACK: rgba + glassmorphism via inline style
          backgroundColor: isDark
            ? 'rgba(26, 27, 34, 0.9)'
            : 'rgba(255, 255, 255, 0.85)',
          boxShadow: isDark
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(0,0,0,0.06)',
        }}
        accessibilityRole="summary"
      >
        {children}
      </TwView>
    </BalanceCardContext>
  );
}

// --- Header ---

interface HeaderProps {
  label?: string;
  amount: string;
  trend?: string;
  trendPositive?: boolean;
}

function Header({ label = 'BALANCE TOTAL', amount, trend, trendPositive = true }: HeaderProps) {
  const { isDark } = use(BalanceCardContext);

  return (
    <TwView className="mb-4">
      <TwText
        className={`text-[12px] uppercase tracking-widest mb-1 ${
          isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'
        }`}
        style={{ fontFamily: 'Ubuntu Medium' }}
      >
        {label}
      </TwText>

      <TwText
        className={`text-[36px] leading-[44px] font-bold ${
          isDark ? 'text-on-background-dark' : 'text-on-background'
        }`}
        style={{ fontFamily: 'Ubuntu Bold' }}
        accessibilityRole="text"
        accessibilityLabel={`${label} ${amount}`}
      >
        {amount}
      </TwText>

      {trend ? (
        <TwView className="flex-row items-center mt-1 gap-1">
          <TwText
            className={`text-[14px] font-medium ${
              trendPositive ? 'text-income' : 'text-expense'
            }`}
            style={{ fontFamily: 'Ubuntu Medium' }}
          >
            {trend}
          </TwText>
          <TwText
            className={`text-[12px] ${isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}`}
            style={{ fontFamily: 'Ubuntu' }}
          >
            este mes
          </TwText>
        </TwView>
      ) : null}
    </TwView>
  );
}

// --- Chart (placeholder, wire up react-native-svg separately) ---

interface ChartProps {
  children?: React.ReactNode;
}

function Chart({ children }: ChartProps) {
  const { isDark } = use(BalanceCardContext);

  return (
    <TwView
      className={`rounded-[12px] overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
      style={{ height: 80 }}
      accessibilityElementsHidden
    >
      {children}
    </TwView>
  );
}

// --- Footer ---

interface FooterProps {
  children: React.ReactNode;
}

function Footer({ children }: FooterProps) {
  return (
    <TwView className="flex-row items-center justify-between mt-4 pt-4">
      {children}
    </TwView>
  );
}

// --- Compound export ---

export const BalanceCard = { Root, Header, Chart, Footer };
