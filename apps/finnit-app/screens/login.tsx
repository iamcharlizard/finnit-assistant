import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { TwView, TwText, TwPressable, TwScrollView, TwTextInput } from '../lib/tw';
import { FinnGlassView } from '../components/ui/glass-view';
import { HeadlineLg, BodyMd, LabelSm } from '../components/ui/typography';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';

type LoginFormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'google' }
  | { status: 'error'; message: string }
  | { status: 'success' };

const LIGHT = {
  bg: '#f8f9fa',
  cardBg: 'rgba(255, 255, 255, 0.85)',
  cardBorder: 'rgba(255, 255, 255, 0.5)',
  inputBg: 'rgba(245, 246, 248, 0.9)',
  inputBorder: 'rgba(0, 0, 0, 0.1)',
  text: '#1a1b22',
  textMuted: '#5c6370',
  accent: '#6c72cb',
  accentText: '#003a3a',
  btnBg: '#6c72cb',
  btnText: '#ffffff',
  iconColor: '#5c6370',
  placeholder: 'rgba(92, 99, 112, 0.5)',
  divider: '#e8e8e8',
  socialBg: '#ffffff',
  socialBorder: '#e0e0e0',
  socialText: '#1a1b22',
  errorColor: '#ba1a1a',
  glowColor: undefined as string | undefined,
};

const DARK = {
  bg: '#12131a',
  cardBg: 'rgba(23, 31, 51, 0.82)',
  cardBorder: 'rgba(255, 255, 255, 0.1)',
  inputBg: 'rgba(6, 14, 32, 0.5)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  text: '#dae2fd',
  textMuted: '#a0a0a0',
  accent: '#00f5ff',
  accentText: '#00363a',
  btnBg: '#00f5ff',
  btnText: '#00363a',
  iconColor: '#a0a0a0',
  placeholder: 'rgba(184, 202, 203, 0.35)',
  divider: 'rgba(255, 255, 255, 0.1)',
  socialBg: 'rgba(45, 52, 73, 0.3)',
  socialBorder: 'rgba(255, 255, 255, 0.1)',
  socialText: '#dae2fd',
  errorColor: '#ff6b6b',
  glowColor: '0 0 22px rgba(0, 245, 255, 0.55)' as string | undefined,
};

function Icon({
  sf,
  md,
  size,
  color,
}: {
  sf: SymbolViewProps['name'];
  md: ComponentProps<typeof MaterialIcons>['name'];
  size: number;
  color: string;
}) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      <SymbolView
        name={sf}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={{ width: size, height: size }}
      />
    );
  }
  return <MaterialIcons name={md} size={size} color={color} />;
}

export function LoginScreen() {
  const { isDark } = useTheme();
  const T = isDark ? DARK : LIGHT;
  const { login, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState<LoginFormState>({ status: 'idle' });

  async function handleLogin() {
    if (!email.trim() || !password) {
      setFormState({ status: 'error', message: 'Por favor completa todos los campos.' });
      return;
    }
    setFormState({ status: 'submitting' });
    const { error } = await login(email.trim(), password);
    if (error) {
      setFormState({ status: 'error', message: error });
      return;
    }
    setFormState({ status: 'success' });
    router.replace('/(app)/dashboard');
  }

  async function handleGoogleLogin() {
    setFormState({ status: 'google' });
    const { error, cancelled } = await signInWithGoogle();
    if (cancelled) {
      setFormState({ status: 'idle' });
      return;
    }
    if (error) {
      setFormState({ status: 'error', message: error });
      return;
    }
    setFormState({ status: 'success' });
    router.replace('/(app)/dashboard');
  }

  const isSubmitting = formState.status === 'submitting';
  const isGoogleLoading = formState.status === 'google';
  const isBusy = isSubmitting || isGoogleLoading;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Background ambient blobs (dark mode only) */}
      {isDark ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -80,
              left: -60,
              width: 340,
              height: 340,
              backgroundColor: 'rgba(108, 114, 203, 0.14)',
              borderRadius: 9999,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -80,
              right: -60,
              width: 340,
              height: 340,
              backgroundColor: 'rgba(0, 245, 255, 0.08)',
              borderRadius: 9999,
            }}
          />
        </>
      ) : null}

      <TwScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-4 py-14"
        keyboardShouldPersistTaps="handled"
      >
        <TwView className="w-full self-center" style={{ maxWidth: 440 }}>

          {/* Brand identity */}
          <Animated.View entering={FadeInDown.duration(450).delay(0)}>
            <TwView className="items-center mb-10">
              <TwView
                className="w-16 h-16 rounded-2xl items-center justify-center mb-6"
                style={{
                  backgroundColor: T.accent,
                  boxShadow: isDark ? '0 0 30px rgba(0, 245, 255, 0.45)' : '0 4px 20px rgba(108, 114, 203, 0.35)',
                }}
                accessibilityElementsHidden
              >
                {process.env.EXPO_OS === 'ios' ? (
                  <SymbolView
                    name="wallet.pass.fill"
                    tintColor={T.accentText}
                    resizeMode="scaleAspectFit"
                    style={{ width: 36, height: 36 }}
                  />
                ) : (
                  <MaterialIcons name="account-balance-wallet" size={36} color={T.accentText} />
                )}
              </TwView>

              <HeadlineLg className="text-center" style={{ color: T.accent }}>
                Bienvenido de nuevo
              </HeadlineLg>

              <BodyMd className="text-center mt-2" style={{ color: T.textMuted }}>
                Gestiona tus finanzas con precisión Finnit.
              </BodyMd>
            </TwView>
          </Animated.View>

          {/* Login card */}
          <Animated.View entering={FadeInUp.duration(450).delay(120)}>
            <TwView
              style={{
                borderRadius: 28,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: T.cardBorder,
                boxShadow: isDark ? '0 8px 40px rgba(0, 0, 0, 0.5)' : '0 8px 32px rgba(0, 0, 0, 0.06)',
              }}
            >
              <FinnGlassView style={{ backgroundColor: T.cardBg, padding: 32 }}>

                {/* Email field */}
                <TwView className="mb-5">
                  <LabelSm className="mb-2 px-1" style={{ color: T.textMuted }}>
                    Correo electrónico
                  </LabelSm>
                  <TwView
                    className="flex-row items-center rounded-[14px]"
                    style={{
                      borderWidth: 1,
                      borderColor: T.inputBorder,
                      backgroundColor: T.inputBg,
                      minHeight: 56,
                    }}
                  >
                    <TwView className="pl-4 items-center justify-center" style={{ width: 40 }} accessibilityElementsHidden>
                      <Icon sf="at" md="alternate-email" size={20} color={T.iconColor} />
                    </TwView>
                    <TwTextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="nombre@ejemplo.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 pr-4 text-[16px]"
                      style={{ fontFamily: 'Ubuntu', color: T.text, paddingVertical: 14, paddingLeft: 8 }}
                      placeholderTextColor={T.placeholder}
                      accessibilityLabel="Correo electrónico"
                    />
                  </TwView>
                </TwView>

                {/* Password field */}
                <TwView className="mb-5">
                  <TwView className="flex-row items-center justify-between mb-2 px-1">
                    <LabelSm style={{ color: T.textMuted }}>Contraseña</LabelSm>
                    <TwPressable
                      accessibilityRole="link"
                      accessibilityLabel="¿Olvidaste tu contraseña?"
                      style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                      <TwText className="text-[12px] tracking-wide" style={{ color: T.accent, fontFamily: 'Ubuntu Medium' }}>
                        ¿Olvidaste tu contraseña?
                      </TwText>
                    </TwPressable>
                  </TwView>

                  <TwView
                    className="flex-row items-center rounded-[14px]"
                    style={{
                      borderWidth: 1,
                      borderColor: T.inputBorder,
                      backgroundColor: T.inputBg,
                      minHeight: 56,
                    }}
                  >
                    <TwView className="pl-4 items-center justify-center" style={{ width: 40 }} accessibilityElementsHidden>
                      <Icon sf="lock.fill" md="lock" size={20} color={T.iconColor} />
                    </TwView>
                    <TwTextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      secureTextEntry={!showPassword}
                      className="flex-1 text-[16px]"
                      style={{ fontFamily: 'Ubuntu', color: T.text, paddingVertical: 14, paddingLeft: 8 }}
                      placeholderTextColor={T.placeholder}
                      accessibilityLabel="Contraseña"
                    />
                    <TwPressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ minWidth: 48, minHeight: 56, justifyContent: 'center', alignItems: 'center' }}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      <Icon
                        sf={showPassword ? 'eye.slash.fill' : 'eye.fill'}
                        md={showPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={T.iconColor}
                      />
                    </TwPressable>
                  </TwView>
                </TwView>

                {/* Remember me */}
                <TwPressable
                  onPress={() => setRememberMe(!rememberMe)}
                  className="flex-row items-center gap-3 px-1 mb-6"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  accessibilityLabel="Mantener sesión iniciada"
                  style={{ minHeight: 44 }}
                >
                  <TwView
                    className="w-5 h-5 rounded-[4px] items-center justify-center"
                    style={{
                      borderWidth: 1.5,
                      borderColor: rememberMe ? T.accent : T.inputBorder,
                      backgroundColor: rememberMe ? T.accent : 'transparent',
                    }}
                  >
                    {rememberMe ? (
                      <Icon sf="checkmark" md="check" size={12} color={T.accentText} />
                    ) : null}
                  </TwView>
                  <TwText className="text-[14px]" style={{ color: T.textMuted, fontFamily: 'Ubuntu' }}>
                    Mantener sesión iniciada
                  </TwText>
                </TwPressable>

                {/* Error message */}
                {formState.status === 'error' ? (
                  <TwView className="mb-4 px-1">
                    <TwText
                      className="text-[13px]"
                      style={{ color: T.errorColor, fontFamily: 'Ubuntu' }}
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                    >
                      {formState.message}
                    </TwText>
                  </TwView>
                ) : null}

                {/* CTA button */}
                <TwPressable
                  onPress={handleLogin}
                  disabled={isBusy}
                  className="w-full rounded-[14px] flex-row items-center justify-center gap-2"
                  style={{
                    backgroundColor: T.btnBg,
                    minHeight: 56,
                    opacity: isSubmitting ? 0.8 : 1,
                    boxShadow: T.glowColor,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isSubmitting ? 'Verificando credenciales' : 'Iniciar sesión'}
                  accessibilityState={{ disabled: isBusy, busy: isSubmitting }}
                >
                  <TwText
                    className="text-[18px] leading-[24px]"
                    style={{ color: T.btnText, fontFamily: 'Ubuntu Medium' }}
                  >
                    {isSubmitting ? 'Verificando...' : 'Iniciar sesión'}
                  </TwText>
                  {!isSubmitting ? (
                    <Icon sf="arrow.right" md="arrow-forward" size={20} color={T.btnText} />
                  ) : null}
                </TwPressable>

                {/* Divider */}
                <TwView className="flex-row items-center my-8">
                  <TwView className="flex-1" style={{ height: 1, backgroundColor: T.divider }} />
                  <TwText className="mx-4 text-[11px] tracking-widest uppercase" style={{ color: T.textMuted, fontFamily: 'Ubuntu Medium' }}>
                    O continuar con
                  </TwText>
                  <TwView className="flex-1" style={{ height: 1, backgroundColor: T.divider }} />
                </TwView>

                {/* Social sign-in */}
                <TwPressable
                  onPress={handleGoogleLogin}
                  disabled={isBusy}
                  className="w-full flex-row items-center justify-center gap-2 rounded-[14px]"
                  style={{
                    borderWidth: 1,
                    borderColor: T.socialBorder,
                    backgroundColor: T.socialBg,
                    minHeight: 52,
                    opacity: isBusy && !isGoogleLoading ? 0.6 : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isGoogleLoading ? 'Iniciando sesión con Google' : 'Iniciar sesión con Google'}
                  accessibilityState={{ disabled: isBusy, busy: isGoogleLoading }}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator size="small" color={T.socialText} />
                  ) : (
                    <MaterialCommunityIcons name="google" size={18} color={T.socialText} />
                  )}
                  <TwText className="text-[14px]" style={{ color: T.socialText, fontFamily: 'Ubuntu Medium' }}>
                    {isGoogleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
                  </TwText>
                </TwPressable>

              </FinnGlassView>
            </TwView>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeInUp.duration(450).delay(220)}>
            <TwView className="items-center mt-8 px-4">
              <TwText className="text-[14px] text-center" style={{ color: T.textMuted, fontFamily: 'Ubuntu' }}>
                El acceso a Finnit es por invitación. Pide acceso al administrador.
              </TwText>
            </TwView>
          </Animated.View>

        </TwView>
      </TwScrollView>
    </SafeAreaView>
  );
}
