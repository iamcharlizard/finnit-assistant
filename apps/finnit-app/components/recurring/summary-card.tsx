import type { LucideIcon } from 'lucide-react-native';

import { withAlpha } from '@finnit/ui-native/lib/color';
import { TwView } from '@finnit/ui-native/lib/tw';
import { Text } from '@finnit/ui-native/components/ui/text';

/** One figure of the period summary: label, amount and a short detail. */
export function SummaryCard({
  icon: Glyph,
  label,
  amount,
  detail,
  accent,
  width,
}: {
  icon: LucideIcon;
  label: string;
  amount: string;
  detail: string;
  accent: string;
  width: number;
}) {
  return (
    <TwView
      className="gap-2 rounded-card border p-4"
      style={{ width, backgroundColor: withAlpha(accent, 0.06), borderColor: withAlpha(accent, 0.22) }}
    >
      <TwView className="flex-row items-center gap-2">
        <TwView className="size-8 items-center justify-center rounded-[10px] bg-surface" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Glyph size={16} color={accent} />
        </TwView>
        <Text weight="bold" numberOfLines={1} className="flex-1 text-xs uppercase tracking-[0.08em] text-on-surface-variant">
          {label}
        </Text>
      </TwView>
      <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit className="text-2xl" style={{ fontVariant: ['tabular-nums'] }}>
        {amount}
      </Text>
      <Text className="text-xs text-on-surface-variant">{detail}</Text>
    </TwView>
  );
}
