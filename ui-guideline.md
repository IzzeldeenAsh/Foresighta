# 🧠 UI Design Guidelines (Production-Level SaaS)

## 🎯 Goal

Generate clean, minimal, production-ready UI similar to top SaaS products like Vercel, Linear, and Stripe.

---

## 🎨 Design Principles

* Minimal and clean design
* Avoid visual noise
* Prioritize readability and hierarchy
* Everything should feel "tight" and intentional
* No over-design

---

## ❌ Avoid (Very Important)

* Large font sizes
* Heavy shadows
* Gradients and flashy colors
* Overly rounded corners
* Glassmorphism / Neumorphism
* Too much spacing
* Fancy or decorative UI

---

## ✅ Preferred Style

* Flat design
* Subtle borders instead of shadows
* Neutral color palette (grays + one primary color)
* Clean alignment
* Compact layout

---

## 🔤 Typography

| Element         | Size    | Weight    |
| --------------- | ------- | --------- |
| Title           | 16–18px | Semi-bold |
| Body text       | 13–14px | Regular   |
| Labels          | 11–12px | Medium    |
| Numbers (stats) | 16–18px | Semi-bold |

Rules:

* Never use large text unless necessary
* Keep hierarchy subtle, not exaggerated

---

## 📏 Spacing System

* Use 8px grid system
* Common spacing:

  * gap-2 (8px)
  * gap-3 (12px)
  * gap-4 (16px max)
* Avoid large padding/margins

---

## 🧱 Components

### Cards

* Border: `1px solid rgba(0,0,0,0.06)`
* No heavy shadow (or `shadow-sm` only)
* Border radius: 6px–10px max
* Compact padding

### Buttons

* Clean, flat
* No glow or gradients
* Subtle hover only

### Inputs

* Simple borders
* No heavy effects
* Clear focus state

---

## 🎯 Icons

* Use simple outline icons
* No colorful or complex icons
* Keep size small and consistent

---

## 🎨 Colors

* Use grayscale:

  * Gray-900 (text)
  * Gray-600 (secondary text)
  * Gray-300 (borders)
* One primary color only (for actions)

---

## 🧩 Layout Rules

* Align everything properly
* Avoid unnecessary elements
* Keep UI dense but readable
* Think "dashboard", not "landing page"

---

## ⚙️ Tailwind Constraints (if used)

* text-sm default
* text-base only for titles
* rounded-lg max
* shadow-sm or no shadow
* gap-2 / gap-3 preferred

---

## 🧠 Prompt Usage Template

Use this with AI:

```
You are a senior product designer working on a production SaaS product.

Follow these rules strictly:
[PASTE THIS FILE CONTENT]

Now design:
[YOUR REQUEST]
```

---

## 🔥 Example Request

```
Create 4 compact statistic cards.

Style:
- Minimal SaaS (Vercel-like)
- Small typography
- No shadows
- Subtle borders
- Tight spacing

Each card:
- Small icon
- Label
- Value
- Optional subtext
```

---

## 🏁 Final Rule

If it looks "fancy" → it's wrong
If it looks "simple but clean" → it's correct
