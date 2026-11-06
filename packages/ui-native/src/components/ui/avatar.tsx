import { Image } from 'react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from './text';

interface AvatarProps {
  /** Photo URL (with its own auth headers when it needs them). */
  source?: { uri: string; headers?: Record<string, string> } | null;
  /** Shown when there's no photo: the first letters of the name. */
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function Avatar({ source, name, size = 40, className }: AvatarProps) {
  return (
    <TwView
      accessibilityLabel={name}
      className={cn('items-center justify-center overflow-hidden rounded-full bg-accent-neon-15', className)}
      style={{ width: size, height: size }}
    >
      {source ? (
        <Image source={source} style={{ width: size, height: size }} />
      ) : (
        <Text weight="bold" className="text-violet-ink" style={{ fontSize: size * 0.38 }}>
          {initials(name)}
        </Text>
      )}
    </TwView>
  );
}

export { Avatar, type AvatarProps };
