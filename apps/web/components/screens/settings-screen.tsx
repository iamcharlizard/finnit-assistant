'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BellRing,
  ChevronRight,
  Fingerprint,
  Lock,
  LogOut,
  Moon,
  Paintbrush,
  ShieldCheck,
  Type,
} from 'lucide-react';

import { ProfileCard } from '@finnit/ui/components/settings/profile-card';
import { SettingRow } from '@finnit/ui/components/settings/setting-row';
import { SettingsSection } from '@finnit/ui/components/settings/settings-section';
import { Button } from '@finnit/ui/components/ui/button';
import { Switch } from '@finnit/ui/components/ui/switch';

import { MOCK_USER } from '@/lib/mocks/user';

export function SettingsScreen() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [toggles, setToggles] = React.useState({
    biometrics: true,
    transactions: true,
    weeklySummary: false,
  });

  // resolvedTheme is only known on the client; avoid a hydration mismatch.
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ProfileCard
        name={MOCK_USER.name}
        email={MOCK_USER.email}
        isPremium
        isVerified
      />

      <SettingsSection
        title="Seguridad"
        icon={ShieldCheck}
        iconColor="var(--tertiary)"
      >
        <SettingRow label="Biometría" icon={Fingerprint} controlId="biometrics">
          <Switch
            id="biometrics"
            checked={toggles.biometrics}
            onCheckedChange={(v) =>
              setToggles((t) => ({ ...t, biometrics: v }))
            }
          />
        </SettingRow>
        <button
          type="button"
          className="flex min-h-[52px] items-center justify-between rounded-xl bg-track px-3 text-on-surface-variant outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="flex items-center gap-3 text-base">
            <Lock aria-hidden className="size-5" />
            Cambiar PIN
          </span>
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </SettingsSection>

      <SettingsSection
        title="Apariencia"
        icon={Paintbrush}
        iconColor="var(--highlight)"
      >
        <SettingRow label="Modo Oscuro" icon={Moon} controlId="dark-mode">
          <Switch
            id="dark-mode"
            checked={isDark}
            disabled={!mounted}
            onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </SettingRow>
        <SettingRow label="Fuente" icon={Type}>
          <span className="text-[13px] font-medium text-highlight">Ubuntu</span>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Notificaciones y Alertas"
        icon={BellRing}
        iconColor="#6c72cb"
      >
        <SettingRow
          label="Transacciones"
          description="Empuje inmediato"
          controlId="tx-notif"
        >
          <Switch
            id="tx-notif"
            checked={toggles.transactions}
            onCheckedChange={(v) =>
              setToggles((t) => ({ ...t, transactions: v }))
            }
          />
        </SettingRow>
        <SettingRow
          label="Resumen Semanal"
          description="Email"
          controlId="weekly"
        >
          <Switch
            id="weekly"
            checked={toggles.weeklySummary}
            onCheckedChange={(v) =>
              setToggles((t) => ({ ...t, weeklySummary: v }))
            }
          />
        </SettingRow>
      </SettingsSection>

      <Button
        variant="destructive"
        size="lg"
        className="mt-4 rounded-[20px] text-base font-bold"
        // TODO: clear the session once auth is wired to the API.
        onClick={() => router.push('/login')}
      >
        <LogOut className="size-5" /> Cerrar Sesión
      </Button>

      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
        Finnit v1.0.0 • Built for the future
      </p>
    </div>
  );
}
