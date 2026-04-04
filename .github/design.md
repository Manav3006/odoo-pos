# Design System Specification: The Organic Editorial POS

## 1. Overview & Creative North Star
**Creative North Star: "The Botanical Ledger"**
This design system rejects the clinical, "plastic" feel of traditional SaaS. Instead, it draws inspiration from high-end editorial magazines and organic hospitality. We are building a "Botanical Ledger"—a system that feels as tactile as a heavy-stock paper menu and as fluid as a morning pour-over.

To move beyond the "template" look, we utilize **Intentional Asymmetry** and **Tonal Depth**. By favoring whitespace over lines and background shifts over borders, the interface breathes. It creates an environment where the barista isn't just "inputting data" but navigating a curated digital experience that mirrors the premium nature of the coffee itself.

---

## 2. Colors & Atmospheric Tones
The palette is rooted in a "Forest-to-Cream" spectrum. We use deep greens for authority and soft sages for utility.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px solid borders are strictly prohibited for sectioning.
Structure must be defined through:
1. **Background Color Shifts:** Placing a `surface-container-low` component against a `surface` background.
2. **Tonal Transitions:** Using padding and color blocks to define the edge of an interactive area.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
- **Base Layer:** `surface` (#f1fdea) for the main application background.
- **Mid Layer:** `surface-container` (#e6f2de) for secondary sidebars or navigation regions.
- **Top Layer:** `surface-container-highest` (#dae6d3) for active order modules or high-priority modals.

### The "Glass & Signature Texture" Rule
- **Floating Elements:** Use `surface-container-lowest` (#ffffff) with a 60% opacity and a `20px` backdrop-blur for floating action panels (e.g., "Add to Cart" confirmation).
- **CTA Soul:** Apply a subtle linear gradient to main action buttons transitioning from `primary` (#324122) to `primary_container` (#495937) at 135 degrees. This prevents "flatness" and adds a premium sheen.

---

## 3. Typography
We use a high-contrast pairing of **Manrope** for editorial impact and **Inter** for transactional clarity.

* **Display & Headlines (Manrope):** These are the "Voice" of the brand. Use `display-md` for the shop name and `headline-sm` for category headers (e.g., *Artisan Brews*). The tight tracking and heavy weight convey artisanal authority.
* **Titles & Body (Inter):** Used for functional data. `title-md` is the standard for product names, while `body-md` handles descriptions.
* **Currency (INR ₹):** Always rendered in `title-lg` (Inter) with a semi-bold weight to ensure the price is the most legible element on the product card.

---

## 4. Elevation & Depth
We define hierarchy through **Tonal Layering** rather than structural scaffolding.

* **The Layering Principle:** Avoid shadows for static elements. A `surface-container-low` section sitting on a `surface` background creates a soft, natural lift.
* **Ambient Shadows:** For "floating" states (modals/popovers), use an extra-diffused shadow: `0px 12px 32px rgba(20, 30, 18, 0.06)`. Note the tint: the shadow uses a version of the `on-surface` color, not pure black.
* **The "Ghost Border":** If accessibility requires a stroke (e.g., in high-glare environments), use `outline-variant` (#c5c8bc) at **15% opacity**.
* **Glassmorphism:** Use for "Order Summary" sidebars to allow the vibrant product photography to bleed through the background, making the UI feel integrated and modern.

---

## 5. Components

### Buttons (The "Tactile" Standard)
- **Primary:** Gradient-filled (`primary` to `primary_container`), `xl` roundedness (1.5rem). High-contrast `on_primary` text.
- **Secondary:** `surface-container-highest` background. No border. Soft sage text.
- **Interaction:** On hover, increase the gradient intensity. On active (click), scale the button to 98%.

### Product Cards
- **Construction:** Use `surface-container-low` (#ebf7e4) with `lg` (1rem) corners.
- **No Lines:** Do not use dividers between the image and text. Use `1.5rem` of vertical whitespace to separate the product title from the price (₹).
- **Interactive State:** On selection, the card should transition to `primary_container` with `on_primary_container` text.

### Inputs & Search
- **Visuals:** Use `surface-container-lowest` (pure white) to draw the eye to the input field.
- **States:** Focus state is indicated by a 2px `surface_tint` (#536441) glow—never a harsh solid line.

### Chips (Category Filters)
- **Style:** Pill-shaped (`full` roundedness).
- **Unselected:** `surface-container-high` background with `on_surface_variant` text.
- **Selected:** `primary` background with `on_primary` text.

### The "Order Tray" (Context-Specific)
Instead of a standard list, the Order Tray uses nested containers. Each line item sits on a `surface-container-lowest` card with a `sm` shadow to indicate it is "removable" and "movable."

---

## 6. Do’s and Don'ts

### Do
- **Do** use large, generous padding. Premium feels like space.
- **Do** use `INR (₹)` before the numerical value without a space (e.g., ₹450).
- **Do** lean into the "Sage" tones for success states instead of bright neon greens.
- **Do** use `xl` (1.5rem) roundedness for the primary "Checkout" container to make it the softest, most inviting touchpoint.

### Don’t
- **Don't** use 100% black (#000000). Use the "Deep Forest" (#071006) for all dark text.
- **Don't** use standard dividers. If you must separate items, use a `1px` line with `outline-variant` at 10% opacity, or simply a `16px` gap.
- **Don't** use "default" system shadows. They are too heavy for this organic palette.
- **Don't** cram the screen. If the POS feels busy, increase the background `surface` area.