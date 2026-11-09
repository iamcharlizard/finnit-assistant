'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@finnit/ui/lib/utils';

import { PrivacyPinDialog } from '@/components/privacy/privacy-pin-dialog';
import { PrivacyUnlockDialog } from '@/components/privacy/privacy-unlock-dialog';
import { SuggestPinDialog } from '@/components/privacy/suggest-pin-dialog';
import { useSessionUser } from '@/components/session-provider';
import {
  HIDE_AMOUNTS_COOKIE,
  PIN_SUGGESTION_COOKIE,
  needsPinToShow,
  shouldSuggestPin,
} from '@finnit/core/privacy/amounts';
import { preferenceCookie } from '@finnit/core/theme/app-theme';

interface AmountsVisibility {
  hidden: boolean;
  /** Hides, or shows (asking the PIN when there is one and it's locked). */
  toggle: () => void;
}

const AmountsContext = React.createContext<AmountsVisibility>({
  hidden: false,
  toggle: () => {},
});

type Dialog = 'unlock' | 'suggest' | 'createPin' | null;

/**
 * "Ocultar montos" for this browser. Starts from the cookies the server
 * read (no flash of amounts). Showing them asks the privacy PIN when the
 * user has one and it isn't unlocked; hiding them without a PIN suggests
 * creating one, unless the user said not to ask again.
 */
export function AmountsVisibilityProvider({
  initialHidden,
  suggestionDismissed: initialDismissed,
  children,
}: {
  initialHidden: boolean;
  suggestionDismissed: boolean;
  children: React.ReactNode;
}) {
  const user = useSessionUser();
  const t = useTranslations('dashboard.amounts');
  const [hidden, setHidden] = React.useState(initialHidden);
  const [dismissed, setDismissed] = React.useState(initialDismissed);
  const [dialog, setDialog] = React.useState<Dialog>(null);

  const save = React.useCallback((next: boolean) => {
    setHidden(next);
    document.cookie = preferenceCookie(HIDE_AMOUNTS_COOKIE, next ? '1' : '0');
  }, []);

  const toggle = React.useCallback(() => {
    if (!hidden) {
      save(true);
      if (shouldSuggestPin(user.privacy, dismissed)) setDialog('suggest');
    } else if (needsPinToShow(user.privacy)) {
      setDialog('unlock');
    } else {
      save(false);
    }
  }, [hidden, dismissed, user.privacy, save]);

  const value = React.useMemo(() => ({ hidden, toggle }), [hidden, toggle]);
  const close = () => setDialog(null);

  return (
    <AmountsContext value={value}>
      {children}
      {dialog === 'unlock' ? (
        <PrivacyUnlockDialog
          reason={t('unlockReason')}
          onClose={close}
          onUnlocked={() => {
            close();
            save(false);
          }}
        />
      ) : null}
      {dialog === 'suggest' ? (
        <SuggestPinDialog
          onCreate={() => setDialog('createPin')}
          onLater={close}
          onNever={() => {
            close();
            setDismissed(true);
            document.cookie = preferenceCookie(PIN_SUGGESTION_COOKIE, 'off');
          }}
        />
      ) : null}
      {dialog === 'createPin' ? (
        <PrivacyPinDialog hasPin={false} onClose={close} onSaved={close} />
      ) : null}
    </AmountsContext>
  );
}

export function useAmountsVisibility(): AmountsVisibility {
  return React.use(AmountsContext);
}

/** The eye button that hides or shows the amounts. */
export function AmountsToggle({ className }: { className?: string }) {
  const { hidden, toggle } = useAmountsVisibility();
  const t = useTranslations('dashboard.amounts');
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={(event) => {
        // It may sit on a card that is a link.
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      aria-label={hidden ? t('show') : t('hide')}
      aria-pressed={hidden}
      className={cn(
        'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none transition-colors hover:bg-accent hover:text-on-background focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
