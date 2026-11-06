import type * as React from 'react';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useAppTheme, useColor } from '../../theme/theme-root';
import { Text } from '../ui/text';

/** A group of settings with its title (@finnit/ui's SettingsSection). */
function SettingsSection({
  title,
  icon: Glyph,
  iconColor,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { scheme } = useAppTheme();
  const color = useColor()(iconColor);
  return (
    <TwView
      className={cn('gap-3 rounded-card border border-glass-border bg-glass p-4', className)}
      style={{ boxShadow: scheme === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.06)' }}
    >
      <TwView className="mb-1 flex-row items-center gap-3">
        <Glyph size={20} color={color} />
        <Text accessibilityRole="header" weight="bold" className="text-base">
          {title}
        </Text>
      </TwView>
      {children}
    </TwView>
  );
}

export { SettingsSection };
