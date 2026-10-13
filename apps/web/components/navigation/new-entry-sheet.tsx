'use client';

import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  type LucideIcon,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';

const CHOICES: ReadonlyArray<{
  key: 'expense' | 'income' | 'transfer';
  icon: LucideIcon;
}> = [
  { key: 'expense', icon: CircleArrowUp },
  { key: 'income', icon: CircleArrowDown },
  { key: 'transfer', icon: ArrowLeftRight },
];

/**
 * "Nuevo movimiento" from the "+" buttons. Placeholder: the three kinds are
 * shown but disabled until the create flow lands (phase 2).
 */
export function NewEntrySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        closeLabel={t('common.close')}
        className="mx-auto w-full max-w-lg px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:bottom-6 lg:rounded-card lg:border"
      >
        <div className="pr-12">
          <SheetTitle>{t('newEntry.title')}</SheetTitle>
          <SheetDescription>{t('newEntry.description')}</SheetDescription>
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {CHOICES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <button
                type="button"
                disabled
                aria-describedby={`new-entry-${key}-soon`}
                className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded-xl bg-track p-3 text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon aria-hidden className="size-6" />
                <span className="text-sm font-medium text-on-background">
                  {t(`newEntry.${key}`)}
                </span>
                <span id={`new-entry-${key}-soon`} className="text-[11px]">
                  {t('common.comingSoon')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
