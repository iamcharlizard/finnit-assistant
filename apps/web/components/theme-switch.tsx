'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

import { Switch } from '@finnit/ui/components/ui/switch';

/** Light/dark switch shared by Settings and the login screen. */
export function ThemeSwitch({
  id,
  label,
}: {
  id?: string;
  /** Accessible name when no visible <label> points at `id`. */
  label?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // resolvedTheme is only known on the client; avoid a hydration mismatch.
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Switch
      id={id}
      aria-label={label}
      checked={isDark}
      disabled={!mounted}
      onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
    />
  );
}
