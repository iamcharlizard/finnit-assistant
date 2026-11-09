import * as React from 'react';
import { useRouter } from 'expo-router';
import { useTranslations } from 'use-intl';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react-native';

import {
  needsPinToShow,
  parseHideAmounts,
  parsePinSuggestionDismissed,
  shouldSuggestPin,
} from '@finnit/core/privacy/amounts';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

import { PrivacyPinSheet } from '@/components/settings/privacy-pin-sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useOnPrivacyUnlocked } from '@/lib/privacy/events';
import { readItem, writeItem } from '@/lib/session/storage';

interface AmountsVisibility {
  hidden: boolean;
  /** Hides, or shows (asking the PIN when there is one and it's locked). */
  toggle: () => void;
}

const AmountsContext = React.createContext<AmountsVisibility>({
  hidden: false,
  toggle: () => {},
});

/**
 * "Ocultar montos" on this device (the web's AmountsVisibilityProvider):
 * kept in secure storage. Showing them asks the privacy PIN when the user
 * has one and it isn't unlocked (the privacy-unlock sheet); hiding them
 * without a PIN suggests creating one, unless the user said not to.
 */
export function AmountsVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const t = useTranslations('dashboard.amounts');
  const tc = useTranslations('common');
  const [hidden, setHidden] = React.useState(() =>
    parseHideAmounts(readItem('hideAmounts')),
  );
  const [dismissed, setDismissed] = React.useState(() =>
    parsePinSuggestionDismissed(readItem('pinSuggestion')),
  );
  const [sheet, setSheet] = React.useState<'suggest' | 'createPin' | null>(
    null,
  );
  // Waiting for the PIN to show the amounts.
  const [awaitingUnlock, setAwaitingUnlock] = React.useState(false);

  const save = React.useCallback((next: boolean) => {
    setHidden(next);
    void writeItem('hideAmounts', next ? '1' : '0');
  }, []);

  // The unlock sheet announces a right PIN.
  useOnPrivacyUnlocked(() => {
    if (!awaitingUnlock) return;
    setAwaitingUnlock(false);
    save(false);
  });

  const toggle = React.useCallback(() => {
    if (!hidden) {
      save(true);
      if (shouldSuggestPin(user?.privacy, dismissed)) setSheet('suggest');
    } else if (needsPinToShow(user?.privacy)) {
      setAwaitingUnlock(true);
      router.push('/privacy-unlock');
    } else {
      save(false);
    }
  }, [hidden, dismissed, user?.privacy, save, router]);

  const value = React.useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return (
    <AmountsContext value={value}>
      {children}
      {sheet === 'suggest' ? (
        <Sheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          title={t('suggestTitle')}
          closeLabel={tc('close')}
        >
          <TwView className="gap-4">
            <TwView className="flex-row items-start gap-3">
              <Icon icon={ShieldCheck} size={22} color="--income" />
              <Text className="flex-1 text-sm text-on-surface-variant">
                {t('suggestDescription')}
              </Text>
            </TwView>
            <TwView className="gap-2">
              <Button
                label={t('suggestCreate')}
                onPress={() => setSheet('createPin')}
              />
              <Button
                variant="outline"
                label={t('suggestLater')}
                onPress={() => setSheet(null)}
              />
              <Button
                variant="ghost"
                label={t('suggestNever')}
                onPress={() => {
                  setSheet(null);
                  setDismissed(true);
                  void writeItem('pinSuggestion', 'off');
                }}
              />
            </TwView>
          </TwView>
        </Sheet>
      ) : null}
      {sheet === 'createPin' ? (
        <PrivacyPinSheet
          hasPin={false}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            void refreshUser();
          }}
        />
      ) : null}
    </AmountsContext>
  );
}

export function useAmountsVisibility(): AmountsVisibility {
  return React.use(AmountsContext);
}

/** The eye that hides or shows every amount on the home screen. */
export function AmountsToggle() {
  const { hidden, toggle } = useAmountsVisibility();
  const t = useTranslations('dashboard.amounts');
  return (
    <TwPressable
      accessibilityRole="button"
      accessibilityLabel={hidden ? t('show') : t('hide')}
      accessibilityState={{ selected: hidden }}
      hitSlop={8}
      onPress={toggle}
      className="size-10 items-center justify-center rounded-full bg-surface-60"
    >
      <Icon
        icon={hidden ? EyeOff : Eye}
        size={20}
        color="--on-surface-variant"
      />
    </TwPressable>
  );
}
