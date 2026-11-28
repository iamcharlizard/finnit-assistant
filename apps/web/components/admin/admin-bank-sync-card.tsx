'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@finnit/ui/components/ui/card';
import { Switch } from '@finnit/ui/components/ui/switch';
import {
  dayKeyOf,
  longDate,
  timeOf,
  todayKey,
} from '@finnit/core/finance/dates';
import type { Locale } from '@finnit/core/i18n/locales';

import {
  UPDATE_GLOBAL_SETTINGS_MUTATION,
  type GlobalSettings,
} from '@/lib/admin/global-settings';
import { adminErrorMessage } from '@/lib/admin/errors';
import { gql } from '@/lib/graphql/client';

/** "27 de noviembre, 19:40" in Mexico City, the same on server and browser. */
function changedAt(iso: string, locale: Locale): string {
  const time = timeOf(iso);
  const date = longDate(dayKeyOf(iso), todayKey(), locale);
  return time ? `${date}, ${time}` : date;
}

/** "Configuración global" → bank sync: one switch for every user. */
export function AdminBankSyncCard({ initial }: { initial: GlobalSettings }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [settings, setSettings] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(bankSyncEnabled: boolean) {
    setSaving(true);
    setError(null);
    try {
      const data = await gql<{ updateGlobalSettings: GlobalSettings }>(
        UPDATE_GLOBAL_SETTINGS_MUTATION,
        { input: { bankSyncEnabled } },
      );
      setSettings(data.updateGlobalSettings);
    } catch (e) {
      setError(adminErrorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  const on = settings.bankSyncEnabled;
  const updated = settings.updatedAt
    ? changedAt(settings.updatedAt, locale)
    : null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('admin.banks.cardTitle')}</CardTitle>
          <CardDescription>{t('admin.banks.cardDescription')}</CardDescription>
        </div>
      </CardHeader>

      <div className="flex flex-col gap-3 rounded-xl bg-track p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <label
              htmlFor="bank-sync-enabled"
              className="font-medium text-on-background"
            >
              {t('admin.banks.switchLabel')}
            </label>
            <Badge variant={on ? 'success' : 'expense'}>
              {on ? t('admin.banks.on') : t('admin.banks.off')}
            </Badge>
          </div>
          <Switch
            id="bank-sync-enabled"
            checked={on}
            disabled={saving}
            onCheckedChange={(value) => void save(value)}
          />
        </div>

        {!on ? (
          <p className="flex gap-2 text-[13px] text-on-surface-variant">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('admin.banks.offNotice')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] text-expense">
            {error}
          </p>
        ) : null}
        {updated ? (
          <p className="text-[12px] text-on-surface-variant">
            {settings.updatedByName
              ? t('admin.banks.lastChange', {
                  date: updated,
                  name: settings.updatedByName,
                })
              : t('admin.banks.lastChangeNoName', { date: updated })}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
