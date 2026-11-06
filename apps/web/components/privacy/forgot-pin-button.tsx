'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@finnit/ui/components/ui/toaster';

import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

const REQUEST_RESET_MUTATION = `mutation RequestPrivacyPinReset { requestPrivacyPinReset }`;

/** "Olvidé mi PIN": emails a link to choose a new one. */
export function ForgotPinButton() {
  const t = useTranslations('privacy.forgot');
  const { t: translate } = useLocalizer();
  const [sending, setSending] = React.useState(false);

  function send() {
    setSending(true);
    gql(REQUEST_RESET_MUTATION)
      .then(() => toast.success(t('sent'), { description: t('sentHint') }))
      .catch((e: unknown) => toast.error(requestErrorMessage(e, translate)))
      .finally(() => setSending(false));
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="self-start px-1 text-sm font-medium text-brand-ink underline-offset-4 hover:underline disabled:opacity-50"
    >
      {sending ? t('sending') : t('button')}
    </button>
  );
}
