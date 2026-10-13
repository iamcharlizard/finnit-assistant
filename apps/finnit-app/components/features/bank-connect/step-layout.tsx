import type { ReactNode } from 'react';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { TwView, TwText } from '@/lib/tw';
import { useBankConnectPalette } from '@/hooks/use-bank-connect-palette';

interface StepLayoutProps {
  title: string;
  description?: string;
  symbolName?: SymbolViewProps['name'];
  iconColor?: string;
  children?: ReactNode;
  /** Action buttons, rendered after the content. */
  footer?: ReactNode;
}

/** Card with a title, an optional description and the step's content and actions. */
export function StepLayout({ title, description, symbolName, iconColor, children, footer }: StepLayoutProps) {
  const P = useBankConnectPalette();

  return (
    <TwView className="gap-5">
      <TwView className="rounded-[24px] p-5 gap-4" style={P.card}>
        <TwView className="gap-2">
          {symbolName ? (
            <SymbolView name={symbolName} size={32} tintColor={iconColor ?? P.primary} accessibilityLabel="" />
          ) : null}
          <TwText accessibilityRole="header" style={{ fontFamily: 'Ubuntu Bold', fontSize: 22, color: P.onSurface }}>
            {title}
          </TwText>
          {description ? (
            <TwText style={{ fontFamily: 'Ubuntu', fontSize: 15, lineHeight: 22, color: P.onSurfaceVariant }}>
              {description}
            </TwText>
          ) : null}
        </TwView>
        {children}
      </TwView>
      {footer ? <TwView className="gap-3">{footer}</TwView> : null}
    </TwView>
  );
}
