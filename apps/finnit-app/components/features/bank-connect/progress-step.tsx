import { ActivityIndicator } from 'react-native';

import { TwText, TwView } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

interface ProgressStepProps {
  message: string;
  /** Shown above the message, e.g. the bank being connected. */
  title?: string;
}

/** Spinner with a status message (loading and connecting steps). */
export function ProgressStep({ message, title }: ProgressStepProps) {
  const P = useBankConnectPalette();

  return (
    <TwView className="rounded-[24px] p-8 items-center gap-4" style={P.card}>
      <ActivityIndicator size="large" color={P.primary} accessibilityLabel="Cargando" />
      {title ? (
        <TwText className="text-center" style={{ fontFamily: 'Ubuntu Bold', fontSize: 18, color: P.onSurface }}>
          {title}
        </TwText>
      ) : null}
      <TwText
        className="text-center"
        style={{ fontFamily: 'Ubuntu', fontSize: 15, lineHeight: 22, color: P.onSurfaceVariant }}
        accessibilityLiveRegion="polite"
      >
        {message}
      </TwText>
    </TwView>
  );
}
