import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { isNativeSupported, type Site } from '@finnit/bank-connect';

import { Input } from '@/components/ui/input';
import { TwPressable, TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { StepLayout } from './step-layout';

interface BankPickerStepProps {
  /** Banks matching a query (flow.search). */
  search: (query: string) => Site[];
  onSelect: (site: Site) => void;
}

export function BankPickerStep({ search, onSelect }: BankPickerStepProps) {
  const P = useBankConnectPalette();
  const [query, setQuery] = useState('');
  const banks = search(query);

  return (
    <StepLayout title="Elige tu banco" description="Busca la institución con la que quieres conectar Finnit.">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar banco"
        accessibilityLabel="Buscar banco"
        autoCorrect={false}
        autoCapitalize="none"
        autoComplete="off"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{ fontFamily: 'Ubuntu', minHeight: 44, color: P.onSurface, borderColor: P.outline }}
      />

      <TwView className="gap-2" accessibilityRole="list">
        {banks.length === 0 ? (
          <TwText className="text-center py-4" style={{ fontFamily: 'Ubuntu', fontSize: 14, color: P.onSurfaceVariant }}>
            No encontramos bancos con ese nombre.
          </TwText>
        ) : (
          banks.map((site) => {
            const native = isNativeSupported(site);
            return (
              <TwPressable
                key={site.id_site}
                onPress={() => onSelect(site)}
                className="flex-row items-center gap-3 px-3 rounded-xl active:opacity-70"
                style={{ minHeight: 52, backgroundColor: P.rowBg }}
                accessibilityRole="button"
                accessibilityLabel={native ? site.name : `${site.name}, requiere asistente`}
              >
                <SymbolView name="building.columns.fill" size={20} tintColor={P.primary} accessibilityLabel="" />
                <TwView className="flex-1 py-2">
                  <TwText style={{ fontFamily: 'Ubuntu', fontSize: 15, color: P.onSurface }}>{site.name}</TwText>
                  {!native ? (
                    <TwText style={{ fontFamily: 'Ubuntu', fontSize: 12, color: P.onSurfaceVariant, marginTop: 2 }}>
                      Requiere asistente
                    </TwText>
                  ) : null}
                </TwView>
                <SymbolView name="chevron.right" size={14} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
              </TwPressable>
            );
          })
        )}
      </TwView>
    </StepLayout>
  );
}
