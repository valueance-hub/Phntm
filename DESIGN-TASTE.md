# PHNTM — Design Taste Reference

Distilled from two AI-agent design rulebooks the user asked to bring in:
- **pbakaus/impeccable** — DESIGN.md ("Editorial Sanctuary" + universal anti-slop rules)
- **emilkowalski/skills** — design-engineering + apple-design (motion craft)

> NOTE: Impeccable's *visual* system is a LIGHT, warm-paper, serif editorial look that is the
> OPPOSITE of PHNTM's dark aesthetic. Do NOT reskin PHNTM to warm paper. Take its **craft
> discipline** (below), not its palette. PHNTM stays dark, mono/grotesk, minimal.

## Motion (apply everywhere)
- **Easing:** expo-out only. `cubic-bezier(0.16,1,0.3,1)` (impeccable) or `cubic-bezier(0.23,1,0.32,1)` (emil). Never ease-in on UI. Never bounce/elastic — feels dated.
- **Duration:** color/opacity 150ms · transforms 200–400ms · orchestrated entrances 600–1200ms. UI interactions stay <300ms.
- **Only animate `transform` and `opacity`.** Never width/height/padding/margin.
- **Never from `scale(0)`** — start at `scale(.95)` + opacity. Nothing appears from nothing.
- **Press feedback:** pressable elements get `transform: scale(.97)` on `:active`, ~160ms ease-out.
- **Stagger** grouped entrances 30–80ms apart (not 100ms+).
- **Respect `prefers-reduced-motion`:** cross-fade instead of movement, drop overshoot.
- Enter/exit along the SAME path (spatial consistency). Anchor popovers to their trigger origin (modals stay centered).

## Color
- **Never pure #000 or #fff** — always tint the neutrals (PHNTM: near-black like #060606/#0a0a0b, off-white text).
- **One accent, used on ≤10% of a screen.** Scarcity = decisive. No second hue; use weight/scale for a second emphasis.
- **No gradient text** (`background-clip:text` w/ gradient) — banned. Emphasis via weight/size.
- Declare new colors in OKLCH when possible, harmonious with existing palette.

## Surfaces / Elevation
- **Flat at rest.** Shadows only as state response (hover/lift/focus). Non-interactive element needing a shadow → use a hairline border instead.
- Shadow alpha ≤ 0.15 at strongest blur (higher = 2014 Material tell).
- Tinted (accent) shadows only for the rare "magnetic" moment; neutral black shadows for structure.

## The AI-slop tells to avoid (impeccable "don'ts")
- Colored `border-left/right` > 1px stripe on cards/callouts — the #1 dashboard tell.
- Rounded-rectangle + generic drop shadow default.
- Dark mode WITH glowing purple/cyan accents + glassmorphism as decoration.
- Identical repeating card grids; cards nested in cards.
- Hero-metric layout cliché (big number + stats + gradient accent).
- Overused fonts (Inter/Roboto/Arial/system default) as the brand voice.
- Hedging UI copy ("maybe", "could be helpful") — be expert-decisive.

## Typography craft
- Size-specific tracking: tighten large display (`-0.02em`), body near 0, slight positive on tiny labels.
- Leading inverse to size: tight on headings, ~1.5–1.6 on body. Cap prose at 65–75ch.
- Build hierarchy from weight + size + leading as a set.

## Applied to PHNTM so far
- Login intro: expo-out easing, 60ms stagger, button `scale(.97)` press, reduced-motion fallback.

## TODO (offered, not yet done)
- Same motion/press-feedback pass across dashboard (buttons, modals, log-trade panel).
- Audit for pure #000/#fff → tint; confirm no >1px colored side-borders anywhere.
