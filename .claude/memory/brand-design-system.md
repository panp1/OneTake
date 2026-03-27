---
name: OneForma / Centific Brand Design System
description: Extracted design tokens from oneforma.com (the child brand Steven oversees). Use these for the intake app to match their existing brand from day 1.
type: reference
---

## OneForma Brand Design System (Extracted March 27, 2026)

**Source:** https://www.oneforma.com/
**Parent company:** Centific (https://www.centific.com/)
**Steven's role:** Digital Marketing Manager overseeing OneForma

### Colors

| Token | Value | Usage |
|---|---|---|
| **Background** | `#FFFFFF` | Primary page background (LIGHT theme) |
| **Text Primary** | `#000000` | Headings, body text |
| **Button Primary** | `#32373C` | Dark charcoal buttons |
| **Button Text** | `#FFFFFF` | White text on buttons |
| **Error/Alert** | `#BF1722` | Error states |
| **Gradient 1** | `linear-gradient(135deg, rgb(6,147,227) 0%, rgb(155,81,224) 100%)` | Cyan-blue to purple |
| **Gradient 2** | `linear-gradient(135deg, rgb(74,234,220) 0%...rgb(254,248,76) 100%)` | Cool to warm spectrum |
| **Gradient 3** | `linear-gradient(135deg, rgb(255,203,112) 0%, rgb(199,81,192) 50%, rgb(65,88,208) 100%)` | Luminous dusk |

**Note:** OneForma is LIGHT theme, not dark. The intake app should match this — clean white backgrounds, dark text, charcoal buttons. NOT the VYRA dark theme.

### Typography

| Element | Font | Size |
|---|---|---|
| **Font stack** | `-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Helvetica Neue", Arial, sans-serif` | System fonts |
| **Small** | System | 13px |
| **Medium** | System | 20px |
| **Large** | System | 36px |
| **X-Large** | System | 42px |

**Note:** They use system fonts — no custom web fonts. This is GOOD for the intake app: no font loading, instant rendering, matches their site perfectly.

### Button Styles

```css
/* Primary button */
background: #32373c;
color: #ffffff;
border-radius: 9999px; /* Pill-shaped */
padding: calc(.667em + 2px) calc(1.333em + 2px);
font-size: 1.125em;
```

**All buttons are pill-shaped (rounded-full in Tailwind).**

### Shadows

| Style | Value |
|---|---|
| Natural | `6px 6px 9px rgba(0, 0, 0, 0.2)` |
| Deep | `12px 12px 50px rgba(0, 0, 0, 0.4)` |
| Sharp | `6px 6px 0px rgba(0, 0, 0, 0.2)` |

### Spacing Scale

| Token | Value |
|---|---|
| 20 | 0.44rem |
| 30 | 0.67rem |
| 40 | 1rem |
| 50 | 1.5rem |
| 60 | 2.25rem |
| 70 | 3.38rem |
| 80 | 5.06rem |

### Navigation Structure

```
Header: Logo (left) → "How OneForma Works" | "Domain Experts" | "Jobs" → "Log in" | "Join" (right)
```

### Overall Aesthetic

- **LIGHT theme** (white backgrounds — opposite of VYRA's dark theme)
- Clean, professional, inclusive
- System fonts (no custom typography)
- Pill-shaped buttons (#32373C charcoal)
- Illustrative imagery (diverse people, tech-forward)
- Minimal shadows and effects
- Generous whitespace
- WordPress-based (utility classes like .wp-block-button)

### Brand Assets Found

- Logo: `oneforma-logo.svg` (color), `oneforma-logo-white.png` (footer)
- Icons: Annotation, Data Collection, Judging, Transcription, Translation (SVG)
- Category icons: AI chip, community, explore, certification badge

### Design Implications for Intake App

1. **LIGHT MODE** — not dark. White bg, dark text, charcoal accents.
2. **System fonts** — `-apple-system, "Segoe UI", Roboto` — no Google Fonts needed
3. **Pill buttons** — `rounded-full` in Tailwind, `#32373C` background
4. **Clean and professional** — no flashy gradients on the app itself (save those for ad creatives)
5. **Generous spacing** — use the spacing scale (1rem, 1.5rem, 2.25rem gaps)
6. **Minimal shadows** — subtle natural shadows, not heavy elevated effects
7. **Accent gradients** — the cyan-blue-to-purple gradient can be used sparingly for status indicators or progress bars

### Tailwind Config Mapping

```js
colors: {
  oneforma: {
    charcoal: '#32373C',
    error: '#BF1722',
    white: '#FFFFFF',
    black: '#000000',
    'gradient-start': 'rgb(6,147,227)',    // Cyan-blue
    'gradient-end': 'rgb(155,81,224)',      // Purple
  }
}

fontFamily: {
  sans: ['-apple-system', 'system-ui', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']
}

borderRadius: {
  pill: '9999px'
}
```

**Why:** Every UI element in the intake app should look like it belongs on oneforma.com. When the VP of Product sees this app, it should feel like an official internal tool, not a side project.

**How to apply:** Use these exact tokens in the Tailwind config. Light background, charcoal buttons, system fonts, pill-shaped buttons, generous spacing. The app should feel like OneForma's internal admin panel.
