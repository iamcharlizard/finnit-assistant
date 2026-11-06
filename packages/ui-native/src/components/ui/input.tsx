import * as React from 'react';
import type { TextInputProps } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwTextInput, TwView } from '../../lib/tw';
import { useToken } from '../../theme/theme-root';
import { Field, fieldBoxClass } from './field';
import { Icon } from './icon';

interface InputProps extends TextInputProps {
  label?: string;
  /** Next to the label, e.g. "¿Olvidaste tu contraseña?". */
  labelAction?: React.ReactNode;
  error?: string;
  className?: string;
  disabled?: boolean;
  /** Icon at the start (the web's InputWithIcon). */
  icon?: LucideIcon;
  /** At the end, e.g. a show-password button. */
  trailing?: React.ReactNode;
  ref?: React.ComponentProps<typeof TwTextInput>['ref'];
}

/** @finnit/ui's Input (and InputWithIcon): a text box with optional label and error. */
function Input({
  label,
  labelAction,
  error,
  className,
  disabled,
  icon,
  trailing,
  onFocus,
  onBlur,
  ref,
  ...props
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const placeholder = useToken('--on-surface-variant');
  return (
    <Field label={label} labelAction={labelAction} error={error}>
      <TwView
        className={cn(
          fieldBoxClass({ focused, error, disabled }),
          'flex-row items-center',
          icon ? 'pl-4' : 'pl-0',
          className,
        )}
      >
        {icon ? <Icon icon={icon} size={20} color="--on-surface-variant" /> : null}
        <TwTextInput
          ref={ref}
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
            'min-w-0 flex-1 py-3 font-ubuntu text-base leading-none text-on-background',
            icon ? 'pl-2' : 'pl-4',
            trailing ? 'pr-1' : 'pr-4',
          )}
          {...props}
        />
        {trailing}
      </TwView>
    </Field>
  );
}

export { Input, type InputProps };
