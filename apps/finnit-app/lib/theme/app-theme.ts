import { parseAppTheme, type AppTheme } from '@finnit/core/theme/app-theme';

/**
 * The palette for the whole app, like the web's FINNIT_THEME: chosen at
 * build time with EXPO_PUBLIC_FINNIT_THEME (finnit when unset). Users only
 * pick light or dark.
 */
export const APP_THEME: AppTheme = parseAppTheme(process.env.EXPO_PUBLIC_FINNIT_THEME);
