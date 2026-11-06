'use client';

import { useTranslations } from 'next-intl';
import { GlassCard } from '@finnit/ui/components/ui/glass-card';

import { useBankConnectFlow } from '@/hooks/use-bank-connect-flow';
import { BankPickerStep } from './bank-picker-step';
import { ConsentStep } from './consent-step';
import { CredentialsStep } from './credentials-step';
import { DoneStep } from './done-step';
import { ErrorStep } from './error-step';
import { LinkAccountsStep } from './link-accounts-step';
import { ProgressStep } from './progress-step';
import { TwofaStep } from './twofa-step';
import { WidgetFallbackStep } from './widget-fallback-step';

/** "Conectar banco" page: the steps on a card. */
export function ConnectBankFlow() {
  return (
    <GlassCard className="mx-auto w-full max-w-2xl rounded-card p-6 sm:p-8">
      <ConnectBankSteps />
    </GlassCard>
  );
}

/**
 * The current step of the shared BankConnectFlow. On a page by default; in
 * a dialog, `onCancel` / `onClose` replace the links back to the banks page.
 * Unmounting cancels a connection in progress.
 */
export function ConnectBankSteps({
  onCancel,
  onClose,
}: {
  /** "Cancelar" before starting (e.g. back to the account choice). */
  onCancel?: () => void;
  /** "Cerrar" after an error, or "Listo" once connected. */
  onClose?: () => void;
} = {}) {
  const { flow, step } = useBankConnectFlow();
  const t = useTranslations('bankConnect');

  let content: React.ReactNode;
  switch (step.name) {
    case 'consent':
      content = (
        <ConsentStep
          onAccept={() => void flow.acceptConsent()}
          onCancel={onCancel}
        />
      );
      break;
    case 'loading':
      content = <ProgressStep message={step.message} />;
      break;
    case 'pickBank':
      content = (
        <BankPickerStep
          search={(query) => flow.search(query)}
          onSelect={(site) => flow.selectBank(site)}
        />
      );
      break;
    case 'credentials':
      content = (
        <CredentialsStep
          key={step.site.id_site}
          site={step.site}
          errors={step.errors}
          message={step.message}
          onSubmit={(values) => void flow.submitCredentials(values)}
          onBack={() => flow.back()}
        />
      );
      break;
    case 'connecting':
      content = (
        <ProgressStep
          message={step.status.message}
          hint={t('connectingHint')}
        />
      );
      break;
    case 'twofa':
      content = (
        <TwofaStep
          key={step.fields.map((f) => f.name).join()}
          site={step.site}
          fields={step.fields}
          errors={step.errors}
          onSubmit={(values) => flow.submitTwofa(values)}
        />
      );
      break;
    case 'needsWidget':
      content = (
        <WidgetFallbackStep
          site={step.site}
          idCredential={step.idCredential}
          token={step.token}
          widgetScriptUrl={step.widgetScriptUrl}
          widgetStylesheetUrl={step.widgetStylesheetUrl}
          onConnected={(id) => void flow.completeWithWidget(id)}
          onBack={() => flow.back()}
        />
      );
      break;
    case 'linkAccounts':
      content = (
        <LinkAccountsStep
          bank={step.bank}
          message={step.message}
          onSubmit={(choices) => void flow.linkAccounts(choices)}
        />
      );
      break;
    case 'done':
      content = (
        <DoneStep bank={step.bank} linked={step.linked} onClose={onClose} />
      );
      break;
    case 'error':
      content = (
        <ErrorStep
          message={step.message}
          canRetry={step.canRetry}
          onRetry={() => flow.back()}
          onClose={onClose}
        />
      );
      break;
  }

  return content;
}
