'use client';

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

/** "Conectar banco": renders the current step of the shared BankConnectFlow. */
export function ConnectBankFlow() {
  const { flow, step } = useBankConnectFlow();

  let content: React.ReactNode;
  switch (step.name) {
    case 'consent':
      content = <ConsentStep onAccept={() => void flow.acceptConsent()} />;
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
          hint="Esto puede tardar hasta un minuto. No cierres esta página."
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
      content = <DoneStep bank={step.bank} linked={step.linked} />;
      break;
    case 'error':
      content = (
        <ErrorStep
          message={step.message}
          canRetry={step.canRetry}
          onRetry={() => flow.back()}
        />
      );
      break;
  }

  return (
    <GlassCard className="mx-auto w-full max-w-2xl rounded-card p-6 sm:p-8">
      {content}
    </GlassCard>
  );
}
