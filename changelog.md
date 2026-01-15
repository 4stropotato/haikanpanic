## [v1.12] 2026-01-16
- Fixed CSS class mismatch: `magnifier-lens` → `magnifier` in Magnify.jsx to match Magnify.css
- Fixed CSS/JS size mismatch: Synced Magnify.css to use 120px (matching JS lensSize) for correct positioning
- Fixed CSS/JS z-index mismatch: Synced Magnify.css z-index to 999 (matching JS inline style)
- Fixed file naming inconsistency: `Drawlayer.jsx` → `DrawLayer.jsx` (proper PascalCase)
- Added version header comment to WorkspaceContext.js for consistency
- Removed orphan `test.html` development file from src/

## [v1.11] 2026-01-16
- Added three magnifier positioning modes:
  - **Auto-Locate**: Magnifier sits at crosshair when idle, moves above finger when holding
  - **Follow**: Magnifier always stays above finger (v1.10 behavior)
  - **Center**: Magnifier always stays at crosshair position, even when holding
- Added mode toggle button in TopBar (visible when magnifier is enabled)
- Added `isHolding` state to track touch hold for magnifier positioning
- Added `magnifyMode` state to Workspace context for mode switching
- Added `host: true` to vite.config.js for remote development access via Tailscale/LAN

## [v1.10] 2025-08-02
- Complete project refactor and modularization under new scalable architecture:
  - Introduced `workspace/` as the central orchestrator for all shared state and layout.
  - Separated logical components into dedicated subfolders:
    - `draw/` – handles all drawing and line rendering
    - `grid/` – manages isometric grid layout and rendering
    - `snap/` – handles snapping logic and red crosshair overlay
    - `magnify/` – magnifier lens compositing and rendering
    - `ui/` – top-level visual UI components (e.g. `TopBar`)
    - `utils/` – centralized math and constants (e.g. snapping logic, lens bounds, grid spacing)
- Refactored component responsibilities:
  - `App.jsx` now simply mounts `<Workspace />` for clean entry point
  - `Workspace.jsx` owns all shared zoom, pan, snap, and draw state
  - All components receive `zoom` and `offset` via props to ensure transform consistency
- Centralized all math and constants for snapping and lens rendering:
  - `utils/geometry.js` contains:
    - `snapToNearestGrid()` — now compensates for zoom and pan offsets
    - `snapToAllowedAngle()` — locks segments to 6 isometric directions
    - `getLensBounds()` — cleanly isolates magnifier cropping logic
  - `utils/constants.js` defines:
    - `dx`, `tan30`, `gridSize`, `zoomMin`, `zoomMax`, `lensSize`, etc.
    - Shared values used across all components
- Improved magnifier integration:
  - Lens now pulls real-time canvas data from all workspace layers (grid, draw, crosshair)
  - Background dynamically adapts to current theme
  - Fully respects zoom/pan to always display accurate magnified region under crosshair
- Drawing and snapping accuracy improvements:
  - Crosshair now locks to grid even when zoomed and panned
  - All drawn lines follow snapped coordinates in zoom-aware space
  - Line widths and dash patterns scale consistently across zoom levels
- Version comments enforced across all logic files:
  - All functional files (`geometry.js`, `DrawLayer.jsx`, `SnapOverlay.jsx`, etc.) annotated with `// v1.10+` comments
  - Enables precise change tracking, auditing, and rollback

## [v1.09] 2025-08-01
- Added pinch-to-zoom and 2-finger pan support on mobile devices.
- Unified zoom + pan transform system applied across grid, drawings, snapping, and magnifier.
- Rewrote `IsoGrid.jsx` to render a much larger virtual grid with smooth scaling and infinite scroll illusion.
- Updated `DrawLayer.jsx` to draw all lines in transformed workspace space, fixing previous misalignment bugs when zoomed.
- Fixed snapping inaccuracies by transforming snap calculations to compensate for zoom and offset.
- `SnapOverlay.jsx` crosshair now accurately tracks snapped points under all zoom/pan states.

## [v1.08] 2025-07-29
- Upgraded all canvas layers to support retina-resolution rendering using devicePixelRatio.
- Rewrote `DrawLayer.jsx` to render sharp 2px vector-style lines with rounded caps and joins.
- Updated `SnapOverlay.jsx` to draw red crosshair on a HiDPI-aware overlay.
- Replaced fixed-size lens rendering with transform-scaled compositing in `Magnify.jsx`.
- Lens now renders pixel-perfect zoom with 1:1 alignment to live snapped coordinates.
- Internal crosshair added inside the magnifier to indicate exact center of magnification.

## [v1.07] 2025-07-29
- Removed `html2canvas` dependency and eliminated static snapshots.
- Rewrote `Magnify.jsx` to composite live canvas layers directly (IsoGrid, DrawLayer, SnapOverlay).
- Lens now snaps in real time to the red crosshair using `lastSnap` updates.
- Theme background behind lens updates automatically with dark/light toggle.
- Improved alignment and stability of magnifier by clamping draw bounds inside canvas limits.

## [v1.06] 2025-07-22
- Adjusted source-coordinate calculation to remove redundant scaling compensation for accurate zoom.
- Corrected lens positioning offsets by updating inline `top` and `left` style calculations in `Magnify.jsx` for proper centering.
- Removed icons from inline version comments and improved comment descriptions in `App.jsx`.
- Updated `sx` and `sy` calculations in `Magnify.jsx` to use raw `x`, `y` values minus half the lens dimensions.
- Improved lens movement smoothness by applying consistent scaling factors.

## [v1.05] 2025-07-07
- Added magnifying glass feature for zooming:
  - Toggle on or off from the top bar
  - Uses a high-resolution snapshot of the workspace
  - Follows mouse or finger movement for real-time magnification
  - Circular lens with border and subtle shadow
  - Crosshair automatically hides during snapshot to avoid overlap
- Locked mobile gestures to prevent zoom and scroll during drawing
- Optimized workspace rendering before taking magnifier snapshots
- Cached magnifier images for smoother performance on slower devices
- Updated button styling for better consistency across light and dark themes
- Added traditional version comments in `Magnify.jsx` and related files

## [v1.04] 2025-06-13
- Refactored drawing flow to follow new interaction rules:
  - Hold -> Release (freeze crosshair)
  - Tap to confirm line start (based on frozen point)
  - Second Hold -> Release to finalize line
- Added double-tap cancel to reset current preview line
- Crosshair disappears on tap (after confirmation)
- Drawing start point now correctly references frozen release point
- Improved internal reset logic on hold-to-restart
- Added traditional version comments inside `SnapOverlay.jsx`

## [v1.03] 2025-06-09
- Enforced strict 6-angle snapping for line segments:
  - 90°, -90°, ±30°, ±150° only
- Updated preview and finalized lines to match nearest valid direction
- Improved mobile UX (start/end requires hold or drag-release)
- Tap-only interactions remain ignored on touch devices
- Refined angle-snapping logic using vector-based direction matching

## [v1.02] 2025-06-09
- Added tap-to-place node system with snapping
- Introduced line drawing feature with live snapping preview
- Desktop: click to start and click to finish lines
- Mobile: now uses hold/drag-then-release to start, and another hold/release to end
- Supports straight lines only (vertical or 30° slant)
- Line preview is dashed; color adapts to theme (light/dark)
- Prevented mobile scroll/drag behavior for fixed canvas

## [v1.01] 2025-06-08
- Fixed diamond-shaped snapping limit by correcting row/col math
- Full edge-to-edge snapping (mobile + desktop)
- Improved performance (fewer points, no lag)

## [v1.0] 2025-06-07
- Initial isometric grid + crosshair snapping
- Touch and mouse input basics
- Grid centering and dark/light theming

