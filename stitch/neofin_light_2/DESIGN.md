---
name: NeoFin Light
colors:
  surface: '#f7fafc'
  surface-dim: '#d7dadc'
  surface-bright: '#f7fafc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f6'
  surface-container: '#ebeef0'
  surface-container-high: '#e5e9eb'
  surface-container-highest: '#e0e3e5'
  on-surface: '#181c1e'
  on-surface-variant: '#434656'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eef1f3'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004ced'
  primary: '#003ec7'
  on-primary: '#ffffff'
  primary-container: '#0052ff'
  on-primary-container: '#dfe3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#006688'
  on-secondary: '#ffffff'
  secondary-container: '#00c1fd'
  on-secondary-container: '#004b65'
  tertiary: '#484e5a'
  on-tertiary: '#ffffff'
  tertiary-container: '#606673'
  on-tertiary-container: '#dfe4f3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001452'
  on-primary-fixed-variant: '#0038b6'
  secondary-fixed: '#c2e8ff'
  secondary-fixed-dim: '#75d1ff'
  on-secondary-fixed: '#001e2b'
  on-secondary-fixed-variant: '#004d67'
  tertiary-fixed: '#dde2f1'
  tertiary-fixed-dim: '#c1c6d5'
  on-tertiary-fixed: '#161c26'
  on-tertiary-fixed-variant: '#414753'
  background: '#f7fafc'
  on-background: '#181c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Ubuntu
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Ubuntu
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Ubuntu
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Ubuntu
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Ubuntu
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Ubuntu
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Ubuntu
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Ubuntu
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Ubuntu
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
This design system is engineered for the modern fintech landscape, prioritizing clarity, efficiency, and a sense of "digital lightness." The brand personality is professional yet approachable, eliminating the coldness often found in legacy banking applications.

The design style follows a **Corporate / Modern** aesthetic with a subtle **Minimalist** influence. It utilizes generous white space, a structured layout, and precise typography to reduce cognitive load while maintaining a high level of trust and technical reliability.

## Colors
The palette is centered around a vibrant "Digital Blue" primary color, symbolizing stability and innovation.
- **Primary:** Used for main actions, active states, and brand presence.
- **Secondary:** A bright cyan used for accents and data visualization highlights.
- **Tertiary:** A cool slate grey for secondary text and supportive iconography.
- **Neutral:** A range of soft greys and off-whites used for backgrounds and container surfaces to ensure the content remains the focal point.

## Typography
The typography is unified under the **Ubuntu** typeface. Its distinctive humanist curves and modern construction provide a friendly but highly legible interface, particularly for numerical data and financial statements.

- **Headlines:** Set in Medium or Bold weights to create a strong information hierarchy.
- **Body:** Standardized at 16px for optimal readability across all devices.
- **Labels:** Utilized for all-caps eyebrow text or small metadata, often paired with slightly increased letter spacing to ensure clarity at small scales.

## Layout & Spacing
The design system utilizes a **Fluid Grid** model based on a 4px baseline unit. 

- **Desktop:** 12-column grid with 24px gutters and 40px margins. Content max-width is capped at 1280px for readability.
- **Tablet:** 8-column grid with 24px gutters and 32px margins.
- **Mobile:** 4-column grid with 16px gutters and 16px margins.

Spacing follows a geometric progression to ensure consistent rhythm across components and page sections.

## Elevation & Depth
Depth is achieved through **Tonal Layers** and extremely soft **Ambient Shadows**. 

- **Level 0 (Base):** The main background color (#F4F7F9).
- **Level 1 (Cards/Containers):** Pure white (#FFFFFF) surfaces with a subtle 1px border (#E2E8F0) and no shadow for a flat, clean look.
- **Level 2 (Interactive/Floating):** Surfaces that require focus use a soft, large-radius shadow (Blur: 20px, Y: 4px, Color: rgba(0, 0, 0, 0.04)).

Avoid heavy drop shadows; the goal is to feel light and integrated with the background.

## Shapes
This design system uses a **Rounded** shape language to soften the interface and make financial interactions feel less rigid. 

Standard components (buttons, input fields, cards) use a 0.5rem (8px) radius. Larger containers like modals or hero sections use a 1rem (16px) radius to emphasize their containment. Use "pill" shapes exclusively for tags, status indicators, and toggle switches.

## Components
- **Buttons:** Primary buttons feature a solid primary color fill with white text. Secondary buttons use an outline style with 1.5px stroke. Hover states involve a slight darkening of the fill or a soft background tint for ghost buttons.
- **Input Fields:** Use a 1px border in a neutral-mid tone. Focus states transition the border to the primary color with a subtle 2px outer glow.
- **Cards:** White background with 8px corner radius. Group related data within cards using 16px internal padding.
- **Chips/Tags:** Pill-shaped with low-opacity background tints (e.g., Success = Green tint, Warning = Amber tint) and matching dark text.
- **Lists:** Clean rows separated by 1px horizontal lines. High contrast for primary information and tertiary colors for secondary metadata.
- **Interactive Elements:** Checkboxes and radio buttons use the primary color for selected states and provide clear haptic-like visual feedback on click.