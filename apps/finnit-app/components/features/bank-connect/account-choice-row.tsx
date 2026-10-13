import { SymbolView } from 'expo-symbols';
import type { ConnectedAccount } from '@finnit/bank-connect';

import { TwText, TwView } from '@/lib/tw';
import { bankAccountTypeLabel, finnitAccountTypeLabel, formatMoney } from '@/lib/bank-connect/format';
import type { FinnitAccount } from '@/lib/graphql/queries/bank-connect';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { OptionPicker } from './option-picker';

export type AccountChoiceMode = 'create' | 'existing' | 'skip';

interface AccountChoiceRowProps {
  account: ConnectedAccount;
  mode: AccountChoiceMode;
  existingId: string | undefined;
  finnitAccounts: FinnitAccount[];
  /** Finnit accounts are still loading. */
  loadingAccounts: boolean;
  onChangeMode: (mode: AccountChoiceMode) => void;
  onChangeExisting: (accountId: string) => void;
  error?: string;
}

/** A bank account and what it should import into. */
export function AccountChoiceRow({
  account,
  mode,
  existingId,
  finnitAccounts,
  loadingAccounts,
  onChangeMode,
  onChangeExisting,
  error,
}: AccountChoiceRowProps) {
  const P = useBankConnectPalette();
  const name = account.name || bankAccountTypeLabel(account.type);
  const subtitle = [bankAccountTypeLabel(account.type), account.mask ? `•••• ${account.mask}` : null]
    .filter(Boolean)
    .join(' · ');
  const alreadyLinked = Boolean(account.accountId);

  return (
    <TwView className="rounded-2xl p-4 gap-3" style={{ backgroundColor: P.rowBg }}>
      <TwView className="flex-row items-start gap-3">
        <SymbolView
          name={account.type === 'Credit Card' ? 'creditcard.fill' : 'banknote.fill'}
          size={22}
          tintColor={P.primary}
          accessibilityLabel=""
        />
        <TwView className="flex-1">
          <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 16, color: P.onSurface }}>{name}</TwText>
          <TwText style={{ fontFamily: 'Ubuntu', fontSize: 13, color: P.onSurfaceVariant, marginTop: 2 }}>{subtitle}</TwText>
        </TwView>
        <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 15, color: P.onSurface }}>
          {formatMoney(account.balance, account.currency)}
        </TwText>
      </TwView>

      {alreadyLinked ? (
        <TwView className="flex-row items-center gap-2">
          <SymbolView name="checkmark.circle.fill" size={16} tintColor={P.success} accessibilityLabel="" />
          <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 14, color: P.success }}>Ya ligada</TwText>
        </TwView>
      ) : (
        <>
          <OptionPicker
            label={`¿Qué hacemos con ${name}?`}
            value={mode}
            onChange={(value) => onChangeMode(value as AccountChoiceMode)}
            options={[
              { value: 'create', label: 'Crear cuenta en Finnit' },
              {
                value: 'existing',
                label: 'Ligar a una cuenta existente',
                detail: loadingAccounts
                  ? 'Cargando tus cuentas…'
                  : finnitAccounts.length === 0
                    ? 'Aún no tienes cuentas en Finnit'
                    : undefined,
                disabled: loadingAccounts || finnitAccounts.length === 0,
              },
              { value: 'skip', label: 'No importar' },
            ]}
          />
          {mode === 'existing' ? (
            <OptionPicker
              label="Cuenta de Finnit"
              value={existingId}
              onChange={onChangeExisting}
              options={finnitAccounts.map((a) => ({
                value: a.id,
                label: a.name,
                detail: finnitAccountTypeLabel(a.type),
              }))}
              error={error}
            />
          ) : null}
        </>
      )}
    </TwView>
  );
}
