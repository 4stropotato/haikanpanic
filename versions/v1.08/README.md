# HaikanCAD v1.08

## New Features

### Magnifying Glass (v1.08)
- Lens rendering is now retina-accurate: fully respects device pixel ratio for ultra-sharp results.
- Crosshair alignment remains fixed to the snapped grid coordinate in real-time.
- Draws internal crosshair in the lens with smooth anti-aliased lines.
- Lens background color always matches dark/light mode automatically.
- Canvas compositing respects zoom scaling and canvas transforms for pixel-perfect accuracy.

## Key Files

- `App.jsx` – Manages magnifier state, grid visibility, drawing interactions, and snaps the lens to the current crosshair.
- `Magnify.jsx` – Composites all live canvas layers (grid, drawing, overlays) into a retina-scaled circular lens at the snapped point.
- `SnapOverlay.jsx` – Displays a real-time red crosshair snapped to the nearest grid intersection; now rendered on a retina-aware canvas.
- `DrawLayer.jsx` – Draws all confirmed lines and previews on a retina-aware canvas for sharp vector-like rendering.
- `IsoGrid.jsx` – Renders the full isometric grid with high-DPI scaling and origin-centered precision.

## Notes

- This release is dedicated to improving magnifier fidelity and canvas rendering precision across all devices.
- All drawing and overlay layers now respect device pixel ratio and scale crisply at any zoom level.

