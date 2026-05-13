# ElevenLabs — Style Reference
> Architect's blueprint on warm vellum — Waldenburg weight-300 headlines at 48px with -0.02em tracking anchored against an eggshell ground, pure black pill buttons as the only punctuation.

**Theme:** light

ElevenLabs feels like a museum label next to a working instrument — type-first, almost severe, yet alive with subtle warmth in the off-white surfaces. The page background #fdfcfc (named 'Eggshell' in the CSS tokens) is barely-not-white, giving the layout a slight papery warmth that black text lands on with extraordinary weight. Headlines use Waldenburg at weight 300 with -0.02em tracking, a custom serif that whispers where competitors shout — the counter-intuitive choice of a light-weight, slightly classical typeface for an AI voice platform creates authority through restraint. The entire chromatic palette is suppressed to near-zero saturation: #e5e5e5 borders, #777169 secondary text (a warm stone gray), and #fdfcfc surfaces — the only true color breaks come from pill-shaped black CTA buttons and the small colored avatar dots on voice profiles. The product UI card floats on a hairline shadow (0px 0px 1px rgba(0,0,0,0.4)) rather than elevation depth, keeping everything in the same visual plane.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Eggshell | `#fdfcfc` | `--color-eggshell` | Page background and primary surface — the near-white warmth distinguishes this from pure #ffffff, landing type with extra weight |
| Powder | `#f5f3f1` | `--color-powder` | Secondary surface, hover states, subtle section backgrounds |
| Chalk | `#e5e5e5` | `--color-chalk` | All borders, dividers, card outlines, button outlines — the single border color used universally |
| Fog | `#b1b0b0` | `--color-fog` | Disabled states, placeholder elements, logo grid grayscale treatment |
| Gravel | `#777169` | `--color-gravel` | Secondary body text, nav items, subheadings, captions — warm stone undertone separates it from a cold gray |
| Slate | `#a59f97` | `--color-slate` | Tertiary text, icon strokes, deemphasized labels |
| Cinder | `#57534` | `--color-cinder` | Mid-tone text, secondary headings on light surfaces |
| Obsidian | `#000000` | `--color-obsidian` | Primary text, filled CTA buttons (background), logo mark — the absolute black against eggshell creates 20.5:1 contrast |
| Signal Blue | `#0447ff` | `--color-signal-blue` | ElevenAgents product dot / brand avatar accent — appears only in small circular UI elements, not in text or buttons |
| Ember | `#ff4704` | `--color-ember` | ElevenCreative product dot / brand avatar accent — small circular UI indicator only |
| Voice Spectrum | `conic-gradient(from 180deg, rgb(61, 117, 216) 11.5931deg, rgb(42, 104, 210) 26.317deg, rgb(117, 190, 229) 32.3924deg, rgb(82, 208, 233) 38.9146deg, rgb(33, 89, 186) 75.3508deg, rgb(58, 116, 218) 85.0388deg, rgb(108, 215, 236) 94.5293deg, rgb(90, 185, 241) 122.11deg, rgb(51, 161, 229) 129.967deg, rgb(31, 95, 207) 136.719deg, rgb(44, 84, 202) 144.313deg, rgb(58, 158, 207) 175.985deg, rgb(49, 103, 197) 183.869deg, rgb(173, 232, 243) 201.635deg, rgb(216, 241, 245) 224.865deg, rgb(165, 219, 230) 239.729deg, rgb(43, 157, 214) 268.165deg, rgb(174, 224, 233) 286.211deg, rgb(32, 186, 208) 329.654deg, rgb(30, 83, 176) 343.551deg, rgb(47, 64, 210) 359.255deg)` | `--color-voice-spectrum` | Logo mark conic gradient — the spinning blue-cyan wheel that is the ElevenLabs logomark |

## Tokens — Typography

### Waldenburg — All display and section headlines. Weight 300 is the signature move — a light-weight custom serif for an AI platform inverts every SaaS convention of bold grotesque headlines. At 48px with -0.02em tracking the letters breathe and lean slightly classical. No substitute fully captures it. · `--font-waldenburg`
- **Substitute:** Cormorant Garamond 300, or Libre Baskerville 300
- **Weights:** 300
- **Sizes:** 32px, 36px, 48px
- **Line height:** 1.08–1.17
- **Letter spacing:** -0.64px at 32px, -0.72px at 36px, -0.96px at 48px
- **Role:** All display and section headlines. Weight 300 is the signature move — a light-weight custom serif for an AI platform inverts every SaaS convention of bold grotesque headlines. At 48px with -0.02em tracking the letters breathe and lean slightly classical. No substitute fully captures it.

### WaldenburgFH — Navigation product labels (ElevenCreative, ElevenAgents, ElevenAPI) and icon badges. The 0.05em wide tracking at weight 700 creates a compressed, stamp-like label style — tight caps energy in a small footprint. · `--font-waldenburgfh`
- **Substitute:** Inter 700 with letter-spacing 0.7px
- **Weights:** 700
- **Sizes:** 14px
- **Line height:** 1.10
- **Letter spacing:** 0.7px at 14px
- **Role:** Navigation product labels (ElevenCreative, ElevenAgents, ElevenAPI) and icon badges. The 0.05em wide tracking at weight 700 creates a compressed, stamp-like label style — tight caps energy in a small footprint.

### Inter — All body copy, UI labels, navigation, buttons, captions, footer. Weight 400 for body and descriptive text; weight 500 for interactive labels and emphasis. The 0.01em letter-spacing is a subtle open tracking that keeps small sizes legible on eggshell. · `--font-inter`
- **Substitute:** Inter (Google Fonts)
- **Weights:** 400, 500
- **Sizes:** 10px, 12px, 13px, 14px, 15px, 16px, 18px, 20px
- **Line height:** 1.0–2.06
- **Letter spacing:** 0.1px–0.2px across all sizes
- **OpenType features:** `"kern" 1`
- **Role:** All body copy, UI labels, navigation, buttons, captions, footer. Weight 400 for body and descriptive text; weight 500 for interactive labels and emphasis. The 0.01em letter-spacing is a subtle open tracking that keeps small sizes legible on eggshell.

### Geist Mono — Code snippets, technical annotations, voice-text preview inline markers like [sarcastic] and [whispers]. Monospace signals machine-generated or technical content within prose. · `--font-geist-mono`
- **Substitute:** JetBrains Mono 400, or IBM Plex Mono 400
- **Weights:** 400
- **Sizes:** 13px
- **Line height:** 1.69
- **Role:** Code snippets, technical annotations, voice-text preview inline markers like [sarcastic] and [whispers]. Monospace signals machine-generated or technical content within prose.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 10px | 1.2 | — | `--text-caption` |
| body | 14px | 1.43 | — | `--text-body` |
| body-lg | 16px | 1.5 | — | `--text-body-lg` |
| subheading | 18px | 1.44 | — | `--text-subheading` |
| heading-sm | 20px | 1.4 | — | `--text-heading-sm` |
| heading | 32px | 1.17 | -0.64px | `--text-heading` |
| heading-lg | 36px | 1.13 | -0.72px | `--text-heading-lg` |
| display | 48px | 1.08 | -0.96px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 72 | 72px | `--spacing-72` |
| 96 | 96px | `--spacing-96` |
| 160 | 160px | `--spacing-160` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 9999px |
| cards | 16px |
| badges | 12px |
| inputs | 4px |
| modals | 24px |
| panels | 20px |
| buttons | 9999px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(0, 0, 0, 0.075) 0px 0px 0px 0.5px inset` | `--shadow-subtle` |
| subtle-2 | `rgba(0, 0, 0, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) ...` | `--shadow-subtle-2` |
| subtle-3 | `rgba(0, 0, 0, 0.1) 0px 0px 0px 0.5px inset` | `--shadow-subtle-3` |
| subtle-4 | `rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0...` | `--shadow-subtle-4` |
| subtle-5 | `rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset` | `--shadow-subtle-5` |
| subtle-6 | `rgb(235, 232, 228) 0px 0px 0px 0.5px inset` | `--shadow-subtle-6` |
| subtle-7 | `rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0...` | `--shadow-subtle-7` |
| subtle-8 | `rgba(255, 255, 255, 0.6) 0px 0px 0px 1px inset` | `--shadow-subtle-8` |
| subtle-9 | `rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0...` | `--shadow-subtle-9` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80-120px
- **Card padding:** 16-24px
- **Element gap:** 8-12px

## Components

### Primary Pill Button (Filled)
**Role:** Primary CTA — Sign up, Play, Submit

Background #000000, text #fdfcfc, border-radius 9999px, padding 0px 16px (height driven by line-height), border 1px solid #e5e5e5. Shadow: rgba(0,0,0,0.06) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 1px 2px, rgba(0,0,0,0.04) 0px 2px 4px. WaldenburgFH 700 14px 0.05em tracking for product-label buttons; Inter 500 14px for general CTAs.

### Ghost Pill Button (Outline)
**Role:** Secondary actions — Contact sales, Log in, Read all stories

Background #ffffff, text #000000, border-radius 9999px, padding 0px 12px, border 1px solid #e5e5e5. Same shadow system as filled button. The white fill over eggshell background gives a subtle float-off-page effect.

### Rounded Outline Button (Tab/Toggle)
**Role:** Segmented control tabs — ElevenCreative, ElevenAgents, ElevenAPI selector

Background transparent, text #000000, border-radius 18px, padding 8px 12px, border 1px solid #e5e5e5. WaldenburgFH 700 14px for product name labels. Active state upgrades to filled pill.

### Compact Action Button
**Role:** Inline UI actions — pagination arrows, expand/collapse controls

Background transparent, text #000000, border-radius 12px, padding 0px 8px left / 12px right, border 1px solid #e5e5e5. Smaller footprint for secondary UI controls inside cards.

### Product Demo Card
**Role:** Interactive voice-player UI card embedded in hero section

Background #ffffff, border-radius 16px, box-shadow rgba(0,0,0,0.4) 0px 0px 1.143px 0px, rgba(0,0,0,0.04) 0px 2px 4px. Contains a voice list (Inter 14px #000000 names, Inter 13px #777169 descriptors), a text input area, and a Play pill button. Inner elements use 4px and 12px radii for sub-controls.

### Voice List Item
**Role:** Individual voice selection row inside demo card

Full-width row with 32px circular avatar (colored gradient or flat color), voice name in Inter 500 14px #000000, voice descriptor in Inter 400 13px #777169. Active/selected row gets background #f5f3f1 with 4px radius highlight. Row height ~40px, horizontal padding 12px.

### Navigation Bar
**Role:** Top global navigation

Background #fdfcfc, height 36px, max-width 1200px centered. Logo left-aligned. Nav links in Inter 400 14px #000000. Product sub-items in WaldenburgFH 700 14px 0.05em tracking. 'Log in' as Ghost Pill, 'Sign up' as Filled Pill. Border-bottom 1px solid #e5e5e5 on scroll.

### Section Divider Label
**Role:** Eyebrow text above section headings

Inter 400 14px #777169 (Gravel), no background, no border. Placed 8-12px above the Waldenburg heading. Communicates category without visual decoration.

### Text Input (Transparent)
**Role:** Inline text editors and search fields

Background transparent, border-radius 0px, border-bottom 1px solid #000000, padding 12px 20px, text Inter 400 14px #000000, placeholder Inter 400 14px #a59f97. No box shadow. Stripped-back, editorial-form input style.

### Text Input (Contained)
**Role:** Form inputs with white background

Background #ffffff, border 1px solid #e5e5e5, border-radius 0px, padding 12px 20px, text Inter 400 14px #000000. Inner shadow rgba(0,0,0,0.075) 0px 0px 0px 0.5px inset for depth on white surface.

### Feature Platform Card (Ghost)
**Role:** Two-column product description cards — ElevenCreative / ElevenAgents

Background transparent, border 0, radius 0px, padding 0. Heading in Inter 500 16px #000000, body in Inter 400 14px #777169. No elevation — these are pure typographic blocks on the eggshell ground, differentiated only by the colored dot prefix (Ember #ff4704 or Signal Blue #0447ff).

## Do's and Don'ts

### Do
- Use Waldenburg 300 with -0.02em letter-spacing for all headings at 32px and above — never substitute a heavier weight.
- Apply 9999px border-radius to every button and pill tag; use 16-20px for cards and panels; use 0px for bare input fields.
- Keep the entire color palette at near-zero saturation: #000000 text, #fdfcfc background, #e5e5e5 borders, #777169 secondary text. Reserve #ff4704 and #0447ff for product avatar dots only.
- Use the inset shadow rgba(0,0,0,0.075) 0px 0px 0px 0.5px inset on white UI surfaces that sit on eggshell — it replaces border outlines on cards without adding visual weight.
- Use Geist Mono 400 13px only for machine-generated or technical inline annotations (e.g. [whispers], [sarcastic]) and code snippets.
- Render all third-party logos in the social proof grid at #b1b0b0 (Fog) with no hover color change — chromatic logos break the achromatic discipline.
- Size section gaps at 80-120px vertical spacing between major content blocks; use 8-12px for element-level gaps within components.

### Don't
- Never use a weight above 300 for Waldenburg display headlines — weight 700 belongs only to WaldenburgFH product-label contexts at 14px.
- Never introduce saturated color for text, background fills, or buttons — the Signal Blue #0447ff and Ember #ff4704 are reserved exclusively for 8-16px avatar/dot indicators.
- Never apply box-shadow elevation larger than rgba(0,0,0,0.4) 0px 0px 1.143px — ElevenLabs cards float by 1px shadow, not by depth layering.
- Never use a pure white #ffffff background for page surfaces — use #fdfcfc (Eggshell) for all base surfaces to preserve the warm papery ground.
- Never place Inter body text below 13px in product UI contexts or below 14px in marketing prose — the 0.01em tracking needs minimum size to work.
- Never use more than two button variants in the same visual cluster — one filled black pill (primary) + one white ghost pill (secondary) is the maximum combination.
- Never apply border-radius to input fields — inputs use 0px radius, creating an editorial underline-or-box distinction from the rounded interactive elements.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Page Ground | `#fdfcfc` | Base page background — all page-level content sits here |
| 1 | Powder Surface | `#f5f3f1` | Section highlights, active row states, nav hover backgrounds |
| 2 | Card White | `#ffffff` | Interactive demo cards and form inputs that need to pop off the eggshell ground |
| 3 | Obsidian | `#000000` | Primary CTA fill, logo mark, full-bleed dark sections |

## Elevation

ElevenLabs uses only hairline elevation: rgba(0,0,0,0.4) 0px 0px 1.143px with a secondary rgba(0,0,0,0.04) 0px 2px 4px. Cards barely detach from the eggshell surface — they hover rather than float. This flatness keeps all UI elements in the same perceptual plane, matching the editorial, text-first design intention. The inset shadow rgba(0,0,0,0.075) 0px 0px 0px 0.5px is used instead of border-color on white-on-eggshell surfaces.

## Imagery

Product screenshots are the dominant visual — specifically, the interactive voice-player UI shown as a white card with structured list and text area. No lifestyle photography is present. Illustration is absent. The only 'graphic' element is the conic-gradient logomark, a spinning blue-to-cyan color wheel suggesting audio waveforms or voice spectra, contained within a ~24px icon footprint. Voice avatars use small 28-32px circular gradient fills (multicolor mini-spheres) as person-indicators — these are the only chromatic imagery in the UI. Social proof section uses SVG wordmark logos uniformly desaturated to #b1b0b0 Fog. The design is text-dominant: imagery occupies roughly 30% of visual space with the product card; 70% is typographic.

## Layout

Max-width ~1200px centered on eggshell ground. Hero is a two-column asymmetric split: large Waldenburg headline left (60% width) with body text right, followed by two pill buttons. Below the fold, a full-width white product card (border-radius 16px) acts as a live demo embed spanning the full content column. Logo grid is a 6-column × 3-row flat array on white, centered, with generous 24-32px row gaps. Feature descriptions use a 2-column text block layout (no images, purely typographic). Navigation is a slim 36px top bar, likely sticky on scroll, with logo left and auth CTAs right. Section rhythm is seamless — no alternating dark/light bands; the entire page is the same eggshell ground broken only by the white card surfaces and the #f5f3f1 subtle hover zones.

## Agent Prompt Guide

**Quick Color Reference**
- Text (primary): #000000
- Text (secondary): #777169
- Text (tertiary): #a59f97
- Background (page): #fdfcfc
- Background (surface): #f5f3f1
- Card background: #ffffff
- Border (universal): #e5e5e5
- CTA fill: #000000 with #fdfcfc text
- Product dot (Creative): #ff4704
- Product dot (Agents): #0447ff

**Example Component Prompts**

1. **Hero Section**: Eggshell (#fdfcfc) background, max-width 1200px centered, 120px top padding. Two-column layout: left 60% has Waldenburg 300 48px headline #000000 letter-spacing -0.96px line-height 1.08, then 16px gap, then Inter 400 16px #777169 body text, then 24px gap, then row of two buttons. Right 40% empty or decorative. First button: filled pill #000000 bg, #fdfcfc text, 9999px radius, 0px 16px padding, Inter 500 14px. Second button: ghost pill #ffffff bg, #000000 text, 9999px radius, 0px 12px padding, 1px solid #e5e5e5 border.

2. **Product Demo Card**: Background #ffffff, border-radius 16px, box-shadow rgba(0,0,0,0.4) 0px 0px 1.143px, rgba(0,0,0,0.04) 0px 2px 4px. Left panel: tab row of three ghost pills (18px radius, 8px 12px padding, WaldenburgFH 700 14px 0.05em tracking) for ElevenCreative/ElevenAgents/ElevenAPI. Below: voice list rows — 12px padding, 40px height each, circular 28px avatar + Inter 500 14px #000000 name + Inter 400 13px #777169 descriptor. Right panel: text area Inter 400 14px #000000 on white with transparent border, Geist Mono 400 13px for inline [direction] annotations in #777169.

3. **Social Proof Logo Band**: #fdfcfc or #ffffff background, 80px vertical padding. Header row: Inter 400 14px #777169 left label + Ghost Pill Button right ('Read all stories', 9999px, 0px 12px padding, 1px #e5e5e5 border). Logo grid: 6 columns, SVG logos all at #b1b0b0, no hover color, 24px row gap, 40px column gap, logos max-height 28px.

4. **Navigation Bar**: Height 36px, #fdfcfc background, border-bottom 1px solid #e5e5e5. Left: ElevenLabs logomark (conic gradient wheel icon + WaldenburgFH 700 14px wordmark). Center: Inter 400 14px #000000 nav links with 16px gap. Product labels (ElevenCreative, ElevenAgents, ElevenAPI) in WaldenburgFH 700 14px 0.05em tracking. Right: 'Log in' ghost pill (0px 12px padding) + 'Sign up' filled black pill (0px 16px padding).

5. **Two-Column Feature Block**: #fdfcfc background, 80px vertical padding, max-width 1200px. Waldenburg 300 36px headline #000000 letter-spacing -0.72px spanning full width. Below: 2-column equal grid, 32px gap. Each column: 8px colored dot (Ember #ff4704 or Signal Blue #0447ff) + Inter 500 16px #000000 product name + 8px gap + Inter 400 14px #777169 description body.

## WaldenburgFH Label System

WaldenburgFH 700 at 14px with 0.05em letter-spacing (0.7px) is used exclusively for product-family labels: ElevenCreative, ElevenAgents, ElevenAPI. This weight/tracking combination creates a compact stamp identity within navigation tabs and feature pills. Never use WaldenburgFH for body copy or large headings — it exists only at 14px as a labeling system. The 0.05em wide-tracking at a small size creates a monogram-like compressed authority that contrasts with the open, whisper-weight Waldenburg 300 headlines.

## Similar Brands

- **Linear** — Same achromatic palette discipline with a single accent-color confined to UI indicators only, custom-weight typography as brand signature
- **Notion** — Eggshell/near-white page ground with black pill CTAs and editorial type-first layout, serif headline weight against sans body
- **Vercel** — Pure black/white high-contrast CTA system with zero saturated brand color in the marketing UI
- **Anthropic** — Custom serif at light weight for AI product headlines, warm-toned off-white surfaces, deliberate restraint on color expression
- **Perplexity** — Monochrome pill-button system, Inter body at multiple weights, product demo card embedded in hero section

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-eggshell: #fdfcfc;
  --color-powder: #f5f3f1;
  --color-chalk: #e5e5e5;
  --color-fog: #b1b0b0;
  --color-gravel: #777169;
  --color-slate: #a59f97;
  --color-cinder: #57534;
  --color-obsidian: #000000;
  --color-signal-blue: #0447ff;
  --color-ember: #ff4704;
  --color-voice-spectrum: #3d75d8;
  --gradient-voice-spectrum: conic-gradient(from 180deg, rgb(61, 117, 216) 11.5931deg, rgb(42, 104, 210) 26.317deg, rgb(117, 190, 229) 32.3924deg, rgb(82, 208, 233) 38.9146deg, rgb(33, 89, 186) 75.3508deg, rgb(58, 116, 218) 85.0388deg, rgb(108, 215, 236) 94.5293deg, rgb(90, 185, 241) 122.11deg, rgb(51, 161, 229) 129.967deg, rgb(31, 95, 207) 136.719deg, rgb(44, 84, 202) 144.313deg, rgb(58, 158, 207) 175.985deg, rgb(49, 103, 197) 183.869deg, rgb(173, 232, 243) 201.635deg, rgb(216, 241, 245) 224.865deg, rgb(165, 219, 230) 239.729deg, rgb(43, 157, 214) 268.165deg, rgb(174, 224, 233) 286.211deg, rgb(32, 186, 208) 329.654deg, rgb(30, 83, 176) 343.551deg, rgb(47, 64, 210) 359.255deg);

  /* Typography — Font Families */
  --font-waldenburg: 'Waldenburg', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-waldenburgfh: 'WaldenburgFH', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.44;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 32px;
  --leading-heading: 1.17;
  --tracking-heading: -0.64px;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.13;
  --tracking-heading-lg: -0.72px;
  --text-display: 48px;
  --leading-display: 1.08;
  --tracking-display: -0.96px;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-96: 96px;
  --spacing-160: 160px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80-120px;
  --card-padding: 16-24px;
  --element-gap: 8-12px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 30px;
  --radius-full: 9999px;

  /* Named Radii */
  --radius-tags: 9999px;
  --radius-cards: 16px;
  --radius-badges: 12px;
  --radius-inputs: 4px;
  --radius-modals: 24px;
  --radius-panels: 20px;
  --radius-buttons: 9999px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.075) 0px 0px 0px 0.5px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;
  --shadow-subtle-3: rgba(0, 0, 0, 0.1) 0px 0px 0px 0.5px inset;
  --shadow-subtle-4: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 4px 4px 0px;
  --shadow-subtle-5: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
  --shadow-subtle-6: rgb(235, 232, 228) 0px 0px 0px 0.5px inset;
  --shadow-subtle-7: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;
  --shadow-subtle-8: rgba(255, 255, 255, 0.6) 0px 0px 0px 1px inset;
  --shadow-subtle-9: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 1px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;

  /* Surfaces */
  --surface-page-ground: #fdfcfc;
  --surface-powder-surface: #f5f3f1;
  --surface-card-white: #ffffff;
  --surface-obsidian: #000000;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-eggshell: #fdfcfc;
  --color-powder: #f5f3f1;
  --color-chalk: #e5e5e5;
  --color-fog: #b1b0b0;
  --color-gravel: #777169;
  --color-slate: #a59f97;
  --color-cinder: #57534;
  --color-obsidian: #000000;
  --color-signal-blue: #0447ff;
  --color-ember: #ff4704;
  --color-voice-spectrum: #3d75d8;

  /* Typography */
  --font-waldenburg: 'Waldenburg', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-waldenburgfh: 'WaldenburgFH', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.44;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 32px;
  --leading-heading: 1.17;
  --tracking-heading: -0.64px;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.13;
  --tracking-heading-lg: -0.72px;
  --text-display: 48px;
  --leading-display: 1.08;
  --tracking-display: -0.96px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-96: 96px;
  --spacing-160: 160px;

  /* Border Radius */
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-3xl-2: 30px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.075) 0px 0px 0px 0.5px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;
  --shadow-subtle-3: rgba(0, 0, 0, 0.1) 0px 0px 0px 0.5px inset;
  --shadow-subtle-4: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 4px 4px 0px;
  --shadow-subtle-5: rgba(0, 0, 0, 0.1) 0px 0px 0px 1px inset;
  --shadow-subtle-6: rgb(235, 232, 228) 0px 0px 0px 0.5px inset;
  --shadow-subtle-7: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;
  --shadow-subtle-8: rgba(255, 255, 255, 0.6) 0px 0px 0px 1px inset;
  --shadow-subtle-9: rgba(0, 0, 0, 0.4) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 1px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 4px 0px;
}
```


# Apple — Style Reference
> Gallery wall at natural light — enormous type casts shadows on a white surface, color enters only as product.

**Theme:** light

Apple's MacBook Neo product page radiates cool luminosity — a gallery-white canvas where enormous weight-700 headlines at 80-96px dominate above feather-light body copy, creating a tension between mass and air. The page background stays #f5f5f7, one step off pure white, giving cards and content wells a surface-lift effect without any shadows. Negative letter-spacing tightens progressively with size — display headlines track at -0.022em while body text breathes at -0.003em, a signature move that makes large type feel chiseled rather than loose. The single interactive accent (#0071e3 CTA blue) appears only on the 'Buy' pill button and nav links, rationed so every appearance reads as an instruction to act. Product gradients — dark-to-citrus-green, dark-to-blue, dark-to-violet — serve as full-bleed theatrical backdrops for each color finish showcase, never decorating UI chrome.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink | `#1d1d1f` | `--color-ink` | Primary text, headings, nav labels, icon fills — near-black with just enough warmth to avoid harshness on white |
| Graphite | `#707070` | `--color-graphite` | Secondary body copy, captions, footnotes, muted nav items |
| Slate | `#474747` | `--color-slate` | Tertiary body text, supporting link text, secondary nav |
| Ash | `#333333` | `--color-ash` | Icon strokes, mid-weight body text, button labels in ghost state |
| Fog | `#f5f5f7` | `--color-fog` | Page canvas background, section divider bands, badge fills |
| Snow | `#ffffff` | `--color-snow` | Card surfaces, nav background, elevated container fills |
| Obsidian | `#000000` | `--color-obsidian` | Dark card variant, hero icon fills, maximum-contrast black card |
| Silver Mist | `#e8e8ed` | `--color-silver-mist` | Frosted pill button background (country selector), input backgrounds |
| Azure | `#0071e3` | `--color-azure` | Primary CTA button fill, active nav 'Buy' button — the sole permission-to-act color on the entire page |
| Cobalt Link | `#0066cc` | `--color-cobalt-link` | Inline text links, navigation anchor colors — slightly darker than Azure to distinguish interactive text from interactive buttons |
| Citrus Gradient | `linear-gradient(184deg, rgb(29, 29, 31) 0%, rgb(223, 231, 79) 33%, rgb(94, 156, 42) 66%, rgb(10, 134, 26) 95%)` | `--color-citrus-gradient` | MacBook Neo Citrus finish showcase backdrop — dark-to-citrus theatrical product gradient |
| Indigo Gradient | `linear-gradient(184deg, rgb(29, 29, 31) 20%, rgb(168, 211, 251) 43%, rgb(0, 18, 249) 76%, rgb(37, 53, 224) 95%)` | `--color-indigo-gradient` | MacBook Neo Indigo finish showcase backdrop — dark-to-deep-blue theatrical product gradient |
| Blush Gradient | `linear-gradient(184deg, rgb(29, 29, 31) 20%, rgb(243, 196, 246) 43%, rgb(245, 0, 180) 76%, rgb(204, 41, 188) 95%)` | `--color-blush-gradient` | MacBook Neo Blush finish showcase backdrop — dark-to-magenta-violet theatrical product gradient |
| Citrus Finish | `#dddc8c` | `--color-citrus-finish` | Product color swatch — Citrus finish selector chip |
| Blush Finish | `#e8d0d0` | `--color-blush-finish` | Product color swatch — Blush finish selector chip |
| Indigo Finish | `#596680` | `--color-indigo-finish` | Product color swatch — Indigo finish selector chip |
| Caution | `#b64400` | `--color-caution` | Badge warning text, price asterisk callouts — deep amber-orange for inline semantic alerts |

## Tokens — Typography

### SF Pro Display — All marketing headlines, product name lockups, section titles. Weight 700 at 80-96px is the page's defining visual move — these headlines are 2-4 words at near-poster scale, taking up half the viewport before any product image appears. Negative tracking at display sizes (-0.022em at largest) tightens letterforms into a single typographic mass. · `--font-sf-pro-display`
- **Substitute:** Inter, system-ui
- **Weights:** 600, 700
- **Sizes:** 21px, 24px, 28px, 32px, 40px, 56px, 80px, 96px
- **Line height:** 1.04–1.20
- **Letter spacing:** -0.022em at 96px, -0.019em at 80px, -0.016em at 56px, -0.015em at 40px, -0.005em at 28px, +0.004em at 21px
- **OpenType features:** `"numr"`
- **Role:** All marketing headlines, product name lockups, section titles. Weight 700 at 80-96px is the page's defining visual move — these headlines are 2-4 words at near-poster scale, taking up half the viewport before any product image appears. Negative tracking at display sizes (-0.022em at largest) tightens letterforms into a single typographic mass.

### SF Pro Text — Body copy, nav labels, captions, button labels, footnotes. Weight 400 at 17px is the default body size. Weight 300 appears at larger marketing sizes (20-24px) for subheadings that should feel lighter than headlines. Weight 600 for emphasis labels. The -0.003em tracking at body sizes is subtle but keeps dense paragraphs from sprawling. · `--font-sf-pro-text`
- **Substitute:** Inter, system-ui
- **Weights:** 300, 400, 500, 600
- **Sizes:** 12px, 14px, 17px, 18px, 20px, 24px, 44px
- **Line height:** 1.24–1.50
- **Letter spacing:** -0.022em at 44px, -0.010em at 20px, -0.006em at 17px, -0.003em at 14px, -0.003em at 12px
- **OpenType features:** `"numr"`
- **Role:** Body copy, nav labels, captions, button labels, footnotes. Weight 400 at 17px is the default body size. Weight 300 appears at larger marketing sizes (20-24px) for subheadings that should feel lighter than headlines. Weight 600 for emphasis labels. The -0.003em tracking at body sizes is subtle but keeps dense paragraphs from sprawling.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.33 | -0.26px | `--text-caption` |
| body-sm | 14px | 1.43 | -0.04px | `--text-body-sm` |
| body | 17px | 1.47 | -0.1px | `--text-body` |
| subheading | 20px | 1.4 | -0.2px | `--text-subheading` |
| heading-sm | 24px | 1.29 | -0.36px | `--text-heading-sm` |
| heading | 40px | 1.17 | -0.6px | `--text-heading` |
| heading-lg | 56px | 1.07 | -0.9px | `--text-heading-lg` |
| display | 96px | 1.04 | -2.11px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 44 | 44px | `--spacing-44` |
| 48 | 48px | `--spacing-48` |
| 52 | 52px | `--spacing-52` |
| 76 | 76px | `--spacing-76` |
| 80 | 80px | `--spacing-80` |
| 120 | 120px | `--spacing-120` |
| 144 | 144px | `--spacing-144` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 28px |
| buttons | 999px |
| navItems | 980px |
| pillButtons | 999px |
| featureLinks | 28px |
| smallButtons | 10px |
| roundedButtons | 36px |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 80-120px
- **Card padding:** 28px
- **Element gap:** 10px

## Components

### Primary Buy Button
**Role:** Sole conversion CTA across page and sticky nav

backgroundColor #0071e3, color #ffffff, borderRadius 999px, paddingTop 8px, paddingBottom 8px, paddingLeft 16px, paddingRight 16px, font SF Pro Text 17px weight 400. Appears in global nav and anchored product nav. The only #0071e3 element on the page — isolated blue against all-neutral surroundings makes it impossible to miss without competing colors.

### Ghost Text Button
**Role:** Section 'Learn more' links styled as buttons

backgroundColor transparent, color #1d1d1f, borderRadius 0px, no padding. Rendered as plain weighted text. Used for secondary actions inside feature cards — avoids visual noise next to the single primary CTA.

### Rounded Ghost Button
**Role:** Feature navigation tabs (Calls and Texts, Handoff, iPhone Mirroring, AirDrop)

backgroundColor transparent, color #1d1d1f, borderRadius 28px, no padding. Circular border implied by radius; acts as a pill-shaped tab toggle. Text at SF Pro Text 17px weight 400.

### Frosted Pill Selector
**Role:** Country/region selector and segmented control overlays

backgroundColor rgba(210, 210, 215, 0.64), color rgba(0,0,0,0.56), borderRadius 36px, no explicit padding. backdrop-filter blur(20px). The frosted glass treatment signals a temporary overlay or in-page selector, visually distinct from all opaque buttons.

### Dark Pill Button
**Role:** Hero section 'Buy' CTA on dark product backdrops

backgroundColor #000000, color #ffffff, borderRadius 999px, paddingLeft 16px, paddingRight 16px. Used when the backdrop is a product color gradient — switches from #0071e3 to #000000 to remain legible against vivid gradient backgrounds.

### White Feature Card
**Role:** Primary content card for feature showcases

backgroundColor #ffffff, borderRadius 28px, boxShadow none, padding 28px. Lifts off the #f5f5f7 canvas by 1 surface level. The 28px radius is signature Apple — rounded enough to feel premium, not so round it reads as a chip or badge.

### Fog Feature Card
**Role:** Alternate feature card on white backgrounds

backgroundColor #f5f5f7, borderRadius 28px, boxShadow none, padding 28px. Used when the parent section is #ffffff — reverses the surface/card relationship so the card reads as recessed rather than elevated.

### Dark Feature Card
**Role:** High-contrast product detail card

backgroundColor #000000, borderRadius 28px, boxShadow none. Text color #ffffff. Used as a single accent card within a light card grid — maximum contrast without color.

### Global Navigation Bar
**Role:** Persistent top nav with product categories

backgroundColor #f5f5f7 (or rgba(250,250,252) when open), height ~44px, nav links at SF Pro Text 12px weight 400 color #1d1d1f, Apple logo SVG fill #000000. Sticky, transitions background to semi-opaque white on scroll. Contains 'Buy' primary button at far right.

### Sticky Product Sub-Nav
**Role:** Page-section navigator (Overview, Tech Specs, Compare, Switch from PC to Mac)

backgroundColor #ffffff, borderBottom 1px solid #e8e8ed, height ~52px, link text SF Pro Text 14px weight 400 color #1d1d1f, active link has 3px underline in #1d1d1f. Contains Buy pill button in #0071e3 at far right. Stays fixed after hero scroll.

### Product Color Swatch Chip
**Role:** Finish selector for Silver, Blush, Citrus, Indigo

Small circular or short pill, backgroundColor from finish token (--finish-blush #e8d0d0, --finish-citrus #dddc8c, --finish-indigo #596680, --finish-silver #e3e4e5), borderRadius 999px. Selected state adds 3px solid #1d1d1f border ring.

### New Badge
**Role:** Product 'New' label in nav and product cards

backgroundColor transparent, color #1d1d1f, borderRadius 0px, font SF Pro Text 12px weight 600. Appears as a plain text label, not a pill — anti-convention for a badge, reads as an editorial stamp rather than a UI chip.

### Carousel Pagination Dot
**Role:** Slide indicator in feature carousels

Active dot: backgroundColor #1d1d1f, width ~8px, height ~8px, borderRadius 999px. Inactive dots: backgroundColor rgba(210,210,215,0.64), same dimensions. Horizontally centered below carousel, gap 6px.

## Do's and Don'ts

### Do
- Use 28px border-radius for all feature cards (#ffffff and #f5f5f7 backgrounds) — this exact value is the page's geometric signature.
- Reserve #0071e3 exclusively for the primary 'Buy' CTA button. No other UI element uses this blue — its scarcity makes it the only color that reads as an imperative.
- Apply negative letter-spacing scaled to font size: -2.11px at 96px display, -0.9px at 56px heading-lg, -0.1px at 17px body. Positive or zero tracking at display sizes breaks the chiseled headline aesthetic.
- Use #f5f5f7 as page canvas and #ffffff as card surface. Never reverse this — cards must always be lighter than their parent background.
- Set SF Pro Display weight 700 for all primary product headlines at 56px and above. Weight 600 is for supporting headers (24-40px), never for hero text.
- Use rgba(210,210,215,0.64) with backdrop-filter blur(20px) for any temporary overlay controls (country selectors, segmented pickers) — this is the frosted-glass layer distinct from all opaque surfaces.
- Product finish gradients (Citrus, Indigo, Blush) are used only as full-bleed section backdrops for that finish's showcase. Never use them as UI chrome, card backgrounds, or button fills.

### Don't
- Do not add box-shadow to any card or container. The entire elevation system is color-value-only — shadows break the flat-lit gallery effect.
- Do not use #0066cc (Cobalt Link) for button backgrounds. It is an inline text link color only — using it on filled buttons conflicts with the #0071e3 CTA hierarchy.
- Do not use font weight 300 for headlines below 40px — below that threshold, weight 300 loses definition against the white/fog background.
- Do not place two rounded-pill buttons side by side in the same visual zone. The 999px radius is rationed to one CTA per section to prevent diffusion of focus.
- Do not use the product finish colors (#dddc8c Citrus, #e8d0d0 Blush, #596680 Indigo) as semantic or UI accent colors — they exist only as product identity swatches and gradient source colors.
- Do not use positive letter-spacing on SF Pro Display at sizes above 28px. The +0.007em–+0.011em values from the data appear only at small display sizes (21px); at headline scale positive tracking is tonally inconsistent.
- Do not center-align body paragraphs longer than 2 lines. Apple's body copy left-aligns in two-column feature layouts; centered text is reserved for single-line hero subheadings and price callouts.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | `#f5f5f7` | Page body background — one step off white, creates implicit depth against pure-white cards |
| 1 | Card | `#ffffff` | Feature cards, info panels, modal containers — lifts off canvas without shadow, pure separation by value |
| 2 | Recessed | `#f5f5f7` | Inset content areas within white cards — same as canvas, creates nested depth by repetition |
| 3 | Frosted Control | `#d2d2d7` | Pill selector backgrounds (country dropdown, segmented controls) — rgba(210,210,215,0.64) with backdrop blur |
| 4 | Dark Stage | `#000000` | Full-bleed dark card variant for maximum-contrast product showcases; used sparingly as a dramatic section divider |

## Elevation

Zero box-shadows across all 73 card instances. Elevation is expressed entirely through background-color differential: #ffffff cards float above #f5f5f7 canvas by value contrast alone. This forces the eye to read depth through color rather than cast shadow — a choice that keeps the page feeling like a flat lit surface rather than a stacked document. The only visual separation is the 28px border-radius rounding the card edges, making containment geometric rather than dimensional.

## Imagery

Product photography dominates: the MacBook is always the sole subject, photographed on pure white or against the Fog (#f5f5f7) surface — zero lifestyle context, no hands (except the hero hand hold), no desk environment. The hero image is the laptop balanced on a single palm from below-frame, shot at a near-overhead angle with the vivid Citrus finish as the sole color note in an otherwise achromatic composition. Color finish showcases use full-bleed theatrical gradients (dark-to-citrus, dark-to-indigo, dark-to-blush) as the backdrop, with the open laptop emerging from the gradient — product-as-light-source. No illustration. Icons are SF Symbols style: mono, filled/outlined hybrid, 1.5-2px apparent stroke, #1d1d1f on light backgrounds, #ffffff on dark cards. The page is image-heavy relative to text — each major section is anchored by a product image occupying 50-80% of viewport height, with text floating above or below in compact lockups.

## Layout

Max-width ~1200px centered on a #f5f5f7 canvas. Hero is full-viewport centered headline stack (product name at 24px, hero headline at 80-96px, price subtext at 17px, single Buy pill) with product image breaking below the text fold — classic Apple centered-stack hero. Sub-nav becomes sticky at ~52px height after the hero. Section rhythm: alternating white (#ffffff full-width bands) and fog (#f5f5f7) bands with no explicit dividers — the color shift alone creates section breaks. Feature sections use 2-column split (text left at ~40% width, product image right at ~60%) or full-bleed product gradient cards. Highlight carousel is a single-column centered card with horizontal scroll and pagination dots. Specs section uses a tight left-label / right-value two-column table pattern at body-sm size. Feature detail cards stack in a 2×2 grid at 28px radius, each card self-contained. Navigation: translucent sticky global nav at top (12px text, ~44px tall) plus sticky product sub-nav below it (14px text, ~52px tall) — two navigation layers are always visible, keeping section context persistent during long scroll.

## Agent Prompt Guide

QUICK COLOR REFERENCE:
• Page background: #f5f5f7
• Card surface: #ffffff
• Primary text / headlines: #1d1d1f
• Secondary text: #707070
• CTA button fill: #0071e3
• Inline links: #0066cc
• Border / divider: #e8e8ed

EXAMPLE COMPONENT PROMPTS:

1. Hero section: Full-width, background #f5f5f7. Center-stack layout. Eyebrow at SF Pro Text 24px weight 600, color #1d1d1f, letter-spacing -0.36px. Headline at SF Pro Display 96px weight 700, color #1d1d1f, letter-spacing -2.11px, lineHeight 1.04. Price subtext at SF Pro Text 17px weight 400, color #1d1d1f. Single Buy pill button: backgroundColor #000000, color #ffffff, borderRadius 999px, paddingLeft 16px, paddingRight 16px, paddingTop 8px, paddingBottom 8px. Product photo centered below text at full viewport width.

2. Sticky product sub-nav: backgroundColor #ffffff, borderBottom 1px solid #e8e8ed, height 52px. Nav links: SF Pro Text 14px weight 400, color #1d1d1f, spaced 24px apart. Active link has 3px solid #1d1d1f underline. Far-right Buy button: backgroundColor #0071e3, color #ffffff, borderRadius 999px, paddingLeft 16px, paddingRight 16px, paddingTop 8px, paddingBottom 8px, SF Pro Text 17px weight 400.

3. Feature card grid (2-column): Parent band background alternates #ffffff / #f5f5f7. Cards: backgroundColor opposite of parent (#f5f5f7 on white, #ffffff on fog), borderRadius 28px, boxShadow none, padding 28px. Headline inside card: SF Pro Display 28px weight 600, color #1d1d1f, letter-spacing -0.07em. Body: SF Pro Text 17px weight 400, color #707070. Secondary link: color #0066cc, no underline default.

4. Product color gradient showcase: Full-bleed section, height 100vh. Background: linear-gradient(184deg, #1d1d1f 20%, [finish peak color] 43%, [finish mid] 70%, [finish end] 95%). Centered headline: SF Pro Display 56px weight 700, color #ffffff, letter-spacing -0.9px. Product image centered and overlapping gradient. Color swatch chips below: borderRadius 999px, 28px diameter each, separated 8px, selected state has 3px solid #ffffff ring.

5. Section header (left-aligned): Background #f5f5f7 or #ffffff band, padding 40px 40px 20px. Headline: SF Pro Display 40px weight 700, color #1d1d1f, letter-spacing -0.6px, lineHeight 1.17. Supporting paragraph: SF Pro Text 20px weight 300, color #1d1d1f, letter-spacing -0.2px, lineHeight 1.40, max-width 560px.

## Motion System

Primary duration: 0.344s (page transitions, card reveals). Quick feedback: 0.1s (hover states, button presses). Scroll-driven animations: 0.32s ease. Default easing: ease (CSS keyword) for 97% of transitions. background-color and color transitions are the most common animated properties — hover states shift between neutral values. opacity transitions power section entrance reveals. transform transitions handle product image parallax and carousel movement. The overall motion personality is 'expressive' but anchored by slow-ease timing that feels gravity-weighted rather than springy.

## Product Finish Color System

Four hardware finishes map to CSS tokens and gradient backdrops:
• Silver: swatch #e3e4e5 (--finish-silver), no gradient showcase
• Blush: swatch #e8d0d0 (--finish-blush), gradient from #1d1d1f → #f3c4f6 → #f500b4 → #cc29bc
• Citrus: swatch #dddc8c (--finish-citrus), gradient from #1d1d1f → #dfe74f → #5e9c2a → #0a8619
• Indigo: swatch #596680 (--finish-indigo), gradient from #1d1d1f → #a8d3fb → #0012f9 → #2535e2
Each swatch chip: 28px diameter, borderRadius 999px. Selected state: 3px solid border in #1d1d1f (on light) or #ffffff (on dark). Gradient showcases are full-bleed 184° linear gradients used exclusively as section backdrops, never UI fills.

## Similar Brands

- **Samsung Galaxy product pages** — Same pattern of full-bleed product color gradients as section backdrops with centered heavyweight headlines above product photography
- **Dyson product pages** — White/near-white canvas with zero shadows, large isolated product photography, and a single restrained CTA blue as the only chromatic UI element
- **Sony product pages** — Sticky dual-navigation pattern (global nav + product sub-nav) and alternating light/dark section bands for feature storytelling
- **Teenage Engineering** — Extreme weight and scale contrast between headline and body type, near-achromatic palette with product color as the only chromatic note

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-ink: #1d1d1f;
  --color-graphite: #707070;
  --color-slate: #474747;
  --color-ash: #333333;
  --color-fog: #f5f5f7;
  --color-snow: #ffffff;
  --color-obsidian: #000000;
  --color-silver-mist: #e8e8ed;
  --color-azure: #0071e3;
  --color-cobalt-link: #0066cc;
  --color-citrus-gradient: #dddc8c;
  --gradient-citrus-gradient: linear-gradient(184deg, rgb(29, 29, 31) 0%, rgb(223, 231, 79) 33%, rgb(94, 156, 42) 66%, rgb(10, 134, 26) 95%);
  --color-indigo-gradient: #2535e2;
  --gradient-indigo-gradient: linear-gradient(184deg, rgb(29, 29, 31) 20%, rgb(168, 211, 251) 43%, rgb(0, 18, 249) 76%, rgb(37, 53, 224) 95%);
  --color-blush-gradient: #cc29bc;
  --gradient-blush-gradient: linear-gradient(184deg, rgb(29, 29, 31) 20%, rgb(243, 196, 246) 43%, rgb(245, 0, 180) 76%, rgb(204, 41, 188) 95%);
  --color-citrus-finish: #dddc8c;
  --color-blush-finish: #e8d0d0;
  --color-indigo-finish: #596680;
  --color-caution: #b64400;

  /* Typography — Font Families */
  --font-sf-pro-display: 'SF Pro Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sf-pro-text: 'SF Pro Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.33;
  --tracking-caption: -0.26px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --tracking-body-sm: -0.04px;
  --text-body: 17px;
  --leading-body: 1.47;
  --tracking-body: -0.1px;
  --text-subheading: 20px;
  --leading-subheading: 1.4;
  --tracking-subheading: -0.2px;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.29;
  --tracking-heading-sm: -0.36px;
  --text-heading: 40px;
  --leading-heading: 1.17;
  --tracking-heading: -0.6px;
  --text-heading-lg: 56px;
  --leading-heading-lg: 1.07;
  --tracking-heading-lg: -0.9px;
  --text-display: 96px;
  --leading-display: 1.04;
  --tracking-display: -2.11px;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-52: 52px;
  --spacing-76: 76px;
  --spacing-80: 80px;
  --spacing-120: 120px;
  --spacing-144: 144px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 80-120px;
  --card-padding: 28px;
  --element-gap: 10px;

  /* Border Radius */
  --radius-lg: 10px;
  --radius-3xl: 28px;
  --radius-3xl-2: 32px;
  --radius-3xl-3: 36px;
  --radius-full: 980px;
  --radius-full-2: 999px;

  /* Named Radii */
  --radius-cards: 28px;
  --radius-buttons: 999px;
  --radius-navitems: 980px;
  --radius-pillbuttons: 999px;
  --radius-featurelinks: 28px;
  --radius-smallbuttons: 10px;
  --radius-roundedbuttons: 36px;

  /* Surfaces */
  --surface-canvas: #f5f5f7;
  --surface-card: #ffffff;
  --surface-recessed: #f5f5f7;
  --surface-frosted-control: #d2d2d7;
  --surface-dark-stage: #000000;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-ink: #1d1d1f;
  --color-graphite: #707070;
  --color-slate: #474747;
  --color-ash: #333333;
  --color-fog: #f5f5f7;
  --color-snow: #ffffff;
  --color-obsidian: #000000;
  --color-silver-mist: #e8e8ed;
  --color-azure: #0071e3;
  --color-cobalt-link: #0066cc;
  --color-citrus-gradient: #dddc8c;
  --color-indigo-gradient: #2535e2;
  --color-blush-gradient: #cc29bc;
  --color-citrus-finish: #dddc8c;
  --color-blush-finish: #e8d0d0;
  --color-indigo-finish: #596680;
  --color-caution: #b64400;

  /* Typography */
  --font-sf-pro-display: 'SF Pro Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sf-pro-text: 'SF Pro Text', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.33;
  --tracking-caption: -0.26px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --tracking-body-sm: -0.04px;
  --text-body: 17px;
  --leading-body: 1.47;
  --tracking-body: -0.1px;
  --text-subheading: 20px;
  --leading-subheading: 1.4;
  --tracking-subheading: -0.2px;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.29;
  --tracking-heading-sm: -0.36px;
  --text-heading: 40px;
  --leading-heading: 1.17;
  --tracking-heading: -0.6px;
  --text-heading-lg: 56px;
  --leading-heading-lg: 1.07;
  --tracking-heading-lg: -0.9px;
  --text-display: 96px;
  --leading-display: 1.04;
  --tracking-display: -2.11px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-52: 52px;
  --spacing-76: 76px;
  --spacing-80: 80px;
  --spacing-120: 120px;
  --spacing-144: 144px;

  /* Border Radius */
  --radius-lg: 10px;
  --radius-3xl: 28px;
  --radius-3xl-2: 32px;
  --radius-3xl-3: 36px;
  --radius-full: 980px;
  --radius-full-2: 999px;
}
```




# Stripe — Style Reference
> Architectural blueprint on white marble.

**Theme:** light

Stripe's design system evokes a digital command center on a clean canvas. It combines a serene white background with structured grid layouts and a single vibrant violet to highlight actions and key information. Subtle shadows provide soft elevation, preventing elements from feeling flat, while compact typography paired with highly descriptive gradients for hero sections and product showcases adds visual depth without clutter. The overall effect is one of quiet efficiency, where information is paramount, and interactions are clearly signposted.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#061b31` | `--color-midnight-ink` | Primary text, critical headings, icons, primary button text for ghost buttons |
| Slate Blue | `#50617a` | `--color-slate-blue` | Secondary text, muted links, subtle borders, descriptive captions |
| Ghost Gray | `#64748d` | `--color-ghost-gray` | Tertiary text, placeholder text, inactive states, subtle dividers |
| Platinum White | `#ffffff` | `--color-platinum-white` | Page backgrounds, card surfaces, primary button text against dark backgrounds |
| Porcelain White | `#f8fafd` | `--color-porcelain-white` | Secondary card surfaces, subtle background variations |
| Powder Blue | `#e5edf5` | `--color-powder-blue` | Background for secondary sections, light card backgrounds |
| Stone Gray | `#d8d6df` | `--color-stone-gray` | Horizontal rules, subtle borders, graphical elements |
| Deep Violet | `#533afd` | `--color-deep-violet` | Primary calls to action (buttons, links), active states, significant icons — establishes brand presence and emphasizes interaction |
| Washed Violet | `#b9b9f9` | `--color-washed-violet` | Border for ghost buttons, subtle accents |
| Soft Violet | `#8087ff` | `--color-soft-violet` | Decorative icons, gradient highlights, sub-brand accents |
| Accent Green | `#81b81a` | `--color-accent-green` | Green outline accent for tags, dividers, and focused UI edges |
| Vibrant Orange | `#ff6118` | `--color-vibrant-orange` | Orange outline accent for tags, dividers, and focused UI edges. |
| Sunburst Gradient | `linear-gradient(90deg, rgb(114, 50, 241) 3.13%, rgb(251, 118, 250) 50%, rgb(255, 207, 94))` | `--color-sunburst-gradient` | Decorative gradients in hero sections and product showcases, adding a dynamic, abstract visual element |
| Dreamy Gradient | `radial-gradient(circle, rgb(127, 125, 252), rgb(244, 75, 204) 33%, rgb(229, 237, 245) 66%)` | `--color-dreamy-gradient` | Abstract background graphics, product display panels, adding depth and a tech-centric feel |
| Fuchsia Glow Gradient | `linear-gradient(0deg, rgb(255, 46, 222), rgb(210, 152, 255))` | `--color-fuchsia-glow-gradient` | Decorative illustration elements, feature highlights |

## Tokens — Typography

### sohne-var — The primary typeface for all content. Weight 300 is used for large, impactful headlines, creating a sense of understated authority rather than shouting. Weight 400 is standard for body text, ensuring clarity and readability. The 'ss01' feature provides alternative character forms, and 'tnum' ensures tabular figures align numerically. · `--font-sohne-var`
- **Substitute:** system-ui, sans-serif
- **Weights:** 300, 400
- **Sizes:** 8px, 9px, 10px, 11px, 12px, 14px, 16px, 18px, 20px, 22px, 26px, 32px, 34px, 44px, 48px, 56px
- **Line height:** 0.80, 0.85, 1.00, 1.03, 1.07, 1.10, 1.12, 1.15, 1.20, 1.25, 1.30, 1.33, 1.40, 1.43, 1.45, 1.50
- **Letter spacing:** -0.0300em at 56px, -0.0250em at 48px, -0.0090em at 18px
- **OpenType features:** `"ss01" on, "tnum"`
- **Role:** The primary typeface for all content. Weight 300 is used for large, impactful headlines, creating a sense of understated authority rather than shouting. Weight 400 is standard for body text, ensuring clarity and readability. The 'ss01' feature provides alternative character forms, and 'tnum' ensures tabular figures align numerically.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.45 | 0.03px | `--text-caption` |
| body | 14px | 1.4 | 0.003px | `--text-body` |
| subheading | 18px | 1.25 | -0.009px | `--text-subheading` |
| heading-sm | 22px | 1.2 | -0.01px | `--text-heading-sm` |
| heading | 32px | 1.15 | -0.02px | `--text-heading` |
| heading-lg | 44px | 1.1 | -0.025px | `--text-heading-lg` |
| display | 56px | 1.07 | -0.03px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 60 | 60px | `--spacing-60` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 4px |
| cards | 6px |
| images | 4px |
| inputs | 4px |
| buttons | 4px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| xl | `rgba(0, 0, 0, 0.2) 0px 0px 32px 8px` | `--shadow-xl` |
| xl-2 | `rgba(50, 50, 93, 0.12) 0px 16px 32px 0px` | `--shadow-xl-2` |
| xl-3 | `rgba(23, 23, 23, 0.08) 0px 15px 35px 0px` | `--shadow-xl-3` |
| sm | `rgba(23, 23, 23, 0.06) 0px 3px 6px 0px` | `--shadow-sm` |

### Layout

- **Section gap:** 64px
- **Card padding:** 12px
- **Element gap:** 8px

## Components

### Primary Filled Button
**Role:** Main call to action.

Background: Deep Violet (#533afd), Text: Platinum White (#ffffff), Border: 4px radius, Padding: 15.5px vertical, 24px horizontal. Sohne-var weight 400.

### Ghost Button
**Role:** Secondary action. Low visual hierarchy.

Background: transparent, Text: Midnight Ink (#061b31), Border: 0px, Padding: 12px vertical, 0px horizontal. Sohne-var weight 400.

### Outlined Button
**Role:** Tertiary action.

Background: transparent, Text: Deep Violet (#533afd), Border: Washed Violet (#b9b9f9), 4px radius, Padding: 14.5px vertical, 24px horizontal. Sohne-var weight 400.

### Default Card
**Role:** Content container for features and information.

Background: Powder Blue (#e5edf5), Border: none, 6px radius, Padding: 12px.

### Feature Card
**Role:** Highlighting key features or product aspects.

Background: Porcelain White (#f8fafd), Border: none, 6px radius, Box Shadow: rgba(0, 0, 0, 0.2) 0px 0px 32px 8px. Padding: 12px.

### Primary Navigation Link
**Role:** Top-level navigation item.

Text: Midnight Ink (#061b31), Underline: none on hover, Padding: 0px.

## Do's and Don'ts

### Do
- Use Platinum White (#ffffff) as the default page background for most sections.
- Apply Deep Violet (#533afd) specifically for primary interactive elements, ensuring strong visual call to action.
- Employ sohne-var weight 300 for all display and large heading typography to maintain a refined, impactful presence.
- Keep card surfaces subtle, using Powder Blue (#e5edf5) or Porcelain White (#f8fafd) with soft 6px rounded corners.
- Utilize -0.0300em letter-spacing for large text (56px) to maintain a cohesive, modern typographic aesthetic.
- Implement radial and linear gradients for hero banners and product showcases to add dynamic visual interest without overwhelming the UI.
- Maintain a clear elementGap of 8px for logical grouping of related UI elements.

### Don't
- Do not use saturated colors for large areas or text unless they are part of a decorative gradient or a specific accent.
- Avoid using hard, sharp shadows; prefer soft, diffused shadows like rgba(0, 0, 0, 0.2) 0px 0px 32px 8px for elevation.
- Do not introduce new font families; sohne-var is the sole typeface for all typographic needs.
- Refrain from using border radii other than 4px and 6px for interactive components and cards, respectively.
- Do not use generic blue for links or buttons; Deep Violet (#533afd) is the designated action color.
- Avoid high-contrast, bold headlines; the system relies on lighter weights (300, 400) even for large text.
- Do not vary line heights significantly from the established typographic scale; ensure dense, compact text blocks for body copy and tighter leads for headlines.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Platinum White | `#ffffff` | Primary page background and base canvas. |
| 1 | Porcelain White | `#f8fafd` | Slightly elevated secondary surfaces, light card backgrounds. |
| 2 | Powder Blue | `#e5edf5` | Backgrounds for alternating sections or distinct content blocks. |

## Elevation

- **Feature Card:** `rgba(0, 0, 0, 0.2) 0px 0px 32px 8px`
- **Hovered Card:** `rgba(50, 50, 93, 0.12) 0px 16px 32px 0px`

## Imagery

The site uses a combination of abstract, vibrant gradients for hero sections and product showcases (e.g., radial-gradient using Deep Violet, pinks, and light blues), and clean, contained product screenshots that are often presented within device mockups. For illustrative purposes, icons are outlined or filled with brand colors, maintaining a minimal yet functional aesthetic. Imagery serves primarily as decorative atmosphere and product showcase, with a lesser emphasis on photography, emphasizing a more technical and abstract visual story.

## Layout

The page primarily uses a max-width contained layout, though the hero section often employs full-bleed vibrant gradients to establish a dynamic visual anchor. Sections exhibit a comfortable vertical rhythm, with consistent spacing and a blend of centered content stacks and alternating text-left/image-right arrangements. Feature sets are often presented in multi-column card grids, supporting compact information delivery. Navigation is handled by a sticky top bar with clearly defined interactive elements.

## Agent Prompt Guide

Quick Color Reference:
text: #061b31
background: #ffffff
border: #e5edf5
accent: #8087ff
primary action: #533afd (filled action)

Example Component Prompts:
Create a hero section: radial-gradient(circle, rgb(247, 45, 243), rgb(83, 58, 253) 33%, rgb(229, 237, 245) 66%) background. Headline 'La infraestructura financiera' at 56px sohne-var weight 300, #061b31, letter-spacing -0.03em. Primary Filled Button 'Empieza ahora' with #533afd background, #ffffff text, 4px radius, 15.5px 24px padding.

Create a default card: #e5edf5 background, 6px radius, 12px padding. Title 'Acepta pagos' at 22px sohne-var weight 400, #061b31. Body text 'Ofrece servicios financieros' at 14px sohne-var weight 400, #50617a.

Create an outlined button: transparent background, #533afd text, #b9b9f9 border with 4px radius, 14.5px 24px padding. Label 'Accede con tu cuenta de Google'.

## Similar Brands

- **Linear** — Shares a sophisticated, modern aesthetic with minimal color, strong typography, and subtle UI elements.
- **Figma** — Utilizes a clean white workspace, subtle gray scale, and a vibrant primary accent color for actions.
- **Vercel** — Combines a technical, precise feel with thoughtful spacing, restrained color usage, and abstract background graphics.
- **Notion** — Employs a content-first approach with a high-contrast text palette, clean surfaces, and minimal decorative elements.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-ink: #061b31;
  --color-slate-blue: #50617a;
  --color-ghost-gray: #64748d;
  --color-platinum-white: #ffffff;
  --color-porcelain-white: #f8fafd;
  --color-powder-blue: #e5edf5;
  --color-stone-gray: #d8d6df;
  --color-deep-violet: #533afd;
  --color-washed-violet: #b9b9f9;
  --color-soft-violet: #8087ff;
  --color-accent-green: #81b81a;
  --color-vibrant-orange: #ff6118;
  --color-sunburst-gradient: #ffbb00;
  --gradient-sunburst-gradient: linear-gradient(90deg, rgb(114, 50, 241) 3.13%, rgb(251, 118, 250) 50%, rgb(255, 207, 94));
  --color-dreamy-gradient: #7f7dc8;
  --gradient-dreamy-gradient: radial-gradient(circle, rgb(127, 125, 252), rgb(244, 75, 204) 33%, rgb(229, 237, 245) 66%);
  --color-fuchsia-glow-gradient: #ff2ede;
  --gradient-fuchsia-glow-gradient: linear-gradient(0deg, rgb(255, 46, 222), rgb(210, 152, 255));

  /* Typography — Font Families */
  --font-sohne-var: 'sohne-var', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.45;
  --tracking-caption: 0.03px;
  --text-body: 14px;
  --leading-body: 1.4;
  --tracking-body: 0.003px;
  --text-subheading: 18px;
  --leading-subheading: 1.25;
  --tracking-subheading: -0.009px;
  --text-heading-sm: 22px;
  --leading-heading-sm: 1.2;
  --tracking-heading-sm: -0.01px;
  --text-heading: 32px;
  --leading-heading: 1.15;
  --tracking-heading: -0.02px;
  --text-heading-lg: 44px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -0.025px;
  --text-display: 56px;
  --leading-display: 1.07;
  --tracking-display: -0.03px;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-60: 60px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;

  /* Layout */
  --section-gap: 64px;
  --card-padding: 12px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-sm: 1px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-2xl: 16px;

  /* Named Radii */
  --radius-tags: 4px;
  --radius-cards: 6px;
  --radius-images: 4px;
  --radius-inputs: 4px;
  --radius-buttons: 4px;

  /* Shadows */
  --shadow-xl: rgba(0, 0, 0, 0.2) 0px 0px 32px 8px;
  --shadow-xl-2: rgba(50, 50, 93, 0.12) 0px 16px 32px 0px;
  --shadow-xl-3: rgba(23, 23, 23, 0.08) 0px 15px 35px 0px;
  --shadow-sm: rgba(23, 23, 23, 0.06) 0px 3px 6px 0px;

  /* Surfaces */
  --surface-platinum-white: #ffffff;
  --surface-porcelain-white: #f8fafd;
  --surface-powder-blue: #e5edf5;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-ink: #061b31;
  --color-slate-blue: #50617a;
  --color-ghost-gray: #64748d;
  --color-platinum-white: #ffffff;
  --color-porcelain-white: #f8fafd;
  --color-powder-blue: #e5edf5;
  --color-stone-gray: #d8d6df;
  --color-deep-violet: #533afd;
  --color-washed-violet: #b9b9f9;
  --color-soft-violet: #8087ff;
  --color-accent-green: #81b81a;
  --color-vibrant-orange: #ff6118;
  --color-sunburst-gradient: #ffbb00;
  --color-dreamy-gradient: #7f7dc8;
  --color-fuchsia-glow-gradient: #ff2ede;

  /* Typography */
  --font-sohne-var: 'sohne-var', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.45;
  --tracking-caption: 0.03px;
  --text-body: 14px;
  --leading-body: 1.4;
  --tracking-body: 0.003px;
  --text-subheading: 18px;
  --leading-subheading: 1.25;
  --tracking-subheading: -0.009px;
  --text-heading-sm: 22px;
  --leading-heading-sm: 1.2;
  --tracking-heading-sm: -0.01px;
  --text-heading: 32px;
  --leading-heading: 1.15;
  --tracking-heading: -0.02px;
  --text-heading-lg: 44px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -0.025px;
  --text-display: 56px;
  --leading-display: 1.07;
  --tracking-display: -0.03px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-60: 60px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;

  /* Border Radius */
  --radius-sm: 1px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-2xl: 16px;

  /* Shadows */
  --shadow-xl: rgba(0, 0, 0, 0.2) 0px 0px 32px 8px;
  --shadow-xl-2: rgba(50, 50, 93, 0.12) 0px 16px 32px 0px;
  --shadow-xl-3: rgba(23, 23, 23, 0.08) 0px 15px 35px 0px;
  --shadow-sm: rgba(23, 23, 23, 0.06) 0px 3px 6px 0px;
}
```


# Dub — Style Reference
> Crisp Utility on White Canvas

**Theme:** light

Dub presents a high-contrast, functionally transparent productivity aesthetic. Surfaces range from pure white to subtle light grays, often paired with crisp dark text. Typography is precise and clear, with a prominent serif display font for impact and a neutral sans-serif for content. Accent colors appear as small functional highlights rather than large blocks, creating a dynamic yet understated feel. Components are lightweight, featuring soft border radii and minimal, diffused shadows, emphasizing content over heavy ornamentation.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page backgrounds, card surfaces, form fills, primary button text for dark buttons |
| Jet Black | `#000000` | `--color-jet-black` | Icon fills, outlines for ghost buttons, decorative strokes to establish boundaries |
| Ink Black | `#0a0a0a` | `--color-ink-black` | Primary text color for headings, body text, and prominent links |
| Thunder Gray | `#171717` | `--color-thunder-gray` | Secondary text for informational blocks, subtle accents |
| Shadow Gray | `#262626` | `--color-shadow-gray` | Tertiary text, less prominent details, active ghost button text |
| Steel Gray | `#404040` | `--color-steel-gray` | Muted text, less emphasis on secondary elements |
| Subtle Ash | `#f5f5f5` | `--color-subtle-ash` | Subtle background for UI elements, hover states, secondary card surfaces |
| Border Light | `#e5e5e5` | `--color-border-light` | Hairline borders, dividers, subtle outlines for cards and inputs |
| Border Muted | `#d4d4d4` | `--color-border-muted` | Default input borders, inactive states |
| Accent Blue | `#3b82f6` | `--color-accent-blue` | Decorative icons, interactive elements, button background for a primary action |
| Fresh Green | `#16a34a` | `--color-fresh-green` | Green text accent for links, tags, and emphasized short phrases. Use as a supporting accent, not as a status color |
| Warm Orange | `#ea580c` | `--color-warm-orange` | Highlight text, specific icon accents, informative badges |
| Deep Violet | `#7c3aed` | `--color-deep-violet` | Link highlights, decorative icons, secondary brand accents |
| System Info | `#111827` | `--color-system-info` | Secondary body text, navigation labels, and subdued headings |
| Focus Ring Blue | `#1e40af` | `--color-focus-ring-blue` | Primary action background, focus state indication |
| Highlight Green | `#4ade80` | `--color-highlight-green` | Background for specific callouts or positive elements |
| Highlight Violet | `#c084fc` | `--color-highlight-violet` | Background for specific callouts or visual accents |
| Highlight Orange | `#fb923c` | `--color-highlight-orange` | Background for specific callouts or visual accents |
| Linear Gray Dark | `linear-gradient(rgb(82, 82, 82), rgb(23, 23, 23))` | `--color-linear-gray-dark` | Darker shade for linear gradients, often in backgrounds or decorative elements |
| Linear Gray Light | `linear-gradient(rgb(115, 115, 115), rgb(38, 38, 38))` | `--color-linear-gray-light` | Lighter shade for linear gradients, often in backgrounds or decorative elements |

## Tokens — Typography

### Satoshi — Display headlines and prominent marketing text. The semi-bold weight and clean, geometric forms provide a modern, confident voice. · `--font-satoshi`
- **Substitute:** Montserrat
- **Weights:** 500
- **Sizes:** 36px, 40px, 48px
- **Line height:** 1.00, 1.11, 1.15
- **Letter spacing:** normal
- **Role:** Display headlines and prominent marketing text. The semi-bold weight and clean, geometric forms provide a modern, confident voice.

### Inter — The primary typeface for all UI elements, body text, navigation, and detailed information. Its legibility across various sizes ensures clarity in product contexts. · `--font-inter`
- **Substitute:** Inter
- **Weights:** 400, 500, 600
- **Sizes:** 8px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 24px, 30px
- **Line height:** 1.00, 1.33, 1.38, 1.40, 1.43, 1.50, 1.56, 2.15, 2.80
- **Letter spacing:** normal
- **Role:** The primary typeface for all UI elements, body text, navigation, and detailed information. Its legibility across various sizes ensures clarity in product contexts.

### GeistMono — Used for code snippets, data displays, and elements requiring a fixed-width, precise appearance, such as tracking IDs or numeric metrics. · `--font-geistmono`
- **Substitute:** Roboto Mono
- **Weights:** 400, 500
- **Sizes:** 12px, 14px, 24px
- **Line height:** 1.00, 1.33, 1.43
- **Letter spacing:** normal
- **Role:** Used for code snippets, data displays, and elements requiring a fixed-width, precise appearance, such as tracking IDs or numeric metrics.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 10px | 1.4 | — | `--text-caption` |
| body | 14px | 1.43 | — | `--text-body` |
| subheading | 18px | 1.56 | — | `--text-subheading` |
| heading-sm | 24px | 1.33 | — | `--text-heading-sm` |
| heading | 30px | 1.33 | — | `--text-heading` |
| heading-lg | 36px | 1.11 | — | `--text-heading-lg` |
| display | 48px | 1.15 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 112 | 112px | `--spacing-112` |

### Border Radius

| Element | Value |
|---------|-------|
| lg | 12px |
| md | 8px |
| xl | 16px |
| xxl | 20px |
| full | 9999px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px` | `--shadow-subtle` |
| sm | `rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0...` | `--shadow-sm` |
| sm-2 | `rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset` | `--shadow-sm-2` |
| subtle-2 | `rgba(0, 0, 0, 0.1) 0px 0px 0px 4px` | `--shadow-subtle-2` |
| md | `rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1)...` | `--shadow-md` |
| lg | `rgba(0, 0, 0, 0.09) 0px 20px 20px 0px` | `--shadow-lg` |
| subtle-3 | `rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px ...` | `--shadow-subtle-3` |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 64px
- **Card padding:** 16px
- **Element gap:** 16px

## Components

### Primary Action Button
**Role:** Filled button for primary calls to action.

Background: Accent Blue (#3b82f6) or Focus Ring Blue (#1e40af), Text: Canvas White (#ffffff), Border Radius: 8px, Padding: 6px 12px.

### Ghost Button
**Role:** Interactive elements that blend into the background, typically for secondary actions.

Background: transparent (rgba(0,0,0,0)), Text: Ink Black (#0a0a0a) or Thunder Gray (#171717), Border: none, Border Radius: 9999px, Padding: 0px 16px.

### Outlined Card
**Role:** Informational containers with a subtle visual boundary.

Background: Canvas White (#ffffff), Border: 1px solid Border Light (#e5e5e5), Border Radius: 12px, Padding: 8px.

### Raised Card
**Role:** Elevated cards for prominent content or interactive sections.

Background: Canvas White (#ffffff), Border Radius: 16px, Shadow: rgba(0, 0, 0, 0.1) 0px 0px 0px 4px, Padding: 0px.

### Subtle Background Card
**Role:** Cards with a slightly off-white background, often used for grouped information or light contrast.

Background: Subtle Ash (#f5f5f5) or #dcfce7, Border Radius: 16px, Padding: 16px.

### Text Input
**Role:** Standard input fields for user data.

Background: Canvas White (#ffffff), Text: System Info (#111827), Border: 1px solid Border Muted (#d4d4d4) on top with clear bottom/sides, Border Radius: 0px 6px 6px 0px (asymmetric). Focus state uses a blue ring.

### Pill Tag
**Role:** Informative labels or categories.

Background: #dcfce7, Text: Fresh Green (#16a34a), Border Radius: 9999px, Padding: 6px 12px.

### Navigation Link
**Role:** Top-level navigation items.

Text: Ink Black (#0a0a0a), Hover: Underlined with Ink Black (#0a0a0a), Padding: 0px 24px.

### Featured Badge
**Role:** Small, colorful highlights for features or status.

Background: #fb923c, #c084fc, or #4ade80. Text: Ink Black (#0a0a0a) or similar dark neutral. Border radius: 9999px. Padding: dynamic based on content.

## Do's and Don'ts

### Do
- Use Satoshi (or Montserrat) at 48px, weight 500, line-height 1.15 for primary page headings.
- Apply Canvas White (#ffffff) for all main page and card backgrounds to maintain a bright, open feel.
- Employ Ink Black (#0a0a0a) for all primary body text, headings, and crucial interactive text for maximum readability.
- Utilize Border Light (#e5e5e5) for all hairline borders and subtle dividers to define content areas without adding visual weight.
- Apply a 9999px (full pill shape) border-radius to all ghost buttons and tags for a distinctive soft, approachable quality.
- Use Element Gap of 16px to separate most inline elements and Card Padding of 16px for content within containers.
- Employ Accent Blue (#3b82f6) or Focus Ring Blue (#1e40af) as the background for primary call-to-action buttons, with Canvas White (#ffffff) text.

### Don't
- Avoid using heavy drop shadows; prefer diffused, subtle shadows like rgba(0, 0, 0, 0.05) 0px 1px 2px 0px.
- Do not deviate from Inter for body text, links, and most UI elements; consistency is key for readability and brand recognition.
- Refrain from using saturated colors as large background blocks; reserve them for small accents, highlights, or semantic indicators.
- Avoid tight line spacing for larger text; ensure line-heights are generous, especially for headings, to enhance scannability.
- Do not overcrowd sections; maintain a Section Gap of at least 64px to provide clear visual separation and breathing room.
- Do not use arbitrary border radii; adhere strictly to the defined scales: 9999px for pills, 8px for small components, 12px for cards, and 16px for larger containers.
- Do not introduce new typefaces; the combination of Satoshi (display), Inter (UI), and Geist Mono (monospace) is comprehensive.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas White | `#ffffff` | Primary page background, base for most content sections. |
| 2 | Subtle Ash | `#f5f5f5` | Secondary background for cards, recessed sections, or hover states. |
| 3 | Info Tint | `#dcfce7` | Background for specific callouts, badges, or areas needing a subtle colored highlight. |

## Elevation

- **Button:** `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
- **Card (General):** `rgba(0, 0, 0, 0.1) 0px 0px 0px 4px`
- **Dropdown/Menu:** `rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px`

## Imagery

The visual language for imagery is primarily product-focused, featuring clean, cropped screenshots of the Dub UI. These screenshots often appear against a slightly muted background, sometimes with a soft blur or slight elevation. Icons are minimal, featuring outline styles with thin strokes in black or occasionally brand accent colors (green, orange, violet), serving as decorative or explanatory elements. There is a general absence of lifestyle photography or complex illustrations, keeping the focus squarely on the product's interface and functionality. Density is moderate, with images used to break up text blocks and demonstrate product features rather than purely decorative purposes.

## Layout

The page typically follows a max-width contained model, centered at around 1200px, creating a structured and professional feel. The hero section often presents a centered headline and subtext, followed by primary call-to-action buttons. Sections alternate between full-width content blocks and contained content, maintaining a rhythm of visual interest. Content arrangement leans towards alternating text-left/image-right compositions, or feature grids. There's a consistent vertical spacing between sections, primarily using a large section gap, creating a sense of spaciousness. Navigation is a sticky top bar with logo, main links, and distinct login/signup buttons.

## Agent Prompt Guide

Quick Color Reference:
- text: #0a0a0a
- background: #ffffff
- border: #e5e5e5
- accent: #3b82f6
- primary action: #000000 (filled action)

Example Component Prompts:
- Create a Primary Action Button: #000000 background, #ffffff text, 9999px radius, compact pill padding. Use this filled treatment for the main CTA.
- Create a feature card: Background Canvas White (#ffffff), 12px radius, 1px solid Border Light (#e5e5e5). Title 'Advanced Analytics' at 20px Inter 600, Ink Black (#0a0a0a). Body text 'Gain deep insights into your link performance with real-time data.' at 14px Inter 400, Ink Black (#0a0a0a).

## Similar Brands

- **Vercel** — High-contrast light UI, emphasis on clear typography and functional accents, similar button styling and shadow usage.
- **Linear** — Clean, productivity-focused interface, subtle use of neutrals, and a distinct sans-serif for UI with a strong black/white contrast.
- **Framer** — Modern SaaS aesthetic with ample white space, precise typography, and a limited, purposeful accent color palette.
- **Notion** — Minimalist visual style, heavy reliance on grayscale tones for structure, and a highly legible sans-serif font for content focus.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-jet-black: #000000;
  --color-ink-black: #0a0a0a;
  --color-thunder-gray: #171717;
  --color-shadow-gray: #262626;
  --color-steel-gray: #404040;
  --color-subtle-ash: #f5f5f5;
  --color-border-light: #e5e5e5;
  --color-border-muted: #d4d4d4;
  --color-accent-blue: #3b82f6;
  --color-fresh-green: #16a34a;
  --color-warm-orange: #ea580c;
  --color-deep-violet: #7c3aed;
  --color-system-info: #111827;
  --color-focus-ring-blue: #1e40af;
  --color-highlight-green: #4ade80;
  --color-highlight-violet: #c084fc;
  --color-highlight-orange: #fb923c;
  --color-linear-gray-dark: #525252;
  --gradient-linear-gray-dark: linear-gradient(rgb(82, 82, 82), rgb(23, 23, 23));
  --color-linear-gray-light: #737373;
  --gradient-linear-gray-light: linear-gradient(rgb(115, 115, 115), rgb(38, 38, 38));

  /* Typography — Font Families */
  --font-satoshi: 'Satoshi', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geistmono: 'GeistMono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.4;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-subheading: 18px;
  --leading-subheading: 1.56;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.33;
  --text-heading: 30px;
  --leading-heading: 1.33;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 48px;
  --leading-display: 1.15;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 64px;
  --card-padding: 16px;
  --element-gap: 16px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-full: 9999px;

  /* Named Radii */
  --radius-lg: 12px;
  --radius-md: 8px;
  --radius-xl: 16px;
  --radius-xxl: 20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
  --shadow-sm: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;
  --shadow-sm-2: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.1) 0px 0px 0px 4px;
  --shadow-md: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
  --shadow-lg: rgba(0, 0, 0, 0.09) 0px 20px 20px 0px;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px 0px 4px;

  /* Surfaces */
  --surface-canvas-white: #ffffff;
  --surface-subtle-ash: #f5f5f5;
  --surface-info-tint: #dcfce7;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-jet-black: #000000;
  --color-ink-black: #0a0a0a;
  --color-thunder-gray: #171717;
  --color-shadow-gray: #262626;
  --color-steel-gray: #404040;
  --color-subtle-ash: #f5f5f5;
  --color-border-light: #e5e5e5;
  --color-border-muted: #d4d4d4;
  --color-accent-blue: #3b82f6;
  --color-fresh-green: #16a34a;
  --color-warm-orange: #ea580c;
  --color-deep-violet: #7c3aed;
  --color-system-info: #111827;
  --color-focus-ring-blue: #1e40af;
  --color-highlight-green: #4ade80;
  --color-highlight-violet: #c084fc;
  --color-highlight-orange: #fb923c;
  --color-linear-gray-dark: #525252;
  --color-linear-gray-light: #737373;

  /* Typography */
  --font-satoshi: 'Satoshi', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geistmono: 'GeistMono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.4;
  --text-body: 14px;
  --leading-body: 1.43;
  --text-subheading: 18px;
  --leading-subheading: 1.56;
  --text-heading-sm: 24px;
  --leading-heading-sm: 1.33;
  --text-heading: 30px;
  --leading-heading: 1.33;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 48px;
  --leading-display: 1.15;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px;
  --shadow-sm: rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px;
  --shadow-sm-2: rgba(0, 0, 0, 0.2) 0px 2px 6px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.1) 0px 0px 0px 4px;
  --shadow-md: rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px;
  --shadow-lg: rgba(0, 0, 0, 0.09) 0px 20px 20px 0px;
  --shadow-subtle-3: rgb(255, 255, 255) 0px 0px 0px 3px, rgb(0, 0, 0) 0px 0px 0px 4px;
}
```


# Grafbase — Style Reference
> Architectural blueprint on white marble.  The interface feels like a meticulously drafted technical diagram, laid out on a clean, bright surface.

**Theme:** light

Grafbase deploys a precise, engineering-focused aesthetic, balancing stark black and white contrasts with subtle, nuanced grays to create an information-dense yet navigable interface. A single vibrant teal-green gradient acts as a beacon for critical calls to action, injecting a dynamic energy into an otherwise composed presentation. The design leverages a tight Inter type scale and generous padding to ensure clarity and hierarchy, making complex API governance feel structured and approachable.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#1b1b1b` | `--color-midnight-ink` | Primary text, prominent icons, button text on light backgrounds, strong borders. |
| Canvas White | `#ffffff` | `--color-canvas-white` | Page backgrounds, card surfaces, button text on dark backgrounds. |
| Cloud Gray | `#eaeaea` | `--color-cloud-gray` | Secondary button backgrounds, section dividers, subtle background accents. |
| Slate Text | `#60646c` | `--color-slate-text` | Secondary text, placeholder text, descriptive labels. |
| Ash Gray | `#7c7c7c` | `--color-ash-gray` | Tertiary text, less prominent UI elements. |
| Cloud Border | `#e0e1e6` | `--color-cloud-border` | Subtle borders for inputs and cards. |
| System Mint | `#8dc63f` | `--color-system-mint` | Accent for certain icons and illustrations. |
| System Sky | `#27aae1` | `--color-system-sky` | Accent for certain icons and illustrations. |
| Plasma Teal Gradient | `linear-gradient(89.97deg, rgb(25, 160, 95) 0.02%, rgb(13, 127, 140) 123.85%)` | `--color-plasma-teal-gradient` | Call-to-action buttons, active states, key visual indicators for urgency and interaction. |

## Tokens — Typography

### Inter — All primary text, headings, body copy, navigation, buttons. The negative letter spacing at display sizes contributes to a crisp, compact headline appearance. · `--font-inter`
- **Substitute:** system-ui, sans-serif
- **Weights:** 400, 500, 600, 700
- **Sizes:** 13px, 14px, 16px, 20px, 24px, 40px, 90px
- **Line height:** 1.00, 1.10, 1.43, 1.50, 2.00
- **Letter spacing:** -0.7px at 90px, -0.5px at 40px, normal at smaller sizes
- **Role:** All primary text, headings, body copy, navigation, buttons. The negative letter spacing at display sizes contributes to a crisp, compact headline appearance.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| button | 16px | 1.5 | — | `--text-button` |
| subheading | 20px | 1.5 | — | `--text-subheading` |
| heading | 24px | 1.1 | -0.5px | `--text-heading` |
| heading-lg | 40px | 1.1 | -1px | `--text-heading-lg` |
| display | 90px | 1 | -4.5px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 44 | 44px | `--spacing-44` |
| 48 | 48px | `--spacing-48` |
| 72 | 72px | `--spacing-72` |
| 80 | 80px | `--spacing-80` |
| 100 | 100px | `--spacing-100` |
| 128 | 128px | `--spacing-128` |

### Border Radius

| Element | Value |
|---------|-------|
| misc | 20px |
| cards | 12px |
| buttons | 6px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| lg | `rgba(0, 0, 0, 0.15) 0px 4px 20px 0px` | `--shadow-lg` |

### Layout

- **Section gap:** 64px
- **Card padding:** 24px
- **Element gap:** 8px

## Components

### Primary Action Button
**Role:** Call to action

Background is Plasma Teal Gradient, text is Canvas White (#ffffff). Radius is 6px. Padding: 14px vertical, 28px horizontal. Applies a shadow of rgba(0, 0, 0, 0.15) 0px 4px 20px 0px only on hover/active states.

### Secondary Ghost Button
**Role:** Alternative action

Transparent background, Midnight Ink (#1b1b1b) text and 1px border. No radius, instead it's an underline-like treatment. Padding: 0px vertical, 8px horizontal. Used for inline links or subtle actions.

### Secondary Filled Button
**Role:** Less prominent action

Background is Cloud Gray (#eaeaea), text is Midnight Ink (#1b1b1b). Radius is 6px. Padding: 14px vertical, 28px horizontal. Border color is Cloud Border (#e0e1e6).

### Circular Icon Button
**Role:** Navigation or small interactive elements

Background is Canvas White (#ffffff), text/icon is Slate Text (#60646c). Radius is 40px (50% for circular shape). Padding: 15px all around. Used for arrow navigation in galleries.

### Navigation Link
**Role:** Primary navigation links

Text is Midnight Ink (#1b1b1b) weight 500. Underlined on hover. Specific text size and line height according to typography scale for navigation (e.g., 16px, 1.5lh).

### Hero Headline
**Role:** Prominent page titles

Inter font, weight 700 at 90px size, line height 1.0, letter spacing -0.05em (-4.5px). Color is Midnight Ink (#1b1b1b). Dominates the initial view.

### Body Text Paragraph
**Role:** Standard informational text

Inter font, weight 400 at 16px size, line height 1.5. Color is Slate Text (#60646c) for descriptive content, Midnight Ink (#1b1b1b) for more prominent body text.

### Feature Card
**Role:** Showcasing product features or benefits

Canvas White (#ffffff) background. Radius is 12px. Padding is 24px inner. Contains a graphic, a headline (Inter 24px, 1.1lh, -0.025em letter spacing), and descriptive text (Inter 16px, 1.5lh).

## Do's and Don'ts

### Do
- Use Plasma Teal Gradient for all primary calls to action to ensure consistent visual prioritization.
- Apply Inter font with specific letter-spacing adjustments: -0.05em for 90px headings and -0.025em for 40px headings.
- Maintain a clear visual hierarchy by utilizing Midnight Ink (#1b1b1b) for main headings and interactive elements, and Slate Text (#60646c) for supporting text.
- Implement 6px border-radius for all interactive buttons and 12px for content cards to maintain a subtle sense of digital craftsmanship.
- Leverage the Canvas White (#ffffff) as the dominant page background, ensuring a clean and expansive feel for content.
- Ensure generous internal padding of 24px for all card-like components to provide ample breathing room for content.
- Prioritize explicit contrast pairings: #1b1b1b on #ffffff (17.2:1 AAA) and #1b1b1b on #eaeaea (14.3:1 AAA).

### Don't
- Do not introduce new vibrant chromatic colors beyond the established accent palette for illustrations and the brand gradient.
- Avoid using hard-edged rectangles without any radius; all major interactive elements and cards should use either 6px or 12px radii.
- Do not deviate from the Inter typeface; custom fonts are not part of this system.
- Refrain from heavy drop shadows; the only significant shadow is on interactive buttons during hover/active states.
- Do not use highly saturated colors for large background areas or extensive text, sticking to the neutral and accent palette for main UI.
- Avoid reducing vertical spacing below the 24px element gap between related components.
- Do not combine multiple gradients; the Plasma Teal Gradient is the sole approved gradient for brand identity.

## Imagery

The site's imagery is primarily composed of technical product screenshots embedded within clean, minimal UI mockups, and abstract geometric illustrations. Product screenshots are typically tight crops, showcasing specific functionality with a focus on data visualization (charts, code snippets). Illustrations are flat, two-dimensional, geometric, and often outlined, using the muted accent colors from the palette to define elements. Icons are outlined, with a moderate stroke weight, and monochromatic (using Midnight Ink or Slate Text). Imagery serves to explain complex technical concepts and showcase product capabilities directly, rather than create a mood. They are generally contained within white or light gray card-like segments, avoiding full-bleed applications. Density is balanced, with imagery typically accompanying text blocks to break up information.

## Layout

The layout follows a content-width container model, centered on the page, with a full-bleed top announcement banner. The hero section is a two-column split, with a large, left-aligned headline and supporting text occupying one half, and a product screenshot or interactive demo occupying the other. Sections alternate between a strong left-aligned headline with descriptive text, and a mix of single-column feature descriptions and 3-column card grids. Vertical rhythm is maintained through consistent `sectionGap` of 64px, creating spacious breaks between content blocks. Navigation is a sticky top bar with a left-aligned logo and right-aligned links and buttons.

## Agent Prompt Guide

1. **Quick Color Reference:**
   - Text (primary): #1b1b1b
   - Background (page): #ffffff
   - CTA (background): linear-gradient(89.97deg, rgb(25, 160, 95) 0.02%, rgb(13, 127, 140) 123.85%)
   - Button (secondary): #eaeaea
   - Border (subtle): #e0e1e6

2. **Example Component Prompts:**
   - Create a hero section with a primary headline: 'Unify your APIs. Govern your AI.', using Midnight Ink (#1b1b1b), Inter font, size 90px, weight 700, line-height 1.0, letter-spacing -4.5px. Below it, add body text 'Enterprise-grade governance...' in Slate Text (#60646c), Inter size 16px, weight 400, line-height 1.5. Place a Primary Action Button 'Try it for free' and a Secondary Filled Button 'Contact Sales' below the text.
   - Design a Feature Card with a Canvas White (#ffffff) background, 12px radius, and 24px padding. Inside, use a headline 'Struggling with Apollo's infrastructure management requirements?' in Midnight Ink (#1b1b1b), Inter font, size 24px, weight 700, line-height 1.1, letter-spacing -0.5px. Below that, add body text 'Speed up your implementations.' in Slate Text (#60646c), Inter size 16px, weight 400, line-height 1.5. Include a Secondary Filled Button 'Compare' at the bottom.
   - Generate a top navigation bar: Canvas White (#ffffff) background, with 'Grafbase' logo (vector icon, fill #1b1b1b) on the left. On the right, include navigation links ('Products', 'Solutions', 'Resources', 'Extensions', 'Docs', 'Pricing', 'Contact') using Midnight Ink (#1b1b1b), Inter weight 500, size 16px, line-height 1.5. Include a 'Sign in' link in Midnight Ink (#1b1b1b) and a Primary Action Button 'Get started'.

## Similar Brands

- **Vercel** — Shares a precise, high-contrast, text-dominant aesthetic with subtle accent colors and clean product mockups.
- **Linear** — Similar approach to minimalist, functional design with strong typography, ample whitespace, and focused interactive elements.
- **Stripe (developer docs)** — Employs comparable information-dense but organized layouts, with clear hierarchy and functional, non-distracting visual elements.
- **Supabase** — A developer-focused tool with a clean, modern aesthetic, relying on strong typography and a limited, effective color palette for its UI.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-ink: #1b1b1b;
  --color-canvas-white: #ffffff;
  --color-cloud-gray: #eaeaea;
  --color-slate-text: #60646c;
  --color-ash-gray: #7c7c7c;
  --color-cloud-border: #e0e1e6;
  --color-system-mint: #8dc63f;
  --color-system-sky: #27aae1;
  --color-plasma-teal-gradient: #19a05f;
  --gradient-plasma-teal-gradient: linear-gradient(89.97deg, rgb(25, 160, 95) 0.02%, rgb(13, 127, 140) 123.85%);

  /* Typography — Font Families */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-button: 16px;
  --leading-button: 1.5;
  --text-subheading: 20px;
  --leading-subheading: 1.5;
  --text-heading: 24px;
  --leading-heading: 1.1;
  --tracking-heading: -0.5px;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -1px;
  --text-display: 90px;
  --leading-display: 1;
  --tracking-display: -4.5px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-72: 72px;
  --spacing-80: 80px;
  --spacing-100: 100px;
  --spacing-128: 128px;

  /* Layout */
  --section-gap: 64px;
  --card-padding: 24px;
  --element-gap: 8px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 20px;
  --radius-3xl: 40px;

  /* Named Radii */
  --radius-misc: 20px;
  --radius-cards: 12px;
  --radius-buttons: 6px;

  /* Shadows */
  --shadow-lg: rgba(0, 0, 0, 0.15) 0px 4px 20px 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-ink: #1b1b1b;
  --color-canvas-white: #ffffff;
  --color-cloud-gray: #eaeaea;
  --color-slate-text: #60646c;
  --color-ash-gray: #7c7c7c;
  --color-cloud-border: #e0e1e6;
  --color-system-mint: #8dc63f;
  --color-system-sky: #27aae1;
  --color-plasma-teal-gradient: #19a05f;

  /* Typography */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-button: 16px;
  --leading-button: 1.5;
  --text-subheading: 20px;
  --leading-subheading: 1.5;
  --text-heading: 24px;
  --leading-heading: 1.1;
  --tracking-heading: -0.5px;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -1px;
  --text-display: 90px;
  --leading-display: 1;
  --tracking-display: -4.5px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-72: 72px;
  --spacing-80: 80px;
  --spacing-100: 100px;
  --spacing-128: 128px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-2xl: 20px;
  --radius-3xl: 40px;

  /* Shadows */
  --shadow-lg: rgba(0, 0, 0, 0.15) 0px 4px 20px 0px;
}
```
