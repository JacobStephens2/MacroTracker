# Design System

## 1. Overview & Creative North Star: "The Precise Clinical"
This design system is built to transform raw nutritional data into a high-end, editorial health experience. Eschewing the cluttered look of typical fitness apps, our "Creative North Star" is **The Precise Clinical**. It treats health tracking like a premium scientific journal—utilizing generous white space, intentional asymmetry, and deep tonal layering to create an environment that feels energetic yet disciplined.

The system breaks the "bootstrap template" look by removing traditional borders and lines, relying instead on structural typography and shifting surface elevations to guide the user’s eye through complex nutritional data.

---

## 2. Colors
Our palette is anchored by a vibrant emerald, balanced with macro-specific functional colors and a sophisticated neutral scale.

### Core Tokens
- **Primary Actions:** `primary` (#006C49) and `primary_container` (#10B981). Use the vibrant Emerald (#10B981) for highlights and progress completion.
- **Functional Macros:**
    - **Carbs:** `secondary` (#0058BE) / Blue (#3B82F6).
    - **Protein:** `error` (#BA1A1A) / Red (#EF4444).
    - **Fat:** `tertiary` (#855300) / Orange (#F59E0B).
- **Surface Neutrals:** `surface` (#F8F9FF) to `surface_container_highest` (#D9E3F6).

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. For example, a `surface_container_low` card should sit on a `surface` background. If you feel the need for a line, increase the spacing (`spacing-8`) or shift the tonal tier of the container instead.

### The "Glass & Gradient" Rule
To avoid a flat, "out-of-the-box" feel:
- **Floating Elements:** Use Glassmorphism for navigation bars or floating action buttons. Apply `surface_container_lowest` at 80% opacity with a `backdrop-blur` of 12px.
- **Visual Soul:** Apply a subtle linear gradient to the `primary_container` (Emerald) for hero actions, transitioning from `#10B981` to `#059669` at a 145-degree angle.

---

## 3. Typography
We use **Inter** exclusively to lean into a clean, sans-serif clinical aesthetic. The hierarchy focuses on extreme contrast between display weights and label precision.

- **Display (Large Data):** `display-md` (2.75rem). Use this for the primary Calorie count inside rings. It should feel authoritative.
- **Headlines (Meal Times):** `headline-sm` (1.5rem). Semi-bold. These anchor the page sections.
- **Body (Food Items):** `body-md` (0.875rem). Regular weight. Use `on_surface_variant` (#3C4A42) for descriptions (e.g., "Publix" or "Goya") to create a clear secondary hierarchy.
- **Labels (Macro Stats):** `label-md` (0.75rem). All-caps or tabular figures for data alignment.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural shadows.

### The Layering Principle
Stack tiers to create natural lift. 
- **Base:** `surface` (#F8F9FF)
- **Section:** `surface_container_low` (#EFF4FF)
- **Interactive Card:** `surface_container_lowest` (#FFFFFF)

### Ambient Shadows
When a card must "float" (e.g., a Daily Progress Card), use an extra-diffused shadow:
- `box-shadow: 0 12px 32px -4px rgba(18, 28, 42, 0.06);`
The shadow uses a tinted version of the `on_surface` color to mimic natural light.

### The "Ghost Border" Fallback
If accessibility requires a container edge, use a **Ghost Border**: `outline_variant` (#BBCABF) at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Daily Progress Card
- **Structure:** `surface_container_lowest` background, `xl` (1.5rem) rounded corners.
- **Content:** Features the 926 kcal circular ring on the left (asymmetric layout). Use a heavy stroke for the progress ring and a light `outline_variant` for the remaining track.
- **Macros:** Macro Breakdown Rows are stacked on the right, using `spacing-4` vertical gaps instead of dividers.

### Macro Breakdown Row
- **Visuals:** Horizontal progress bars with `full` (9999px) rounding.
- **Color Coding:** Use the specific Carbs (Blue), Protein (Red), and Fat (Orange) tokens.
- **Detail:** Place "remaining" counts in a `label-sm` style using the `primary` (Emerald) color to highlight positive health goals.

### Logged Food Entry
- **Interaction:** No borders between entries. Use `spacing-6` between items.
- **Nutrition Badges:** Small, `sm` (0.25rem) rounded chips. 
    - *Background:* Tonal match to macro (e.g., Light Blue background with Dark Blue text).
    - *Text:* `label-sm` bold.

### Buttons
- **Primary:** `primary_container` (Emerald) background, `on_primary_container` text. `lg` (1.0rem) rounding.
- **Ghost Action (e.g., "+ Add Food"):** A `ghost-border` dashed container. This provides a clear target without adding visual weight.

---

## 6. Do's and Don'ts

### Do
- **Do** use `spacing-12` or `spacing-16` to separate major meal sections (Breakfast vs. Lunch).
- **Do** use Tabular Figures (font-variant-numeric: tabular-nums) for all calorie and gram counts to ensure vertical alignment in lists.
- **Do** apply a `surface_bright` (#F8F9FF) background to the entire app to keep the "Clinical" feel fresh.

### Don't
- **Don't** use 1px solid dividers between food items. It creates visual "stutter."
- **Don't** use pure black (#000000) for text. Always use `on_surface` (#121C2A) for better readability and a premium feel.
- **Don't** use default Inter tracking. For `display` scales, reduce tracking by -0.02em; for `labels`, increase it by 0.05em for legibility.