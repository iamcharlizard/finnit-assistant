import * as React from 'react';
import type { TextInputProps } from 'react-native';

import { cn } from '../../lib/utils';
import { TwTextInput } from '../../lib/tw';
import { useToken } from '../../theme/theme-root';
import { Field, fieldBoxClass } from './field';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

/** @finnit/ui's Input: a text box with optional label and error. */
function Input({ label, error, className, disabled, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const placeholder = useToken('--on-surface-variant');
  return (
    <Field label={label} error={error}>
      <TwTextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        editable={!disabled}
        placeholderTextColor={placeholder}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        className={cn(
          fieldBoxClass({ focused, error, disabled }),
          'px-4 py-3 font-ubuntu text-base leading-none text-on-background',
          className,
        )}
        {...props}
      />
    </Field>
  );
}

export { Input, type InputProps };
