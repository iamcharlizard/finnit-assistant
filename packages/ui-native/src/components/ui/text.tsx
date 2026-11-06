import type * as React from 'react';
import type { TextProps as RNTextProps } from 'react-native';

import { cn } from '../../lib/utils';
import { TwText } from '../../lib/tw';

type Weight = 'regular' | 'medium' | 'bold';

const WEIGHT_FONT: Record<Weight, string> = {
  regular: 'font-ubuntu',
  medium: 'font-ubuntu-medium',
  bold: 'font-ubuntu-bold',
};

interface TextProps extends RNTextProps {
  className?: string;
  /**
   * Ubuntu is registered once per weight, so the weight picks the font
   * family (`font-bold` alone would make iOS fake a bold face).
   */
  weight?: Weight;
}

/**
 * Text in the app's font and color. React Native doesn't inherit text
 * styles from views, so every label goes through this (or a variant below).
 */
function Text({ className, weight = 'regular', ...props }: TextProps) {
  return (
    <TwText
      className={cn('text-body-md text-on-background', WEIGHT_FONT[weight], className)}
      {...props}
    />
  );
}

export { Text, type TextProps, type Weight };
export type TextChildren = React.ReactNode;
