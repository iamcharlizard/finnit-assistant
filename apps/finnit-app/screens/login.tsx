import * as React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useTranslations } from 'use-intl';
import { ArrowRight, AtSign, Eye, EyeOff, Lock, Moon, Sun } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwScrollView, TwView } from '@finnit/ui-native/lib/tw';
import { useAppTheme, useToken } from '@finnit/ui-native/theme/theme-root';
import { Button } from '@finnit/ui-native/components/ui/button';
import { Checkbox } from '@finnit/ui-native/components/ui/checkbox';
import { GoogleIcon } from '@finnit/ui-native/components/ui/google-icon';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Input } from '@finnit/ui-native/components/ui/input';
import { Switch } from '@finnit/ui-native/components/ui/switch';
import { Text } from '@finnit/ui-native/components/ui/text';
import { BodyMd, HeadlineLg } from '@finnit/ui-native/components/ui/typography';

import { useAuth, type LoginError } from '@/contexts/AuthContext';
import { useAppearance } from '@/lib/theme/appearance';

// Brand logo (symbol + lettering); @2x/@3x picked by density.
const LOGO_LIGHT = require('../assets/images/brand/finnit-logo-light.png');
const LOGO_DARK = require('../assets/images/brand/finnit-logo-dark.png');

type Busy = 'password' | 'google' | null;

/**
 * Sign in, like the web's /login: email and password or Google, and
 * "Mantener sesión iniciada". Access is by invitation. Fits on the screen
 * without scrolling (it only scrolls when the keyboard needs the room).
 */
export function LoginScreen() {
  const t = useTranslations('login');
  const tc = useTranslations('settings');
  const { login, signInWithGoogle } = useAuth();
  const { scheme } = useAppTheme();
  const { setAppearance } = useAppearance();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const passwordRef = React.useRef<React.ComponentRef<typeof Input> | null>(null);
  const muted = useToken('--on-surface-variant');

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [error, setError] = React.useState<LoginError | null>(null);

  // Small phones (SE class, ≤ 700pt tall) get tighter spacing so it all fits.
  const compact = height - insets.top - insets.bottom < 720;
  const dark = scheme === 'dark';

  async function submit() {
    setError(null);
    setBusy('password');
    const outcome = await login(email, password, remember);
    setBusy(null);
    if (outcome.error) setError(outcome.error);
  }

  async function google() {
    setError(null);
    setBusy('google');
    const outcome = await signInWithGoogle(remember);
    setBusy(null);
    if (outcome.error) setError(outcome.error);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      {/* Ambient glow in dark mode, as on the web. */}
      {dark ? (
        <>
          <TwView pointerEvents="none" className="absolute -left-16 -top-20 size-[340px] rounded-full bg-[rgba(108,114,203,0.14)]" />
          <TwView pointerEvents="none" className="absolute -bottom-20 -right-16 size-[340px] rounded-full bg-[rgba(0,245,255,0.08)]" />
        </>
      ) : null}

      {/* Light / dark, top right (the web's ThemeSwitch). */}
      <TwView
        className="absolute right-4 z-10 flex-row items-center gap-2"
        style={{ top: insets.top + 8 }}
      >
        <Icon icon={Sun} size={16} color="--muted-foreground" />
        <Switch
          checked={dark}
          onCheckedChange={(on) => setAppearance(on ? 'dark' : 'light')}
          accessibilityLabel={tc('darkMode')}
        />
        <Icon icon={Moon} size={16} color="--muted-foreground" />
      </TwView>

      <TwScrollView
        keyboardShouldPersistTaps="handled"
        // Only scrolls when the keyboard takes the room; otherwise it fits.
        alwaysBounceVertical={false}
        contentContainerClassName="flex-grow items-center justify-center px-4"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }}
      >
        <TwView className="w-full" style={{ maxWidth: 440 }}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <TwView className={cn('items-center', compact ? 'mb-4' : 'mb-6')}>
              <Image
                source={dark ? LOGO_DARK : LOGO_LIGHT}
                accessibilityLabel="Finnit"
                contentFit="contain"
                style={{ width: 177, height: 56, marginBottom: compact ? 12 : 20 }}
              />
              <HeadlineLg className="text-center text-accent-neon">{t('welcome')}</HeadlineLg>
              <BodyMd className="mt-2 text-center text-on-surface-variant">{t('tagline')}</BodyMd>
            </TwView>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(450).delay(120)}>
            <TwView
              className={cn(
                'rounded-[28px] border border-glass-border bg-glass',
                compact ? 'gap-3 p-5' : 'gap-4 p-6',
              )}
              style={{
                boxShadow: dark ? '0 8px 40px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Input
                label={t('email')}
                icon={AtSign}
                value={email}
                onChangeText={setEmail}
                placeholder={t('emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                className="min-h-14 rounded-[14px]"
              />
              <Input
                ref={passwordRef}
                label={t('password')}
                labelAction={
                  <TwPressable accessibilityRole="link" className="min-h-11 justify-center">
                    <Text weight="medium" className="text-xs tracking-wide text-accent-neon">
                      {t('forgotPassword')}
                    </Text>
                  </TwPressable>
                }
                icon={Lock}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
                className="min-h-14 rounded-[14px]"
                trailing={
                  <TwPressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? t('hidePassword') : t('showPassword')}
                    onPress={() => setShowPassword((value) => !value)}
                    className="min-h-14 min-w-12 items-center justify-center"
                  >
                    <Icon icon={showPassword ? EyeOff : Eye} size={20} color="--on-surface-variant" />
                  </TwPressable>
                }
              />

              <Checkbox checked={remember} onCheckedChange={setRemember} label={t('remember')} className="px-1" />

              {error ? (
                <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="px-1 text-[13px] text-expense">
                  {t(`errors.${error}`)}
                </Text>
              ) : null}

              <Button
                label={busy === 'password' ? t('submitting') : t('submit')}
                size="lg"
                onPress={submit}
                disabled={busy !== null}
                className="w-full rounded-[14px]"
                style={dark ? { boxShadow: '0 0 22px rgba(0, 245, 255, 0.55)' } : undefined}
                trailing={busy === 'password' ? null : <Icon icon={ArrowRight} size={20} color="--primary-foreground" />}
              />

              <TwView className={cn('flex-row items-center gap-4', compact ? 'my-0' : 'my-1')}>
                <TwView className="h-px flex-1 bg-outline" />
                <Text weight="medium" className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                  {t('orContinueWith')}
                </Text>
                <TwView className="h-px flex-1 bg-outline" />
              </TwView>

              <TwPressable
                accessibilityRole="button"
                accessibilityLabel={t('google')}
                accessibilityState={{ busy: busy === 'google', disabled: busy !== null }}
                disabled={busy !== null}
                onPress={google}
                className={cn(
                  'min-h-12 w-full flex-row items-center justify-center gap-2 rounded-[14px] border border-outline active:opacity-75',
                  busy === 'password' && 'opacity-60',
                )}
              >
                {busy === 'google' ? <ActivityIndicator size="small" color={muted} /> : <GoogleIcon />}
                <Text weight="medium" className="text-sm text-on-background">
                  {t('google')}
                </Text>
              </TwPressable>
            </TwView>
          </Animated.View>

          <Text className={cn('text-center text-sm text-on-surface-variant', compact ? 'mt-3' : 'mt-5')}>
            {t('invitationOnly')}
          </Text>
        </TwView>
      </TwScrollView>
    </KeyboardAvoidingView>
  );
}
