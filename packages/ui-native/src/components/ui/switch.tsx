import { Switch as RNSwitch } from 'react-native';

import { useToken } from '../../theme/theme-root';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** The platform switch in the theme's accent (onCheckedChange like the web). */
function Switch({ checked, onCheckedChange, disabled, accessibilityLabel }: SwitchProps) {
  const accent = useToken('--accent-neon');
  const track = useToken('--track');
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ true: accent, false: track }}
      ios_backgroundColor={track}
    />
  );
}

export { Switch, type SwitchProps };
