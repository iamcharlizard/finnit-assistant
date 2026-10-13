import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';

const POINTS: { symbolName: SymbolViewProps['name']; text: string }[] = [
  {
    symbolName: 'link',
    text: 'Finnit usa Syncfy, un proveedor especializado, para conectarse con tu banco.',
  },
  {
    symbolName: 'lock.fill',
    text: 'Tu usuario y contraseña del banco viajan directamente de tu dispositivo a Syncfy. Finnit nunca los ve ni los guarda.',
  },
  {
    symbolName: 'checklist',
    text: 'Finnit solo guarda las cuentas, saldos y movimientos que tú elijas ligar.',
  },
  {
    symbolName: 'xmark.circle',
    text: 'Puedes desconectar tu banco cuando quieras.',
  },
];

interface ConsentStepProps {
  onAccept: () => void;
  onCancel: () => void;
}

export function ConsentStep({ onAccept, onCancel }: ConsentStepProps) {
  const P = useBankConnectPalette();

  return (
    <StepLayout
      title="Conecta tu banco de forma segura"
      description="Antes de empezar, esto es lo que pasa con tus datos:"
      symbolName="lock.shield.fill"
      iconColor={P.success}
      footer={
        <>
          <FlowButton label="Aceptar y continuar" onPress={onAccept} />
          <FlowButton label="Cancelar" variant="ghost" onPress={onCancel} />
        </>
      }
    >
      <TwView className="gap-3">
        {POINTS.map((point) => (
          <TwView key={point.text} className="flex-row gap-3 items-start">
            <SymbolView name={point.symbolName} size={18} tintColor={P.primary} accessibilityLabel="" />
            <TwText className="flex-1" style={{ fontFamily: 'Ubuntu', fontSize: 15, lineHeight: 22, color: P.onSurface }}>
              {point.text}
            </TwText>
          </TwView>
        ))}
      </TwView>
    </StepLayout>
  );
}
