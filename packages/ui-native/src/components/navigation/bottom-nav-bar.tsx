import * as React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ellipsis, Plus, type LucideIcon } from 'lucide-react-native';

import { TwPressable, TwView } from '../../lib/tw';
import { useElevation, useToken } from '../../theme/theme-root';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

/*
 * Geometry, the same as the web's AppBottomNav on phones: 56px round tabs,
 * a 72px slot under the "+", 8px gaps, 8px padding and a 1px border. The
 * "+" is as big as a tab, its center 2px below the bar's top, and the bar
 * has a round notch around it (6px gap, 8px fillets where it meets the
 * top edge).
 */
const TAB = 56;
const SLOT = 72;
const GAP = 8;
const PAD = 8;
const NOTCH_GAP = 6;
const HOLE_CY = 2;
const FILLET = 8;

const WIDTHS = [TAB, TAB, SLOT, TAB, TAB];
const SLOT_LEFT = WIDTHS.map((_, i) => WIDTHS.slice(0, i).reduce((s, w) => s + w, 0) + i * GAP);
const BAR_WIDTH = WIDTHS.reduce((s, w) => s + w, 0) + 4 * GAP + 2 * PAD + 2;
const BAR_HEIGHT = TAB + 2 * PAD + 2;

/** Space the bar takes at the bottom (without the safe area): screens pad their content by it. */
export const BOTTOM_NAV_SPACE = BAR_HEIGHT + 12 + 16;

const EASE = Easing.bezier(0.32, 0.72, 0, 1);

/**
 * The bar's outline: a pill with the notch bitten out of its top edge,
 * inset by `o` (half the stroke) so the 1px border is not clipped. The
 * offset is in the coordinates (no x/y props on the Path, which Android
 * renderers have placed differently).
 */
function barPath(width: number, height: number, o = 0.5): string {
  const w = width - 2 * o;
  const h = height - 2 * o;
  const r = h / 2;
  const cx = o + w / 2;
  const top = o;
  const holeR = TAB / 2 + NOTCH_GAP;
  const reach = holeR + FILLET;
  const dx = Math.sqrt(reach ** 2 - (FILLET - HOLE_CY) ** 2);
  const hx = (dx * holeR) / reach;
  const hy = top + HOLE_CY + ((FILLET - HOLE_CY) * holeR) / reach;
  const n = (v: number) => v.toFixed(3);
  return [
    `M${n(o + r)} ${n(top)}`,
    `H${n(cx - dx)}`,
    `A${FILLET} ${FILLET} 0 0 1 ${n(cx - hx)} ${n(hy)}`,
    `A${holeR} ${holeR} 0 0 0 ${n(cx + hx)} ${n(hy)}`,
    `A${FILLET} ${FILLET} 0 0 1 ${n(cx + dx)} ${n(top)}`,
    `H${n(o + w - r)}`,
    `A${r} ${r} 0 0 1 ${n(o + w - r)} ${n(o + h)}`,
    `H${n(o + r)}`,
    `A${r} ${r} 0 0 1 ${n(o + r)} ${n(top)}`,
    'Z',
  ].join(' ');
}

const BAR_PATH = barPath(BAR_WIDTH, BAR_HEIGHT);
/** Room kept on each side of the bar when the screen is narrow. */
const SIDE_ROOM = 8;

/*
 * The "+" menu: five shortcuts in a wide, flat arc above the button. `k`
 * is the horizontal step (a share of the screen, at most 104px) and `y`
 * the height above the button's center; the outer ones sit lower.
 */
const ARC = [
  { k: -2, y: -76 },
  { k: -1, y: -124 },
  { k: 0, y: -144 },
  { k: 1, y: -124 },
  { k: 2, y: -76 },
];

export interface BottomNavTab {
  key: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}

export interface BottomNavAction {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Icon color token, e.g. '--expense'. */
  tone: `--${string}`;
  onPress: () => void;
}

interface BottomNavBarProps {
  /** Three tabs: two before the "+", one after. */
  tabs: [BottomNavTab, BottomNavTab, BottomNavTab];
  more: { label: string; active: boolean; onPress: () => void };
  /** The "+" shortcuts (up to five, in the arc's order). */
  actions: BottomNavAction[];
  addLabel: string;
  closeLabel: string;
  /** For screen readers: the bar's name. */
  label: string;
}

/**
 * @finnit/ui's AppBottomNav for React Native: a floating solid pill with
 * three tabs and "Más", and a round "+" that sticks out of its middle and
 * fans out the shortcuts. A highlight slides under the active tab.
 * Render it over the screens (it fills the screen with `box-none`, so the
 * backdrop can dim everything while the menu is open).
 */
export function BottomNavBar({ tabs, more, actions, addLabel, closeLabel, label }: BottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [open, setOpen] = React.useState(false);
  // Solid (not translucent): --popover is opaque in every palette.
  const fill = useToken('--popover');
  const glassBorder = useToken('--glass-border');
  const elevation = useElevation();
  const step = Math.min(screenWidth * 0.18, 104);
  // Narrow screens (or a large display size): shrink the whole bar to fit.
  const scale = Math.min(1, (screenWidth - 2 * SIDE_ROOM) / BAR_WIDTH);

  const slots = [tabs[0], tabs[1], null, tabs[2]];
  const tabSlot = slots.findIndex((tab) => tab?.active);
  const activeSlot = tabSlot >= 0 ? tabSlot : more.active ? 4 : -1;

  const highlightX = useDerivedValue(() =>
    withTiming(SLOT_LEFT[Math.max(0, activeSlot)]!, { duration: 300, easing: EASE }),
  );
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highlightX.value }],
    opacity: withTiming(activeSlot < 0 ? 0 : 1, { duration: 200 }),
  }));
  const progress = useDerivedValue(() => withTiming(open ? 1 : 0, { duration: 300, easing: EASE }));
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 135}deg` }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const tab = (item: BottomNavTab) => (
    <TwPressable
      key={item.key}
      accessibilityRole="tab"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.active }}
      onPress={() => {
        setOpen(false);
        item.onPress();
      }}
      className="size-14 items-center justify-center rounded-full active:scale-90"
    >
      <Icon icon={item.icon} size={28} color={item.active ? '--brand-ink' : '--on-surface-variant'} />
    </TwPressable>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dims the screen behind the shortcuts; a tap closes them. */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={closeLabel}
          onPress={() => setOpen(false)}
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        accessibilityLabel={label}
        style={[
          styles.bar,
          {
            bottom: Math.max(12, insets.bottom) - (BAR_HEIGHT * (1 - scale)) / 2,
            left: (screenWidth - BAR_WIDTH) / 2,
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.shadow, elevation]} pointerEvents="none" />
        <Svg
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          viewBox={`0 0 ${BAR_WIDTH} ${BAR_HEIGHT}`}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Path d={BAR_PATH} fill={fill} stroke={glassBorder} strokeWidth={1} />
        </Svg>
        <TwView className="flex-1 flex-row items-center p-2" style={{ gap: GAP, margin: 1 }}>
          <Animated.View pointerEvents="none" style={[styles.highlight, highlightStyle]}>
            <TwView className="size-14 rounded-full bg-primary-15 dark:bg-primary-20" />
          </Animated.View>
          {tab(tabs[0])}
          {tab(tabs[1])}
          <View style={{ width: SLOT }} />
          {tab(tabs[2])}
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={more.label}
            onPress={() => {
              setOpen(false);
              more.onPress();
            }}
            className="size-14 items-center justify-center rounded-full active:scale-90"
          >
            <Icon icon={Ellipsis} size={28} color={more.active ? '--brand-ink' : '--on-surface-variant'} />
          </TwPressable>
        </TwView>

        {/* The "+" and its shortcuts, centered on the bar's top edge. */}
        <View pointerEvents="box-none" style={styles.anchor}>
          {actions.slice(0, ARC.length).map((action, index) => (
            <DialAction
              key={action.key}
              action={action}
              index={index}
              count={actions.length}
              open={open}
              x={ARC[index]!.k * step}
              y={ARC[index]!.y}
              onPress={() => {
                setOpen(false);
                action.onPress();
              }}
            />
          ))}
          <TwPressable
            accessibilityRole="button"
            accessibilityLabel={open ? closeLabel : addLabel}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen((value) => !value)}
            className="absolute size-14 items-center justify-center rounded-full bg-primary active:scale-90"
            style={styles.fab}
          >
            <Animated.View style={plusStyle}>
              <Icon icon={Plus} size={28} color="--primary-foreground" />
            </Animated.View>
          </TwPressable>
        </View>
      </View>
    </View>
  );
}

function DialAction({
  action,
  index,
  count,
  open,
  x,
  y,
  onPress,
}: {
  action: BottomNavAction;
  index: number;
  count: number;
  open: boolean;
  x: number;
  y: number;
  onPress: () => void;
}) {
  const elevation = useElevation();
  // Out one after another; back in the reverse order.
  const delay = open ? index * 40 : (count - 1 - index) * 25;
  const shown = useDerivedValue(() =>
    withDelay(delay, withTiming(open ? 1 : 0, { duration: 300, easing: EASE })),
  );
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: x * shown.value },
      { translateY: y * shown.value },
      { scale: 0.3 + 0.7 * shown.value },
    ],
  }));
  return (
    <Animated.View pointerEvents={open ? 'box-none' : 'none'} style={[styles.action, style]}>
      <TwPressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={onPress}
        className="items-center gap-1.5 active:scale-90"
      >
        <TwView
          className="size-14 items-center justify-center rounded-full border border-glass-border bg-surface"
          style={elevation}
        >
          <Icon icon={action.icon} size={28} color={action.tone} />
        </TwView>
        <TwView className="rounded-full bg-surface px-2 py-0.5 shadow-sm">
          <Text weight="medium" numberOfLines={1} className="text-[11px] text-on-background">
            {action.label}
          </Text>
        </TwView>
      </TwPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  bar: { position: 'absolute' },
  shadow: { borderRadius: BAR_HEIGHT / 2 },
  highlight: { position: 'absolute', left: PAD, top: PAD },
  anchor: { position: 'absolute', top: 0, left: '50%', width: 0, height: 0 },
  fab: { top: HOLE_CY - TAB / 2, left: -TAB / 2, boxShadow: '0 2px 8px rgba(0,0,0,0.16)' },
  action: { position: 'absolute', top: -28, left: -56, width: 112, alignItems: 'center' },
});
