import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';
import { FlowButton } from './flow-button';
import { StepLayout } from './step-layout';

interface NeedsWidgetStepProps {
  siteName: string;
  /** The login started here but the bank asked for a check the app can't show yet. */
  startedLogin: boolean;
  onPickAnother: () => void;
  onClose: () => void;
}

/** Mobile v1 has no Syncfy widget fallback: point the user to the web app. */
export function NeedsWidgetStep({ siteName, startedLogin, onPickAnother, onClose }: NeedsWidgetStepProps) {
  const P = useBankConnectPalette();

  return (
    <StepLayout
      title="Conéctalo desde la web"
      description={
        startedLogin
          ? `${siteName} pidió una verificación de seguridad que todavía no podemos mostrar en la app. Por ahora, conecta este banco desde la versión web de Finnit.`
          : `Por ahora, ${siteName} solo se puede conectar desde la versión web de Finnit. Estamos trabajando para traerlo a la app.`
      }
      symbolName="globe"
      iconColor={P.warning}
      footer={
        <>
          <FlowButton label="Elegir otro banco" onPress={onPickAnother} />
          <FlowButton label="Cerrar" variant="ghost" onPress={onClose} />
        </>
      }
    />
  );
}
