import * as React from 'react';
import {
  View,
  type HostInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { TourRegistryContext } from './tour-context';

interface TourTargetProps {
  /** The id tour steps point at. */
  id: string;
  /**
   * Off while the screen isn't the one shown (tabs stay mounted): two
   * targets with the same id must not compete.
   */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Marks what a tour step highlights. Outside a `TourProvider` it is a
 * plain wrapper, so shared components can always use it.
 */
export function TourTarget({
  id,
  enabled = true,
  style,
  children,
}: TourTargetProps) {
  const registry = React.useContext(TourRegistryContext);
  const ref = React.useRef<HostInstance>(null);

  React.useEffect(() => {
    if (!registry || !enabled) return;
    return registry.register(id, ref);
  }, [registry, id, enabled]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={style}
      onLayout={registry && enabled ? () => registry.relayout(id) : undefined}
    >
      {children}
    </View>
  );
}
