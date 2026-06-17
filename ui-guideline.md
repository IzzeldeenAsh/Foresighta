# UI Design Guidelines (Production-Level SaaS)

## Goal

Generate clean, minimal, production-ready UI similar to top SaaS products like Vercel, Linear, and Stripe. For settings, dashboards, forms, and operational pages, default to the Vercel-style settings pattern described below.

---

## Design Principles

* Minimal and clean design
* Avoid visual noise
* Prioritize readability and hierarchy
* Everything should feel "tight" and intentional
* No over-design
* Prefer calm, useful pages over marketing-style layouts

---

## Avoid (Very Important)

* Oversized hero typography on app pages
* Heavy shadows
* Gradients and flashy colors
* Overly rounded corners
* Glassmorphism / Neumorphism
* Random spacing that is not tied to a section rhythm
* Fancy or decorative UI
* Nested cards inside other cards unless the inner card is a repeated item or input option

---

## Preferred Style

* Flat design
* Subtle borders instead of shadows
* Neutral color palette (grays + one primary color)
* Clean alignment
* Spacious but not loose layout
* Strong card separation with clear section headers, body areas, and footer/action rows when needed

---

## Page Pattern: Vercel-Like Settings Pages

Use this pattern for account settings, project settings, profile setup, billing preferences, admin configuration, and similar pages.

### Page Header

* Keep the page header as a bordered, flat card or full-width header band.
* Title should be visibly larger than section titles, usually `28-32px` on desktop and `24-26px` on mobile.
* Subtitle should be readable, around `16-18px`, muted, and directly under the title.
* Use one simple icon only if the page already uses icons in its navigation or header system.

### Main Content Width

* Use a wide but constrained content container.
* Desktop max width should usually be `1200-1320px`.
* Avoid narrow centered settings columns unless the form is truly short.
* Align the header and settings content to the same container width.

### Cards / Sections

* Each major setting group should be a separate flat card.
* Use `1px solid #e5e7eb` or the app's equivalent light gray border.
* Border radius: `8px` max unless the local design system requires otherwise.
* No shadows by default.
* Give cards real vertical separation: `20-24px` between cards.
* Split cards into:
  * Header: title + description
  * Body: controls, chips, inputs, option cards
  * Footer/action row: save, hints, destructive actions, or secondary info when needed

### Section Typography

* Section title: `18-20px`, semibold.
* Section description: `15-17px`, muted, comfortable line-height.
* Control labels and option titles: `16-17px`, semibold.
* Small helper/error text: `14-15px`.

### Spacing

* Use the 8px grid, but settings pages can breathe.
* Card header/body padding should usually be `24-36px` horizontally and `24-28px` vertically on desktop.
* Mobile card padding should usually be `16-18px`.
* Do not collapse unrelated controls into one dense card just to save height.

### Controls

* Switches should be simple pills, around `48x26px`, with clear active/inactive states.
* Chips should be readable and tappable, around `40px` min-height.
* Inputs should have flat borders, clear focus states, and stable widths.
* Option cards should use borders for selected state and a subtle tinted background if helpful.
* Action buttons should sit in an aligned row, usually at the right in LTR and left in RTL, or full-width on mobile.

### RTL

* Use logical properties where possible: `margin-inline`, `padding-inline`, `inset-inline`.
* Check switch thumb direction, icon placement, and action alignment in Arabic.

---

## Typography

| Element         | Size    | Weight    |
| --------------- | ------- | --------- |
| Page title      | 28-32px | Bold      |
| Section title   | 18-20px | Semi-bold |
| Body text       | 15-17px | Regular   |
| Labels          | 14-16px | Medium    |
| Numbers (stats) | 18-24px | Semi-bold |

Rules:

* Use larger text when it improves page hierarchy and scanability.
* Keep hierarchy clear, not exaggerated.
* Do not use hero-scale text inside cards, dashboards, sidebars, or tables.

---

## Spacing System

* Use 8px grid system
* Common spacing:

  * gap-2 (8px)
  * gap-3 (12px)
  * gap-4 (16px)
  * gap-5 / gap-6 (20-24px) for card separation
* Avoid arbitrary padding/margins

---

## Components

### Cards

* Border: `1px solid rgba(0,0,0,0.06)`
* No heavy shadow (or `shadow-sm` only)
* Border radius: 6px-10px max
* Settings cards should use clear header/body/action separation

### Buttons

* Clean, flat
* No glow or gradients
* Subtle hover only

### Inputs

* Simple borders
* No heavy effects
* Clear focus state

---

## Icons

* Use simple outline icons
* No colorful or complex icons
* Keep size small and consistent

---

## Colors

* Use grayscale:

  * Gray-900 (text)
  * Gray-600 (secondary text)
  * Gray-300 (borders)
* One primary color only (for actions)

---

## Layout Rules

* Align everything properly
* Avoid unnecessary elements
* Keep UI dense but readable
* Think "dashboard", not "landing page"
* For app pages, build the actual working interface first, not a marketing hero
* Prefer full-width bands or flat bordered sections over decorative floating panels

---

## Angular / SCSS Implementation Notes

* Prefer component-scoped SCSS for page-specific refinements.
* Avoid changing shared components globally unless multiple pages need the same behavior.
* Use existing Metronic, Bootstrap, PrimeNG, and app helper classes when they fit.
* Create small page wrapper classes when a route needs specific header/content alignment.
* Keep forms accessible: real labels where appropriate, switches with `role="switch"` and `aria-checked`, buttons for clickable chips/cards.

---

## Tailwind Constraints (if used)

* text-sm default
* text-base for small titles
* text-xl/text-2xl for settings page titles
* rounded-lg max
* shadow-sm or no shadow
* gap-2 / gap-3 for compact controls
* gap-5 / gap-6 for card separation

---

## Prompt Usage Template

Use this with AI:

```
You are a senior product designer working on a production SaaS product.

Follow these rules strictly:
[PASTE THIS FILE CONTENT]

Now design:
[YOUR REQUEST]
```

---

## Example Request

```
Improve this settings page using the repo UI guideline.

Style:
- Minimal SaaS (Vercel-like)
- Larger readable settings hierarchy
- No shadows
- Subtle borders
- Clear card separation
- Header/body/action row structure

Do not rewrite behavior. Keep the current component patterns.
```

---

## Final Rule

If it looks fancy, it is probably wrong.
If it looks simple, calm, readable, and intentionally structured, it is correct.
