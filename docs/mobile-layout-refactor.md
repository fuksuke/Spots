# Mobile Layout Refactor Plan

## Background
- Current SPA layout evolved from desktop-first assumptions; on mobile it relies on multiple fixed-position layers and manual viewport math.
- Product direction now prioritises a resilient mobile experience with consistent safe-area handling, keyboard behaviour, and map resizing.
- This branch (`feature/mobile-layout-refactor`) isolates the redesign so existing releases on `main` remain untouched.

## Current Implementation Snapshot
- `.app-shell` uses a two-column CSS grid even below 1024px, falling back to `display:none` for the sidebar but still depending on grid rows and manual `margin-top` offsets (`frontend/src/styles.css`).
- Header (`HeaderBar`) and category tabs (`CategoryTabs`) switch to `position:fixed`; the main content area receives hard-coded `height/min-height` via `calc(100vh - …)` plus safe-area totals.
- Safe-area insets are added into constant height tokens (`--mobile-header-total`, `--mobile-action-bar-total`), so any content growth (language changes, badge counts) desynchronises scroll bounds.
- `MapView` observes layout heights in JS and force-writes inline `height`/`min-height` onto its containers before calling `map.resize()` multiple times (`frontend/src/components/MapView.tsx`).

## Primary Issues vs Best Practices
1. **Layout paradigm mismatch** – grid + fixed stacking conflicts with the proposed single-column flex layout; propagating `min-height:0` is inconsistent across nested elements.
2. **Viewport sizing fragility** – reliance on `vh`/`dvh` fallbacks and inline `calc()` breaks when browser UI chrome shifts (Safari address bar, Android overlay keyboard).
3. **Multiple fixed layers** – header, tabs, and action bar remain fixed simultaneously, causing scroll-jank and keyboard collisions; guideline recommends keeping only one fixed element.
4. **Dynamic height blind spots** – tab wrapping, translation changes, and notification badges do not update the CSS subtraction formula, so list/map heights drift.
5. **Safe area coupling** – padding and height share the same tokens, making it hard to manage notch insets independently.
6. **Accessibility gaps** – no `prefers-reduced-motion` overrides; IME focus does not adjust the action bar; tap targets require auditing.

## Target Architecture
- Base layout becomes a vertical flex stack: root wrappers (`html`, `body`, `#root`, `.app-shell`) adopt `display:flex; flex-direction:column; min-height:100svh` with clear `min-height:0` propagation.
- Sidebar collapses entirely on mobile; header and category tabs switch to `position:sticky` (not fixed) with consistent top offsets derived from CSS custom properties.
- Only the action bar keeps `position:fixed`; safe-area padding is handled via `env(safe-area-inset-bottom)` and toggleable classes when the keyboard is open.
- Introduce a shared `useElementSizeVars` helper that attaches `ResizeObserver` to header, tabs, and footer, emitting `--header-height`, `--tabs-height`, `--footer-height` on the root.
- `main` gains `overflow:auto` and computes available space purely through flex min-height rules plus a single CSS expression: `block-size: calc(100svh - var(--header-height) - var(--tabs-height) - var(--footer-height));` with fallbacks `dvh` → `vh` layered in order.
- Update `MapView` to consume the CSS-driven size (no inline height writes) and throttle `map.resize()` hooks to layout/viewport events only.

## Workstreams
1. **Layout Refactor (CSS/markup)**
   - Convert `app-shell` and `layout-column` to flex layouts below the mobile breakpoint.
   - Replace fixed positioning of header/tabs with sticky variants; remove manual `margin-top` and `height` calculations from `.content-area`.
   - Normalise z-index scale and document tokens (header 10, tabs 11, footer 12, modal 1000, etc.).

2. **Dynamic Metrics & Safe Areas**
   - Build `useElementSizeVars` (or similar) to watch header/tabs/footer/action bar.
   - Set CSS custom properties on a layout root element; guard for ResizeObserver availability.
   - Split safe-area usage so padding relies on `env()` while height math uses raw measurements.

3. **Map Integration**
   - Refactor `MapView` container sizing to depend on CSS variables; drop `updateExplicitHeights()` inline overrides.
   - Simplify resize strategy to `ResizeObserver`, `visualViewport`, `orientationchange`, and view-mode toggles.
   - Validate map rendering across map/list switches and modal overlays.

4. **Keyboard & Accessibility Enhancements**
   - Detect focus/keyboard visibility to push or hide the action bar (e.g., `.is-keyboard-open`).
   - Add `@media (prefers-reduced-motion: reduce)` to neutralise large transitions.
   - Audit tap target dimensions (≥44px) in header/footer buttons.

5. **Testing & QA**
   - Manual runs on iOS Safari (with/without installed PWA), Android Chrome, desktop Chrome devtools device emulation.
   - Verify orientation changes, map/list toggles, category management modal, auth modal, and Spot creation flow.
   - Regression on notification badges, admin panel, and map callouts.

## Open Questions
- Should the action bar hide on scroll-down behaviour be introduced now or deferred?
- How should we expose the CSS variables to non-map components (e.g., search overlays) – via context hook or global data attributes?
- Do we keep existing desktop grid layout untouched, or migrate it to flex for consistency?

## Next Steps
1. Prototype flex-based mobile shell and sticky header/tabs in isolation (Storybook or a dedicated route) before integrating.
2. Implement the `ResizeObserver` utility and test CSS variable propagation across view modes.
3. Adjust `MapView` sizing logic to consume the new variables; run smoke tests on actual devices.
4. Iterate on keyboard handling and accessibility audits before merging back into `main`.
