import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PencilLine } from 'lucide-react';

/** "¿Tu banco no aparece? Agrégala manualmente" → the manual account wizard. */
export async function ManualAccountLink() {
  const t = await getTranslations('accounts.manualLink');
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center text-sm text-on-surface-variant">
      {t('question')}
      <Link
        href="/accounts?add=1"
        className="inline-flex min-h-11 items-center gap-1 font-medium text-brand-ink underline-offset-4 hover:underline"
      >
        <PencilLine aria-hidden className="size-4" />
        {t('action')}
      </Link>
    </p>
  );
}
