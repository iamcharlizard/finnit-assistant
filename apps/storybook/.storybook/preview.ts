import type { Preview, ReactRenderer } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import '@finnit/ui/globals.css';

/** The app themes (palettes) from globals.css; light/dark is the other toggle. */
const PALETTES = ['finnit', 'glass', 'suave', 'mono'] as const;

const preview: Preview = {
  globalTypes: {
    palette: {
      description: 'App theme (data-theme)',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [...PALETTES],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { palette: 'finnit' },
  decorators: [
    withThemeByClassName<ReactRenderer>({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'dark',
    }),
    (Story, context) => {
      const palette = String(context.globals.palette ?? 'finnit');
      document.documentElement.dataset.theme = palette;
      return Story();
    },
  ],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    controls: {
      matchers: { color: /(background|color)$/i },
    },
    a11y: { test: 'todo' },
  },
  tags: ['autodocs'],
};

export default preview;
