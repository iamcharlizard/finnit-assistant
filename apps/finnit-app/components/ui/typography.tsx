import { TwText } from '../../lib/tw';
import type { TextProps } from 'react-native';

interface TypographyProps extends TextProps {
  className?: string;
  children?: React.ReactNode;
}

export function DisplayLg({ className = '', ...props }: TypographyProps) {
  return (
    <TwText
      className={`text-[36px] leading-[44px] font-bold text-on-background ${className}`}
      style={{ fontFamily: 'Ubuntu Bold' }}
      {...props}
    />
  );
}

export function HeadlineLg({ className = '', ...props }: TypographyProps) {
  return (
    <TwText
      className={`text-[28px] leading-[36px] font-bold text-on-background ${className}`}
      style={{ fontFamily: 'Ubuntu Bold' }}
      {...props}
    />
  );
}

export function TitleLg({ className = '', ...props }: TypographyProps) {
  return (
    <TwText
      className={`text-[22px] leading-[28px] font-medium text-on-background ${className}`}
      style={{ fontFamily: 'Ubuntu Medium' }}
      {...props}
    />
  );
}

export function BodyMd({ className = '', ...props }: TypographyProps) {
  return (
    <TwText
      className={`text-[16px] leading-[24px] text-on-background ${className}`}
      style={{ fontFamily: 'Ubuntu' }}
      {...props}
    />
  );
}

export function LabelSm({ className = '', ...props }: TypographyProps) {
  return (
    <TwText
      className={`text-[12px] leading-[16px] tracking-widest uppercase font-medium text-on-surface-variant ${className}`}
      style={{ fontFamily: 'Ubuntu Medium' }}
      {...props}
    />
  );
}
