# HaikanCAD v1.05

## New Features

This version introduces a magnifying glass tool and additional refinements to touch and drawing interactions, providing greater precision and control during isometric drafting.

### Magnifying Glass (New in v1.05)
- Toggle "Enable Magnify" from the top bar to activate.
- Creates a high-resolution snapshot of the workspace using `html2canvas`.
- Follows finger or mouse movement for real-time zoomed view.
- Circular lens UI with border and subtle shadow for clarity.
- Crosshair automatically hides during snapshot capture to avoid overlap artifacts.

### Drawing Behavior
- Same refined flow from v1.04:
  - Hold or drag: freezes crosshair at snapped location.
  - Tap after release: confirms the start of the line.
  - Second hold and release: finalizes the line from frozen start to new point.
  - Double tap: cancels current preview line.

### Interaction Improvements
- Touch gestures are locked to prevent mobile zoom or scroll during drawing.
- Improved workspace readiness check for high-resolution magnifier snapshots.
- Cached magnifier images for smoother performance.

### Visual
- New lens rendering (see `Magnify.jsx` and `Magnify.css`).
- Buttons in the top bar are now consistent across light and dark themes.
- Crosshair remains crisp but automatically hides during magnifier activation.

## Key Files

- `App.jsx` – Adds magnifier toggle logic and snapshot caching.
- `Magnify.jsx` – Implements live magnification lens with smooth follow.
- `Magnify.css` – Styles lens with border and shadow effects.
- `DrawLayer.jsx` – Renders finalized and preview lines.
- `App.css` – Updated to lock touch actions and refine themes.
- `SnapOverlay.jsx` – Crosshair logic unchanged but comments updated.

## Notes

- The magnifier is optional and can be toggled at any time without interrupting drawing.
- Snapshot generation may take a short moment on mobile devices.
- Crosshair hides automatically during snapshot capture for a clean magnified view.
