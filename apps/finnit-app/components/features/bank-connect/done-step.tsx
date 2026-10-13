import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';

interface DoneStepProps {
  institution: string | null | undefined;
  linked: number;
  onFinish: () => void;
}

export function DoneStep({ institution, linked, onFinish }: DoneStepProps) {
  const P = useBankConnectPalette();

  return (
    <StepLayout
      title="¡Banco conectado!"
      description={`Listo, conectamos ${institution ?? 'tu banco'}. Importamos ${linked} ${linked === 1 ? 'cuenta' : 'cuentas'}.`}
      symbolName="checkmark.circle.fill"
      iconColor={P.success}
      footer={<FlowButton label="Volver a configuración" onPress={onFinish} />}
    />
  );
}
