# Finnit Unified Design System Spec

This specification consolidates the **Finnit Light** and **Finnit Dark** themes into a unified token structure, optimized for **React Native (Expo)** and **Next.js (Tailwind CSS)**.

## 1. Typography (Ubuntu)

Both themes share the same typographic scale and font family.

- **Font Family**: `Ubuntu, sans-serif`
- **Scale**:
  - `display-lg`: 36px / 44px
  - `headline-lg`: 28px / 36px
  - `title-lg`: 22px / 28px
  - `body-md`: 16px / 24px
  - `label-sm`: 12px / 16px

---

## 2. Color Palette (Semantic Tokens)

Implement these using a theme provider (e.g., `ThemeProvider` in React Native or CSS Variables in Next.js).

| Token Name           | Finnit Light (Value) | Finnit Dark (Value) | Description               |
| :------------------- | :------------------- | :------------------ | :------------------------ |
| `primary`            | `#00f5ff`            | `#6c72cb`           | Main brand accent         |
| `background`         | `#f8f9fa`            | `#12131a`           | Base surface color        |
| `surface`            | `#ffffff`            | `#1a1b22`           | Card/Container background |
| `on-background`      | `#1a1b22`            | `#f8f9fa`           | High-emphasis text        |
| `on-surface-variant` | `#5c6370`            | `#a0a0a0`           | Low-emphasis text/labels  |
| `outline`            | `#e0e0e0`            | `#2d2e38`           | Borders and dividers      |
| `accent-neon`        | `#6c72cb`            | `#00f5ff`           | Secondary vibrant accent  |

---

## 3. Implementation Guide

### React Native + Expo (StyleSheet / Tailwind)

```javascript
// theme.js
export const theme = {
  light: {
    colors: {
      primary: '#00f5ff',
      background: '#f8f9fa',
      surface: '#ffffff',
      text: '#1a1b22',
      accent: '#6c72cb',
    },
    // ...
  },
  dark: {
    colors: {
      primary: '#6c72cb',
      background: '#12131a',
      surface: '#1a1b22',
      text: '#f8f9fa',
      accent: '#00f5ff',
    },
    // ...
  },
};
```

### Next.js + Tailwind CSS

```css
/* globals.css */
:root {
  --color-primary: #00f5ff;
  --color-bg: #f8f9fa;
  --color-surface: #ffffff;
}

[data-theme='dark'] {
  --color-primary: #6c72cb;
  --color-bg: #12131a;
  --color-surface: #1a1b22;
}
```

---

## 4. Visual Effects (Glassmorphism)

- **Light Mode**: `background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.4);`
- **Dark Mode**: `background: rgba(18, 19, 26, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1);`
