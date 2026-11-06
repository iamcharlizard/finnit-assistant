import type { IconKey } from '@finnit/core/finance/categories';
import { CATEGORY_ICONS } from '@finnit/ui-native/lib/category-icons';
import { withAlpha } from '@finnit/ui-native/lib/color';
import { TwView } from '@finnit/ui-native/lib/tw';
import { useColor } from '@finnit/ui-native/theme/theme-root';

/** A category's icon on a tile of its color. */
export function CategoryTile({ iconKey, color, size = 40 }: { iconKey: IconKey; color: string; size?: number }) {
  const resolved = useColor()(color);
  const Glyph = CATEGORY_ICONS[iconKey];
  return (
    <TwView
      importantForAccessibility="no"
      className="shrink-0 items-center justify-center rounded-chip"
      style={{ width: size, height: size, backgroundColor: withAlpha(resolved, 0.16) }}
    >
      <Glyph size={20} color={resolved} />
    </TwView>
  );
}
