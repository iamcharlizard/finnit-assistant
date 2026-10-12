import type { Preview, ReactRenderer } from '@storybook/react-vite';
import { withThemeByClassName } from '@storybook/addon-themes';

import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import '@finnit/ui/globals.css';

const preview: Preview = {
  decorators: [
    withThemeByClassName<ReactRenderer>({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'dark',
    }),
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
