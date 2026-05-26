import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { FadeIn, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

import { TwView, TwText, TwPressable, TwScrollView } from '@/lib/tw';
import { TwAnimatedView } from '@/lib/tw/animated';
import { TopAppBar } from '@/components/navigation/top-app-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface TogglesState {
  biometrics: boolean;
  darkMode: boolean;
  transactions: boolean;
  weeklySummary: boolean;
}

const DARK_PALETTE = {
  bg: '#12131a',
  surface: '#1a1b22',
  primary: '#6c72cb',
  secondary: '#ffabf2',
  tertiary: '#27dec1',
  error: '#ffb4ab',
  onSurface: '#e3e1eb',
  onSurfaceVariant: '#a0a0a0',
  glass: { backgroundColor: 'rgba(30, 31, 38, 0.7)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.4)' } as object,
  rowBg: { backgroundColor: 'rgba(255, 255, 255, 0.05)' } as object,
} as const;

const LIGHT_PALETTE = {
  bg: '#f8f9fa',
  surface: '#ffffff',
  primary: '#6c72cb',
  secondary: '#ad009b',
  tertiary: '#006688',
  error: '#ba1a1a',
  onSurface: '#1a1b22',
  onSurfaceVariant: '#5c6370',
  glass: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.07)', boxShadow: '0 8px 32px 0 rgba(0,0,0,0.06)' } as object,
  rowBg: { backgroundColor: 'rgba(0, 0, 0, 0.03)' } as object,
} as const;

interface ToggleSwitchProps {
  enabled: boolean;
  accentColor: string;
  glowColor: string;
  onToggle: () => void;
  accessibilityLabel: string;
}

function ToggleSwitch({ enabled, accentColor, glowColor, onToggle, accessibilityLabel }: ToggleSwitchProps) {
  const thumbLeft = enabled ? 24 : 4;
  return (
    <TwPressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: enabled }}
      style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}
    >
      <TwView style={{ width: 40, height: 20, borderRadius: 10, backgroundColor: enabled ? `${accentColor}33` : 'rgba(255,255,255,0.08)' }}>
        <TwView style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, top: 4, left: thumbLeft, backgroundColor: enabled ? accentColor : '#a0a0a0', boxShadow: enabled ? `0 0 8px ${glowColor}` : undefined }} />
      </TwView>
    </TwPressable>
  );
}

interface SettingRowProps {
  symbolName: string;
  label: string;
  children: React.ReactNode;
  onSurfaceVariant: string;
  rowBg: object;
}

function SettingRow({ symbolName, label, children, onSurfaceVariant, rowBg }: SettingRowProps) {
  return (
    <TwView className="flex-row items-center justify-between px-3 rounded-xl" style={{ ...rowBg, minHeight: 52 }}>
      <TwView className="flex-row items-center gap-3 flex-1">
        <SymbolView name={symbolName as never} size={20} tintColor={onSurfaceVariant} accessibilityLabel="" />
        <TwText style={{ fontFamily: 'Ubuntu', fontSize: 16, color: onSurfaceVariant }}>{label}</TwText>
      </TwView>
      {children}
    </TwView>
  );
}

interface SectionHeaderProps {
  symbolName: string;
  label: string;
  iconColor: string;
  onSurface: string;
}

function SectionHeader({ symbolName, label, iconColor, onSurface }: SectionHeaderProps) {
  return (
    <TwView className="flex-row items-center gap-3 mb-1">
      <SymbolView name={symbolName as never} size={20} tintColor={iconColor} accessibilityLabel="" />
      <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 16, color: onSurface }}>{label}</TwText>
    </TwView>
  );
}

export function SettingsScreen() {
  const { isDark, toggleTheme } = useTheme();
  const P = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const { user, logout } = useAuth();

  const displayName = user?.name ?? 'Usuario';
  const displayEmail = user?.email ?? '';
  const initials = getInitials(displayName);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const [toggles, setToggles] = useState<TogglesState>({
    biometrics: true,
    darkMode: isDark,
    transactions: true,
    weeklySummary: false,
  });

  function toggle(key: keyof TogglesState) {
    if (key === 'darkMode') {
      toggleTheme();
    }
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <TwView className="flex-1" style={{ backgroundColor: P.bg }}>
      <TopAppBar title="Configuración" />

      <TwScrollView contentInsetAdjustmentBehavior="automatic" className="flex-1" contentContainerClassName="px-4 pt-5 pb-10" showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <TwAnimatedView entering={FadeIn.duration(400)} className="mb-5">
          <TwView className="rounded-[24px] p-5 items-center" style={{ ...P.glass, overflow: 'hidden' }}>
            {/* Premium badge */}
            <TwView className="absolute top-3 right-3">
              <TwView
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: isDark ? 'rgba(120, 30, 116, 0.75)' : 'rgba(173, 0, 155, 0.1)', boxShadow: isDark ? '0 0 15px rgba(255, 171, 242, 0.35)' : undefined }}
              >
                <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 10, color: P.secondary, letterSpacing: 2, textTransform: 'uppercase' }}>
                  Premium
                </TwText>
              </TwView>
            </TwView>

            {/* Avatar with gradient ring */}
            <TwView className="relative mb-4 mt-2">
              <TwView
                className="w-24 h-24 rounded-full items-center justify-center"
                style={{ experimental_backgroundImage: `linear-gradient(135deg, ${P.primary} 0%, ${P.secondary} 50%, ${P.tertiary} 100%)`, padding: 3 }}
              >
                <TwView className="flex-1 w-full rounded-full items-center justify-center" style={{ backgroundColor: isDark ? '#1e1f26' : '#f0f0f8' }}>
                  <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 30, color: P.primary }} accessibilityLabel={`Avatar del usuario: ${displayName}`}>
                    {initials}
                  </TwText>
                </TwView>
              </TwView>

              {/* Verified badge */}
              <TwView className="absolute bottom-0 right-0 w-7 h-7 rounded-full items-center justify-center" style={{ backgroundColor: P.tertiary, borderWidth: 2, borderColor: P.surface, boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                <SymbolView name="checkmark.seal.fill" size={14} tintColor={isDark ? '#003428' : '#ffffff'} accessibilityLabel="Cuenta verificada" />
              </TwView>
            </TwView>

            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 22, color: P.onSurface, marginBottom: 4 }}>{displayName}</TwText>
            <TwText style={{ fontFamily: 'Ubuntu', fontSize: 14, color: P.onSurfaceVariant, marginBottom: 20 }}>{displayEmail}</TwText>

            <TwPressable
              className="px-8 rounded-full active:opacity-70"
              style={{ backgroundColor: `${P.primary}1a`, borderWidth: 1, borderColor: `${P.primary}4d`, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Editar perfil de usuario"
            >
              <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 14, color: P.primary }}>Editar Perfil</TwText>
            </TwPressable>
          </TwView>
        </TwAnimatedView>

        {/* Security section */}
        <TwAnimatedView entering={FadeInUp.duration(300).delay(100)} className="mb-4">
          <TwView className="rounded-[24px] p-4 gap-3" style={P.glass}>
            <SectionHeader symbolName="lock.shield.fill" label="Seguridad" iconColor={P.tertiary} onSurface={P.onSurface} />
            <SettingRow symbolName="touchid" label="Biometría" onSurfaceVariant={P.onSurfaceVariant} rowBg={P.rowBg}>
              <ToggleSwitch
                enabled={toggles.biometrics}
                accentColor={P.tertiary}
                glowColor={isDark ? 'rgba(39, 222, 193, 0.6)' : 'rgba(0, 102, 136, 0.4)'}
                onToggle={() => toggle('biometrics')}
                accessibilityLabel="Activar autenticación biométrica"
              />
            </SettingRow>

            <TwPressable
              className="flex-row items-center justify-between px-3 rounded-xl active:opacity-70"
              style={{ ...P.rowBg, minHeight: 52 }}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Cambiar PIN de seguridad"
            >
              <TwView className="flex-row items-center gap-3 flex-1">
                <SymbolView name="lock.fill" size={20} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 16, color: P.onSurfaceVariant }}>Cambiar PIN</TwText>
              </TwView>
              <SymbolView name="chevron.right" size={14} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
            </TwPressable>
          </TwView>
        </TwAnimatedView>

        {/* Appearance section */}
        <TwAnimatedView entering={FadeInUp.duration(300).delay(180)} className="mb-4">
          <TwView className="rounded-[24px] p-4 gap-3" style={P.glass}>
            <SectionHeader symbolName="paintbrush.fill" label="Apariencia" iconColor={P.secondary} onSurface={P.onSurface} />
            <SettingRow symbolName="moon.fill" label="Modo Oscuro" onSurfaceVariant={P.onSurfaceVariant} rowBg={P.rowBg}>
              <ToggleSwitch
                enabled={toggles.darkMode}
                accentColor={P.secondary}
                glowColor={isDark ? 'rgba(255, 171, 242, 0.6)' : 'rgba(173, 0, 155, 0.4)'}
                onToggle={() => toggle('darkMode')}
                accessibilityLabel="Activar modo oscuro"
              />
            </SettingRow>

            <TwView className="flex-row items-center justify-between px-3 rounded-xl" style={{ ...P.rowBg, minHeight: 52 }}>
              <TwView className="flex-row items-center gap-3 flex-1">
                <SymbolView name="textformat" size={20} tintColor={P.onSurfaceVariant} accessibilityLabel="" />
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 16, color: P.onSurfaceVariant }}>Fuente</TwText>
              </TwView>
              <TwText style={{ fontFamily: 'Ubuntu Medium', fontSize: 13, color: P.secondary }}>Ubuntu</TwText>
            </TwView>
          </TwView>
        </TwAnimatedView>

        {/* Notifications section */}
        <TwAnimatedView entering={FadeInUp.duration(300).delay(260)} className="mb-8">
          <TwView className="rounded-[24px] p-4 gap-3" style={P.glass}>
            <SectionHeader symbolName="bell.badge.fill" label="Notificaciones y Alertas" iconColor={P.primary} onSurface={P.onSurface} />

            <TwView className="flex-row items-center justify-between px-3 rounded-xl" style={{ ...P.rowBg, minHeight: 60 }}>
              <TwView className="flex-1">
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 16, color: P.onSurface }}>Transacciones</TwText>
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 10, color: P.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>Empuje Inmediato</TwText>
              </TwView>
              <ToggleSwitch
                enabled={toggles.transactions}
                accentColor={P.primary}
                glowColor={isDark ? 'rgba(108, 114, 203, 0.6)' : 'rgba(108, 114, 203, 0.4)'}
                onToggle={() => toggle('transactions')}
                accessibilityLabel="Notificaciones de transacciones"
              />
            </TwView>

            <TwView className="flex-row items-center justify-between px-3 rounded-xl" style={{ ...P.rowBg, minHeight: 60 }}>
              <TwView className="flex-1">
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 16, color: P.onSurface }}>Resumen Semanal</TwText>
                <TwText style={{ fontFamily: 'Ubuntu', fontSize: 10, color: P.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>Email</TwText>
              </TwView>
              <ToggleSwitch
                enabled={toggles.weeklySummary}
                accentColor={P.primary}
                glowColor={isDark ? 'rgba(108, 114, 203, 0.6)' : 'rgba(108, 114, 203, 0.4)'}
                onToggle={() => toggle('weeklySummary')}
                accessibilityLabel="Resumen semanal por email"
              />
            </TwView>
          </TwView>
        </TwAnimatedView>

        {/* Logout button */}
        <TwAnimatedView entering={FadeInUp.duration(300).delay(340)} className="gap-4">
          <TwPressable
            className="flex-row items-center justify-center gap-3 rounded-[20px] active:opacity-75"
            style={{
              experimental_backgroundImage: isDark
                ? 'linear-gradient(90deg, rgba(255,180,171,0.22) 0%, rgba(255,180,171,0.06) 100%)'
                : 'linear-gradient(90deg, rgba(186,26,26,0.08) 0%, rgba(186,26,26,0.03) 100%)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 180, 171, 0.35)' : 'rgba(186, 26, 26, 0.25)',
              minHeight: 56,
            }}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión de la cuenta"
          >
            <SymbolView name="rectangle.portrait.and.arrow.right" size={22} tintColor={P.error} accessibilityLabel="" />
            <TwText style={{ fontFamily: 'Ubuntu Bold', fontSize: 16, color: P.error }}>Cerrar Sesión</TwText>
          </TwPressable>

          <TwText
            className="text-center"
            style={{ fontFamily: 'Ubuntu', fontSize: 10, color: P.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 2, opacity: 0.4 }}
          >
            Finnit v1.0.0 • Built for the future
          </TwText>
        </TwAnimatedView>
      </TwScrollView>

    </TwView>
  );
}
