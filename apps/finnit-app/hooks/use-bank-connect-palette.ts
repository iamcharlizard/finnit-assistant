import { useTheme } from '@/contexts/ThemeContext';

/** Colors of the bank connection screens, from the app's light/dark tokens (global.css). */
export interface BankConnectPalette {
  isDark: boolean;
  bg: string;
  onSurface: string;
  onSurfaceVariant: string;
  primary: string;
  onPrimary: string;
  success: string;
  error: string;
  errorBg: string;
  warning: string;
  warningBg: string;
  outline: string;
  rowBg: string;
  selectedBg: string;
  card: { backgroundColor: string; borderWidth: number; borderColor: string; boxShadow: string };
}

const DARK: BankConnectPalette = {
  isDark: true,
  bg: '#12131a',
  onSurface: '#e3e1eb',
  onSurfaceVariant: '#a0a0a0',
  primary: '#6c72cb',
  onPrimary: '#ffffff',
  success: '#27dec1',
  error: '#ffb4ab',
  errorBg: 'rgba(255, 180, 171, 0.12)',
  warning: '#ffd38a',
  warningBg: 'rgba(255, 211, 138, 0.12)',
  outline: '#2d2e38',
  rowBg: 'rgba(255, 255, 255, 0.05)',
  selectedBg: 'rgba(108, 114, 203, 0.22)',
  card: {
    backgroundColor: 'rgba(30, 31, 38, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.4)',
  },
};

const LIGHT: BankConnectPalette = {
  isDark: false,
  bg: '#f8f9fa',
  onSurface: '#1a1b22',
  onSurfaceVariant: '#5c6370',
  primary: '#6c72cb',
  onPrimary: '#ffffff',
  success: '#006688',
  error: '#ba1a1a',
  errorBg: 'rgba(186, 26, 26, 0.08)',
  warning: '#8a5300',
  warningBg: 'rgba(138, 83, 0, 0.08)',
  outline: '#e0e0e0',
  rowBg: 'rgba(0, 0, 0, 0.03)',
  selectedBg: 'rgba(108, 114, 203, 0.14)',
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.06)',
  },
};

export function useBankConnectPalette(): BankConnectPalette {
  const { isDark } = useTheme();
  return isDark ? DARK : LIGHT;
}
