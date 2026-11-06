import type * as React from 'react';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from './text';

interface FieldProps {
  label?: string;
  /** Next to the label (right side), e.g. a link. */
  labelAction?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label above, error below: the frame @finnit/ui's inputs draw around themselves. */
function Field({ label, labelAction, error, className, children }: FieldProps) {
  if (!label && !error) return <>{children}</>;
  return (
    <TwView className={cn('gap-1', className)}>
      {label ? (
        <TwView className="flex-row items-center justify-between px-1">
          <Text
            weight="medium"
            className="text-label-sm uppercase tracking-widest text-on-surface-variant"
          >
            {label}
          </Text>
          {labelAction}
        </TwView>
      ) : null}
      {children}
      {error ? (
        <Text accessibilityRole="alert" className="text-xs text-expense">
          {error}
        </Text>
      ) : null}
    </TwView>
  );
}

/** Border of a text box: focus ring, error and disabled states. */
function fieldBoxClass({
  focused,
  error,
  disabled,
}: {
  focused: boolean;
  error?: string;
  disabled?: boolean;
}) {
  return cn(
    'min-h-11 w-full rounded-input border border-input bg-surface',
    focused && 'border-ring',
    error && 'border-expense',
    disabled && 'opacity-50',
  );
}

export { Field, fieldBoxClass, type FieldProps };
