---
name: NeoFin Dark Mode
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#fff3f6'
  on-tertiary: '#60004a'
  tertiary-container: '#ffcbe6'
  on-tertiary-container: '#b2008b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#ffd8eb'
  tertiary-fixed-dim: '#ffaedd'
  on-tertiary-fixed: '#3b002c'
  on-tertiary-fixed-variant: '#880069'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
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
  headline-lg-mobile:
    fontFamily: Ubuntu
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  title-md:
    fontFamily: Ubuntu
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
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
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
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
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1440px
---

## Brand & Style
The brand personality is high-tech, precision-oriented, and sophisticated. It targets a modern audience comfortable with fintech and digital assets, evoking a sense of security and forward-thinking innovation.

The design style is a blend of **Minimalism** and **Glassmorphism**, specifically tailored for a dark environment. It utilizes deep slate backgrounds, translucent overlays, and vibrant accent glows to create a premium, immersive financial dashboard experience.

## Colors
The palette is built on a "Deep Space" foundation using the neutral base for surfaces. The primary color is a high-frequency cyan for critical actions and data visualization. The secondary purple and tertiary pink are used for secondary data sets and gradient accents.

- **Primary:** Electric Cyan for highlights and primary CTAs.
- **Secondary:** Neon Purple for accentuation and depth.
- **Surface:** A range of deep slates and blacks to maintain high legibility in low-light environments.

## Typography
This design system utilizes **Ubuntu** across all levels to provide a technical yet accessible feel. The unique curves of the Ubuntu typeface balance the sharp geometric layout.

- **Headlines:** Set with tight letter-spacing and bold weights for a commanding presence.
- **Body:** Standardized at 16px for optimal readability on dark backgrounds.
- **Labels:** Uppercase application is recommended for the `label-md` level when used in navigation or small headers to enhance the "pro-tool" aesthetic.

## Layout & Spacing
The layout follows a **Fixed Grid** system for desktop, centering a 1440px container. A 12-column structure is used with 24px gutters.

- **Mobile:** 4-column grid with 16px side margins.
- **Tablet:** 8-column grid with 24px side margins.
- **Desktop:** 12-column grid.
Spacing increments follow a 4px base unit to ensure alignment and rhythmic consistency across all dashboard components.

## Elevation & Depth
Depth is expressed through **Glassmorphism** and **Tonal Layers**. Shadows are rarely used; instead, depth is created by:
1. **Background Blurs:** Surfaces use a 20px backdrop filter blur with 10% white opacity for "elevated" modals.
2. **Inner Glows:** A 1px top-border with 15% white opacity mimics a light source from above.
3. **Tonal Steps:** The further "forward" an object is, the lighter its slate-gray background becomes.

## Shapes
The shape language is defined by a **Rounded** aesthetic.
- Base components (buttons, inputs) use a 0.5rem (8px) radius.
- Larger containers and cards use a 1rem (16px) radius.
- Interactive chips or small status indicators may use 1.5rem (24px) for a "pill" appearance to distinguish them from structural elements.

## Components
- **Buttons:** Primary buttons feature a subtle outer glow using the primary color. Text is high-contrast (usually dark) against the bright primary background.
- **Cards:** Defined by a 1px border using a 10% white stroke. Backgrounds are slightly lighter than the canvas.
- **Inputs:** Focus states use a 1px solid primary color border with a soft outer glow.
- **Lists:** Items are separated by 1px lines of 5% white opacity; hover states use a 2% white overlay.
- **Data Visualization:** Charts should utilize the Primary, Secondary, and Tertiary colors for clarity against the dark canvas.