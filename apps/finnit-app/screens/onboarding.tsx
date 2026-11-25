import * as React from 'react';
import {
  FlatList,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslations } from 'use-intl';
import {
  CalendarDays,
  Landmark,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

import { TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

import { markOnboardingSeen, requestTour } from '@/lib/onboarding/onboarding';

interface Slide {
  key: 'welcome' | 'money' | 'calendar' | 'privacy';
  icon: LucideIcon;
  /** Icon color and its tinted circle. */
  tone: `--${string}`;
  circle: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: Sparkles,
    tone: '--brand-ink',
    circle: 'bg-brand-ink-10',
  },
  { key: 'money', icon: Landmark, tone: '--income', circle: 'bg-income-10' },
  {
    key: 'calendar',
    icon: CalendarDays,
    tone: '--violet-ink',
    circle: 'bg-violet-ink-10',
  },
  {
    key: 'privacy',
    icon: ShieldCheck,
    tone: '--highlight',
    circle: 'bg-highlight-10',
  },
];

/** How long the modal takes to close before the tour starts over the tabs. */
const DISMISS_DELAY = 450;

/**
 * First-run welcome: four slides about what Finnit does, then the choice
 * of a guided tour over the real screens. Seen once per device (also
 * when skipped); Ajustes can show it again.
 */
export function OnboardingScreen() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const list = React.useRef<FlatList<Slide>>(null);
  const [index, setIndex] = React.useState(0);
  const last = index === SLIDES.length - 1;

  const close = (tour: boolean) => {
    void markOnboardingSeen();
    if (router.canGoBack()) router.back();
    else router.replace('/dashboard');
    if (tour) setTimeout(requestTour, DISMISS_DELAY);
  };

  const goTo = (next: number) => {
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <TwView
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
    >
      <TwView className="h-14 flex-row items-center justify-end px-4">
        {last ? null : (
          <Button
            variant="ghost"
            size="sm"
            label={t('skip')}
            onPress={() => close(false)}
          />
        )}
      </TwView>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(slide) => slide.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <TwView
            style={{ width }}
            className="flex-1 items-center justify-center gap-8 px-8"
          >
            <TwView
              className={`size-32 items-center justify-center rounded-full ${item.circle}`}
            >
              <Icon icon={item.icon} size={60} color={item.tone} />
            </TwView>
            <TwView className="gap-3">
              <Text
                accessibilityRole="header"
                weight="bold"
                className="text-center text-[28px]"
                style={{ lineHeight: 36 }}
              >
                {t(`slides.${item.key}.title`)}
              </Text>
              <Text
                className="text-center text-base text-on-surface-variant"
                style={{ lineHeight: 24 }}
              >
                {t(`slides.${item.key}.body`)}
              </Text>
            </TwView>
          </TwView>
        )}
      />

      <TwView className="gap-6 px-6 pt-4">
        <TwView
          className="flex-row justify-center gap-2"
          accessibilityLabel={t('stepOf', {
            current: index + 1,
            total: SLIDES.length,
          })}
        >
          {SLIDES.map((slide, i) => (
            <TwView
              key={slide.key}
              className={
                i === index
                  ? 'h-2 w-6 rounded-full bg-brand-ink'
                  : 'size-2 rounded-full bg-outline'
              }
            />
          ))}
        </TwView>
        {last ? (
          <TwView className="gap-2">
            <Button
              size="lg"
              label={t('startTour')}
              onPress={() => close(true)}
            />
            <Button
              variant="ghost"
              label={t('notNow')}
              onPress={() => close(false)}
            />
          </TwView>
        ) : (
          // Equal halves: react-native-css's flex-1 keeps a content basis,
          // so each button sits in a flex: 1 cell.
          <TwView className="flex-row gap-3">
            {index > 0 ? (
              <TwView style={{ flex: 1 }}>
                <Button
                  variant="outline"
                  size="lg"
                  label={t('back')}
                  className="w-full"
                  onPress={() => goTo(index - 1)}
                />
              </TwView>
            ) : null}
            <TwView style={{ flex: 1 }}>
              <Button
                size="lg"
                label={t('next')}
                className="w-full"
                onPress={() => goTo(index + 1)}
              />
            </TwView>
          </TwView>
        )}
      </TwView>
    </TwView>
  );
}
