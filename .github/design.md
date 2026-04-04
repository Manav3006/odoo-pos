# Design System Document: Liquid Precision

## 1. Overview & Creative North Star: "The Kinetic Sanctuary"
The POS environment is traditionally cluttered, rigid, and stressful. This design system rejects that friction. Our Creative North Star is **The Kinetic Sanctuary**—a digital environment that feels like a fluid, living organism. We move away from "software" and toward "sculpture."

To break the "template" look, this system utilizes **Absolute Liquidity**. By pairing the aggressive, avant-garde geometry of *Syne* with hyper-rounded "pill" containers and glassmorphism, we create a high-end editorial feel that remains incredibly functional for fast-paced retail or hospitality. We prioritize intentional asymmetry and "breathing room" over dense grids, ensuring every touch interaction feels like a deliberate, premium gesture.

---

## 2. Colors: Tonal Depth & The No-Line Rule
Our palette is a dialogue between organic forest depths and high-energy mint. 

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** Boundaries must be defined through background color shifts or subtle tonal transitions. Use `surface_container_low` (#f3f4f0) to section off areas from the main `background` (#f9faf6). If a container needs to pop, we use color elevation, not strokes.

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as stacked sheets of frosted glass.
*   **Base:** `background` (#f9faf6)
*   **Sectioning:** `surface_container` (#edeeea)
*   **Actionable Cards:** `surface_container_lowest` (#ffffff)
*   **Floating Modals:** `surface_bright` (#f9faf6) with 24px backdrop blur.

### The Glass & Gradient Rule
To achieve "visual soul," primary actions should not be flat. Apply a subtle linear gradient to main CTAs: 
*   **From:** `primary` (#006d35) 
*   **To:** `primary_container` (#00e676) at a 135-degree angle.
For floating overlays, use `surface_variant` at 70% opacity with a `saturate(150%)` backdrop filter to let the underlying colors bleed through beautifully.

---

## 3. Typography: Editorial Authority
We pair a loud, wide Heading font with a clean, tech-forward Body font to balance personality with legibility.

*   **Display & Headlines (Syne, 700):** These are your "statements." Use `display-lg` for totals and key brand moments. The wide apertures of Syne convey a modern, "too-cool-to-care" confidence.
*   **Titles & Body (Outfit, 400):** Outfit provides the "tech" counter-balance. Its geometric nature ensures high legibility on POS hardware from arm's length.
*   **Labels (Outfit, 500):** All caps with a 0.05em letter spacing for secondary metadata to maintain the editorial hierarchy.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to show "standard" height; we use them to show "presence."

*   **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. The contrast is enough to define the shape without visual noise.
*   **Ambient Shadows:** For floating elements (Modals, Popovers), use a triple-layered shadow:
    *   `box-shadow: 0 10px 40px -10px rgba(26, 51, 34, 0.08), 0 20px 60px -20px rgba(0, 230, 118, 0.04);`
    *   This uses a tinted version of our `on_surface` and `primary` colors to mimic natural light.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke, use `outline_variant` (#bacbb9) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: The Liquid Toolkit

### Buttons: The Pill Standard
All buttons use `rounded-full` (9999px). 
*   **Primary:** Gradient fill (`primary` to `primary_container`) with white text. 
*   **Secondary:** `secondary_container` fill with `on_secondary_container` text.
*   **States:** On hover/tap, scale the button to 0.98 and increase the shadow diffusion. Use a 200ms `cubic-bezier(0.4, 0, 0.2, 1)` transition.

### Input Fields: Soft Wells
Inputs are not boxes; they are "wells" carved into the surface. Use `surface_container_highest` with no border. On focus, transition the background to `surface_container_lowest` and add a soft `primary` outer glow (8px blur, 10% opacity).

### Cards & Lists: Flowing Groups
*   **Cards:** Borderless. Use `lg` (2rem) or `xl` (3rem) corner radius.
*   **Lists:** Forbid divider lines. Use `16px` of vertical whitespace. To separate items, use a very subtle `surface_container_low` background on every second item (zebra striping) or simply rely on typography weight shifts.

### POS-Specific Components:
*   **The "Quick-Action" Tray:** A persistent glassmorphic bar at the bottom of the screen using `backdrop-filter: blur(40px)`.
*   **Liquid Modals:** Dialogs should slide up from the bottom with a "spring" animation, utilizing the `full` border radius on the top corners to feel like a rising bubble.

---

## 6. Do's and Don'ts

### Do:
*   **Embrace Negative Space:** If you think a section needs a border, try adding 24px of padding instead.
*   **Use Asymmetric Layouts:** In the checkout summary, align totals to the right and labels to the extreme left to create "tension."
*   **Animate Tactilely:** Every touch must have a "snappy" response. Objects should feel like they have weight but no friction.

### Don't:
*   **No Sharp Corners:** Never use a corner radius below 8px. Even "square" elements should feel soft.
*   **No Pure Greys:** Never use #000000 or neutral #888888. Always tint your neutrals with the Forest Green (`on_surface_variant`) to maintain the organic warmth.
*   **No Crowding:** If the POS screen feels "busy," remove elements. The Liquid Minimalist aesthetic relies on the user focusing on one flow at a time.