import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import type { FieldValues, FlowStep, Site } from '@finnit/bank-connect';

import { TwScrollView, TwView } from '@/lib/tw';
import { useBankConnectFlow } from '@/hooks/use-bank-connect-flow';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { BankPickerStep } from '@/components/features/bank-connect/bank-picker-step';
import { ConnectBankHeader } from '@/components/features/bank-connect/connect-bank-header';
import { ConsentStep } from '@/components/features/bank-connect/consent-step';
import { CredentialsStep } from '@/components/features/bank-connect/credentials-step';
import { DoneStep } from '@/components/features/bank-connect/done-step';
import { ErrorStep } from '@/components/features/bank-connect/error-step';
import { LinkAccountsStep } from '@/components/features/bank-connect/link-accounts-step';
import { NeedsWidgetStep } from '@/components/features/bank-connect/needs-widget-step';
import { ProgressStep } from '@/components/features/bank-connect/progress-step';
import { TwofaStep } from '@/components/features/bank-connect/twofa-step';

/** Non-secret login values kept in memory to prefill the form after a failed attempt. */
type RememberedLogin = { siteId: string; values: Record<string, string> };

/**
 * "Conectar banco": renders the steps of the shared BankConnectFlow.
 * Bank credentials stay in component state (memory only) and go from the
 * device straight to Syncfy. Leaving the screen discards them and cancels
 * any ongoing login.
 */
export function ConnectBankScreen() {
  const P = useBankConnectPalette();
  const { flow, step } = useBankConnectFlow();
  const [remembered, setRemembered] = useState<RememberedLogin | null>(null);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  function selectBank(site: Site) {
    setRemembered(null);
    flow.selectBank(site);
  }

  function changeBank() {
    setRemembered(null);
    flow.back();
  }

  function submitCredentials(site: Site, values: FieldValues) {
    // Keep only non-password values (e.g. the username) to prefill a retry.
    const keep: Record<string, string> = {};
    for (const field of site.credentials) {
      const value = values[field.name];
      if (field.type !== 'password' && value !== undefined) keep[field.name] = String(value);
    }
    setRemembered({ siteId: site.id_site, values: keep });
    void flow.submitCredentials(values);
  }

  function renderStep(current: FlowStep) {
    switch (current.name) {
      case 'consent':
        return <ConsentStep onAccept={() => void flow.acceptConsent()} onCancel={leave} />;
      case 'loading':
        return <ProgressStep message={current.message} />;
      case 'pickBank':
        return <BankPickerStep search={(query) => flow.search(query)} onSelect={selectBank} />;
      case 'credentials':
        return (
          <CredentialsStep
            key={current.site.id_site}
            site={current.site}
            errors={current.errors}
            message={current.message}
            initialValues={remembered?.siteId === current.site.id_site ? remembered.values : undefined}
            onSubmit={(values) => submitCredentials(current.site, values)}
            onChangeBank={changeBank}
          />
        );
      case 'connecting':
        return <ProgressStep title={current.site.name} message={current.status.message} />;
      case 'twofa':
        return (
          <TwofaStep
            site={current.site}
            fields={current.fields}
            errors={current.errors}
            onSubmit={(values) => flow.submitTwofa(values)}
          />
        );
      case 'linkAccounts':
        return (
          <LinkAccountsStep
            bank={current.bank}
            message={current.message}
            onSubmit={(choices) => void flow.linkAccounts(choices)}
          />
        );
      case 'done':
        return (
          <DoneStep
            institution={current.bank.institution}
            linked={current.linked}
            onFinish={() => router.replace('/settings')}
          />
        );
      case 'needsWidget':
        return (
          <NeedsWidgetStep
            siteName={current.site.name}
            startedLogin={Boolean(current.idCredential)}
            onPickAnother={changeBank}
            onClose={leave}
          />
        );
      case 'error':
        return (
          <ErrorStep message={current.message} canRetry={current.canRetry} onRetry={() => flow.back()} onClose={leave} />
        );
    }
  }

  return (
    <TwView className="flex-1" style={{ backgroundColor: P.bg }}>
      <ConnectBankHeader onClose={leave} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TwScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-5 pb-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep(step)}
        </TwScrollView>
      </KeyboardAvoidingView>
    </TwView>
  );
}
