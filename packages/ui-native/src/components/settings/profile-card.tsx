import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useAppTheme, useToken } from '../../theme/theme-root';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

/** The user's photo, name and email (@finnit/ui's ProfileCard). */
function ProfileCard({
  name,
  email,
  avatarSource,
  onEditPress,
  editLabel = 'Edit profile',
  className,
}: {
  name: string;
  email: string;
  avatarSource?: { uri: string; headers?: Record<string, string> } | null;
  onEditPress?: () => void;
  editLabel?: string;
  className?: string;
}) {
  const { scheme } = useAppTheme();
  const highlight = useToken('--highlight');
  const tertiary = useToken('--tertiary');
  return (
    <TwView
      className={cn('items-center overflow-hidden rounded-card border border-glass-border bg-glass p-5', className)}
      style={{ boxShadow: scheme === 'dark' ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.06)' }}
    >
      <TwView className="mb-4 mt-2 size-24 items-center justify-center">
        <Svg width={96} height={96} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#6c72cb" />
              <Stop offset="0.5" stopColor={highlight} />
              <Stop offset="1" stopColor={tertiary} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={96} height={96} rx={48} fill="url(#ring)" />
        </Svg>
        <Avatar name={name} source={avatarSource} size={90} className="bg-surface" />
      </TwView>
      <Text weight="bold" className="text-center text-xl">
        {name}
      </Text>
      <Text className="mb-3 text-center text-sm text-on-surface-variant">{email}</Text>
      {onEditPress ? <Button variant="outline" size="sm" label={editLabel} onPress={onEditPress} /> : null}
    </TwView>
  );
}

export { ProfileCard };
