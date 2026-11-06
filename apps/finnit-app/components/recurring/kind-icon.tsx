import { ICON_COLORS } from '@finnit/core/finance/categories';
import { recurringKindIcon } from '@finnit/core/finance/payments';
import type { RecurringKind } from '@finnit/core/finance/types';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { TwView } from '@finnit/ui-native/lib/tw';

/** The kind of a recurring expense as a colored icon tile. */
export function KindIcon({ kind }: { kind: RecurringKind }) {
  const key = recurringKindIcon(kind);
  const Glyph = CATEGORY_ICONS[key];
  return (
    <TwView className="size-10 shrink-0 items-center justify-center rounded-chip" style={{ backgroundColor: ICON_COLORS[key] }}>
      <Glyph size={20} color="#ffffff" />
    </TwView>
  );
}
