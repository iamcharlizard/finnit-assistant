'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import { SelectField } from '@/components/recurring/select-field';
import { REPROCESS_PARSERS, type ReprocessParser } from '@/lib/statements/api';

/** "Reprocesar" with the parser to read with: automático, Banamex or IA. */
export function ReprocessControl({
  busy,
  onReprocess,
}: {
  busy: boolean;
  onReprocess: (parser: ReprocessParser) => void;
}) {
  const t = useTranslations('statements');
  const [parser, setParser] = React.useState<ReprocessParser>('auto');
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="sm:w-56">
        <SelectField
          label={t('reprocessWith')}
          value={parser}
          options={REPROCESS_PARSERS.map((value) => ({
            value,
            label: t(`parsers.${value}`),
          }))}
          onChange={setParser}
          disabled={busy}
        />
      </div>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => onReprocess(parser)}
      >
        <RefreshCw aria-hidden /> {t('reprocess')}
      </Button>
    </div>
  );
}
