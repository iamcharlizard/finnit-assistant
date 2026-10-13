import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';

interface ErrorStepProps {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onClose: () => void;
}

export function ErrorStep({ message, canRetry, onRetry, onClose }: ErrorStepProps) {
  const P = useBankConnectPalette();

  return (
    <StepLayout
      title="Algo salió mal"
      description={message}
      symbolName="exclamationmark.triangle.fill"
      iconColor={P.error}
      footer={
        <>
          <FlowButton label={canRetry ? 'Intentar de nuevo' : 'Elegir otro banco'} onPress={onRetry} />
          <FlowButton label="Cerrar" variant="ghost" onPress={onClose} />
        </>
      }
    />
  );
}
