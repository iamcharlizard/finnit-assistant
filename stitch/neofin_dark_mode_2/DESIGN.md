---
name: NeoFin Dark Mode
colors:
  surface: '#12131a'
  surface-dim: '#12131a'
  surface-bright: '#383940'
  surface-container-lowest: '#0d0e14'
  surface-container-low: '#1a1b22'
  surface-container: '#1e1f26'
  surface-container-high: '#292931'
  surface-container-highest: '#33343c'
  on-surface: '#e3e1eb'
  on-surface-variant: '#c7c5d3'
  inverse-surface: '#e3e1eb'
  inverse-on-surface: '#2f3037'
  outline: '#908f9d'
  outline-variant: '#464651'
  surface-tint: '#bfc2ff'
  primary: '#bfc2ff'
  on-primary: '#1f247c'
  primary-container: '#8389e3'
  on-primary-container: '#171c75'
  inverse-primary: '#5055ac'
  secondary: '#ffabf2'
  on-secondary: '#5b005a'
  secondary-container: '#781e74'
  on-secondary-container: '#f890ec'
  tertiary: '#27dec1'
  on-tertiary: '#00382f'
  tertiary-container: '#00a38c'
  on-tertiary-container: '#003028'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0e0ff'
  primary-fixed-dim: '#bfc2ff'
  on-primary-fixed: '#030469'
  on-primary-fixed-variant: '#373d93'
  secondary-fixed: '#ffd7f5'
  secondary-fixed-dim: '#ffabf2'
  on-secondary-fixed: '#380037'
  on-secondary-fixed-variant: '#781e74'
  tertiary-fixed: '#55fbdd'
  tertiary-fixed-dim: '#27dec1'
  on-tertiary-fixed: '#00201a'
  on-tertiary-fixed-variant: '#005144'
  background: '#12131a'
  on-background: '#e3e1eb'
  surface-variant: '#33343c'
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
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-lg:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 44px
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
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The design system is built on a "Dark Neon" aesthetic, blending the high-tech precision of a financial platform with the immersive, futuristic energy of a nocturnal metropolis. It targets a tech-savvy audience that values speed, clarity, and a premium digital experience. 

The visual style is a fusion of **Glassmorphism** and **Modern Minimalist** principles. By leveraging translucent surfaces and vibrant, luminescent accents against a deep charcoal void, the UI creates a sense of depth and focus. The emotional response is one of confidence, innovation, and "quiet luxury"—where complex financial data feels breathable and manageable.

## Colors

The palette is anchored by a deep charcoal neutral to minimize eye strain and maximize the impact of functional colors. 

- **Primary (Neon Blue):** Used for primary actions, focus states, and key data points like "Income" or "Balance."
- **Secondary (Neon Pink):** Used for decorative accents, notifications, and contrasting data sets to ensure rapid visual scanning.
- **Tertiary (Mint Green):** Reserved for "success" states, positive growth trends, and confirmed transaction statuses.
- **Surface Strategy:** The background uses a near-black canvas, while the main containers utilize the primary neutral. Glass elements are defined by a 70% opacity fill with a heavy background blur (20px+) to maintain legibility.

## Typography

This design system utilizes a clean, geometric sans-serif stack to ensure high legibility in low-light environments. 

**Hanken Grotesk** is used for headlines and high-impact numeric data to provide a sharp, contemporary edge. **Manrope** handles all functional body copy and labels, offering a balanced and trustworthy tone. 

In financial contexts, "Headline-XL" is reserved for total balance views, while "Numeric-LG" is optimized for transaction lists. All Spanish text should maintain a tight line height to prevent excessive vertical scrolling, given that Spanish phrases are often longer than their English counterparts.

## Layout & Spacing

The design system employs a **Fluid Grid** model with a base-4 spacing scale. 

- **Mobile:** A 4-column layout with 20px side margins. Content cards generally span the full width of the column set.
- **Desktop:** A 12-column layout with a maximum container width of 1440px. Gutters are fixed at 24px to provide ample "air" between complex data widgets.
- **Rhythm:** Spacing follows a strict hierarchical progression. MD (16px) is the standard for internal card padding, while LG (24px) is used to separate distinct layout sections.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Luminescent Glows** rather than traditional black shadows.

1.  **Level 0 (Base):** The dark canvas (#0B0C10).
2.  **Level 1 (Cards):** Deep charcoal (#17181F) with a 1px subtle border at 10% white opacity.
3.  **Level 2 (Active/Glass):** Frosted glass surfaces with a `backdrop-filter: blur(24px)`. These elements use a slight inner glow of the primary color to suggest they are "lit" from beneath.
4.  **Level 3 (Pop-ups/Modals):** Full glass surfaces with a outer "neon bloom"—a soft, diffused shadow (blur 40px, opacity 15%) tinted with the primary blue or secondary pink to signal extreme priority.

## Shapes

The shape language is consistently **Rounded**. This softens the "technical" feel of financial data, making the app feel more approachable.

- **Primary Cards & Modals:** Use `rounded-xl` (24px on desktop, 16px on mobile) to create a friendly, "hand-held" container feel.
- **Buttons & Inputs:** Use `rounded-lg` (16px) for a modern, ergonomic touch target.
- **Interactive Tags/Chips:** These are fully pill-shaped (32px+) to distinguish them from actionable buttons.

## Components

### Botones (Buttons)
Primary buttons use a solid gradient from Primary Blue to Secondary Pink with white text. Secondary buttons are "Ghost" style with a glass background and a 1px primary-colored border.

### Tarjetas de Gastos (Expense Cards)
Cards feature a subtle top-down gradient. High-priority information (like the amount) is placed at the top-right in `numeric-lg`. Small micro-charts (sparklines) should be embedded using the Tertiary Mint Green for growth and Secondary Pink for decline.

### Campos de Entrada (Input Fields)
Inputs are dark-themed with a translucent fill. Upon focus, the border transitions from neutral to a vibrant Primary Blue glow. Placeholder text is in Spanish (e.g., "Buscar transacción...").

### Gráficos (Charts)
Charts should avoid solid fills. Use line graphs with a "neon path" effect—a 2px solid line with a matching 8px blurred glow behind it.

### Vidrio de Superposición (Glass Overlays)
For bottom sheets or "Quick Action" menus, use a high-blur glass effect that occupies 40-60% of the screen height, ensuring the underlying content remains visible but obscured to maintain context.