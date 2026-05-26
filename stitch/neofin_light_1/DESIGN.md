---
name: NeoFin Light
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#3a494a'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#6a7a7b'
  outline-variant: '#b9caca'
  surface-tint: '#00696e'
  primary: '#00696e'
  on-primary: '#ffffff'
  primary-container: '#00f5ff'
  on-primary-container: '#006c71'
  inverse-primary: '#00dce5'
  secondary: '#9500ca'
  on-secondary: '#ffffff'
  secondary-container: '#bb00fc'
  on-secondary-container: '#fffbff'
  tertiary: '#ad009b'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffd0ef'
  on-tertiary-container: '#b2009f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#63f7ff'
  primary-fixed-dim: '#00dce5'
  on-primary-fixed: '#002021'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#f8d8ff'
  secondary-fixed-dim: '#ecb2ff'
  on-secondary-fixed: '#320047'
  on-secondary-fixed-variant: '#74009f'
  tertiary-fixed: '#ffd7f0'
  tertiary-fixed-dim: '#fface8'
  on-tertiary-fixed: '#3a0033'
  on-tertiary-fixed-variant: '#840076'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
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
  unit: 8px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
  container-max: 1200px
---

## Brand & Style

The design system is a sophisticated fusion of **Glassmorphism** and **Modern Minimalism**, tailored for a forward-thinking financial technology audience. It evokes a sense of clarity, precision, and high-tech optimism. 

The brand personality is "Luminous Professionalism"—it bridges the gap between the reliability of traditional banking and the energetic innovation of Web3. By utilizing a bright, airy canvas punctuated by vibrant neon accents, the UI feels fast, responsive, and approachable while maintaining the serious contrast required for data-heavy financial environments.

## Colors

The palette is anchored by a pristine **Off-White (#F8F9FA)** background to reduce eye strain and provide a premium feel. 

*   **Primary (Teal):** Used for growth indicators, primary action buttons, and active states.
*   **Secondary (Purple):** Used for investment categories and secondary brand elements.
*   **Tertiary (Pink):** Reserved for high-priority alerts, spending categories, and decorative accents in data viz.
*   **Typography:** We use a high-contrast ink-black for headlines to ensure maximum readability against the translucent glass layers. 
*   **Glass Accents:** Transparent white layers with a 20px-40px backdrop blur create the signature depth of the design system.

## Typography

This design system exclusively utilizes **Hanken Grotesk**, a contemporary sans-serif that balances geometric clarity with functional legibility. 

Hierarchy is established through significant weight shifts. Headlines use a Bold (700) weight with tight letter-spacing to appear "tech-forward" and impactful. Body text remains at a Regular (400) weight to ensure clarity within glass containers. Labels are set in Semi-Bold (600) with slight tracking to assist in quick scanning of financial metrics and UI metadata.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a strict 8px spacing scale. 

- **Mobile:** A 4-column system with 16px gutters and 20px side margins. Elements are predominantly stacked to maintain vertical rhythm.
- **Desktop:** A 12-column system with 24px gutters. Content is housed within card-based "glass" modules that can span varying column widths (typically 3, 4, or 6 columns).
- **Rhythm:** Use "Safe Areas" around glass cards to prevent visual clutter; inner padding for cards should never drop below 24px (3 units) to maintain the airy, premium aesthetic.

## Elevation & Depth

Depth is achieved through **Glassmorphism** rather than traditional heavy shadows.

1.  **Base Layer:** The solid #F8F9FA background.
2.  **Surface Layer:** Semi-transparent white (#FFFFFF at 70%) with a `backdrop-filter: blur(20px)`.
3.  **Shadows:** Shadows are highly diffused and low-opacity. Use a subtle `0px 10px 30px rgba(0, 0, 0, 0.04)` to lift glass cards off the base layer.
4.  **Edge Treatment:** A thin, 1px semi-transparent white border (#FFFFFF at 40%) is applied to the inside of glass cards to simulate the "catch-light" on the edge of a physical pane of glass.

## Shapes

The shape language is consistently **Rounded**, reinforcing the approachable and modern nature of the brand. 

Standard components (Cards, Inputs) utilize a **16px (1rem)** radius. Smaller interactive elements like chips or nested buttons may use a **8px (0.5rem)** radius. The interaction of these rounded corners creates a nested "squircle" effect that feels organic and fluid. Avoid sharp corners entirely to maintain the soft-tech aesthetic.

## Components

### Buttons
- **Primary:** Solid neon Teal or Purple with black text. High saturation to act as the focal point.
- **Glass/Secondary:** Transparent background with the 20px blur and a subtle 1px border.

### Cards
All cards must use the glassmorphism stack. Background-tinted cards (e.g., a subtle teal tint for a "Balance" card) should maintain 70% opacity to ensure the background remains visible through the blur.

### Inputs
Search bars and text fields should use a slightly more opaque white (85-90%) than the standard cards to indicate "interactivity" and depth. Use a 1px border that darkens slightly on focus.

### Chips & Tags
Used for filtering and categorization. Use solid black for inactive states (as seen in the reference) and vibrant neons for active states.

### Data Visualization
Charts should use "Glow" effects. Lines and bars in neon colors should have a subtle outer glow (drop shadow with the same color as the stroke) to simulate a light-emissive screen.