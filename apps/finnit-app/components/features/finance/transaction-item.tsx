import { TwView, TwText, TwPressable } from '../../../lib/tw';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useColorScheme } from 'nativewind';

type SymbolName = SymbolViewProps['name'];

interface TransactionBaseProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  symbolName: SymbolName;
  amountColor: string;
  iconBg: string;
  onPress?: () => void;
}

function TransactionBase({
  merchant,
  category,
  time,
  amount,
  symbolName,
  onPress,
  amountColor,
  iconBg,
}: TransactionBaseProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TwPressable
      className={`flex-row items-center justify-between p-4 rounded-[16px] ${
        isDark ? 'bg-surface-dark' : 'bg-surface'
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${merchant}, ${amount}, ${category}`}
      style={{ minHeight: 44 }}
    >
      <TwView className="flex-row items-center gap-4 flex-1">
        <TwView
          className="w-12 h-12 rounded-[12px] items-center justify-center"
          style={{ backgroundColor: iconBg }}
        >
          <SymbolView
            name={symbolName}
            size={22}
            tintColor={isDark ? '#a0a0a0' : '#5c6370'}
            accessibilityLabel=""
          />
        </TwView>

        <TwView className="flex-1">
          <TwText
            className={`text-[14px] font-medium ${isDark ? 'text-on-background-dark' : 'text-on-background'}`}
            style={{ fontFamily: 'Ubuntu Medium' }}
          >
            {merchant}
          </TwText>
          <TwText
            className={`text-[12px] mt-0.5 ${isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}`}
            style={{ fontFamily: 'Ubuntu' }}
          >
            {category} · {time}
          </TwText>
        </TwView>
      </TwView>

      <TwText
        className={`text-[14px] font-bold ${amountColor}`}
        style={{ fontFamily: 'Ubuntu Bold' }}
        accessibilityRole="text"
      >
        {amount}
      </TwText>
    </TwPressable>
  );
}

// --- Public variant types ---

type VariantProps = Omit<TransactionBaseProps, 'amountColor' | 'iconBg'>;

interface TransactionIncomeProps extends Omit<VariantProps, 'symbolName'> {
  symbolName?: SymbolName;
}

interface TransactionExpenseProps extends Omit<VariantProps, 'symbolName'> {
  symbolName?: SymbolName;
}

interface TransactionPendingProps extends Omit<VariantProps, 'symbolName'> {
  symbolName?: SymbolName;
}

// --- Exported variants ---

export function TransactionItemIncome({ symbolName = 'arrow.down.circle.fill', ...props }: TransactionIncomeProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TransactionBase
      {...props}
      symbolName={symbolName}
      amountColor="text-income"
      iconBg={isDark ? 'rgba(0, 102, 136, 0.2)' : 'rgba(0, 102, 136, 0.1)'}
    />
  );
}

export function TransactionItemExpense({ symbolName = 'cart.fill', ...props }: TransactionExpenseProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TransactionBase
      {...props}
      symbolName={symbolName}
      amountColor="text-expense"
      iconBg={isDark ? 'rgba(186, 26, 26, 0.15)' : 'rgba(186, 26, 26, 0.08)'}
    />
  );
}

export function TransactionItemPending({ symbolName = 'clock.fill', ...props }: TransactionPendingProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TransactionBase
      {...props}
      symbolName={symbolName}
      amountColor={isDark ? 'text-on-surface-variant-dark' : 'text-on-surface-variant'}
      iconBg={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
    />
  );
}
