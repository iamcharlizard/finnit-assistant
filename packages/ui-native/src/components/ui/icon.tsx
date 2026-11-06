import type { LucideIcon } from 'lucide-react-native';

import { useToken } from '../../theme/theme-root';

interface IconProps {
  icon: LucideIcon;
  /** Size in px (the web's size-4 = 16, size-5 = 20). */
  size?: number;
  /** A design token for the color, like the web's text-* class on the svg. */
  color?: `--${string}`;
  strokeWidth?: number;
}

/** A lucide icon colored with a theme token (icons don't take classes). */
function Icon({ icon: Glyph, size = 20, color = '--on-background', strokeWidth = 2 }: IconProps) {
  return <Glyph size={size} color={useToken(color)} strokeWidth={strokeWidth} />;
}

export { Icon, type IconProps };
