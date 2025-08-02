# HaikanCAD v1.04

## New Features

This version introduces refined touch interaction and full line control logic, making drawing feel more deliberate and accurate — especially on mobile.

### Drawing Behavior:
- **Hold or drag**: freezes crosshair at snapped location
- **Tap after release**: confirms the start of the line
- **Second hold/release**: finalizes the line from frozen start to new point
- **Double tap**: cancels current preview line

### Interaction Improvements:
- Crosshair now disappears after tap to reduce visual clutter
- Drawing resets properly on a new hold gesture (starts fresh)
- Frozen starting point logic prevents accidental drift during fast drawing

### Visual:
- Line endpoints now align exactly with snapped grid intersections
- Fixed occasional overshoot/undershoot issues on final line segment
- Crosshair stays crisp and centered during drawing flow

## Key Files

- `App.jsx` – Implements new tap/hold logic, start/reset behavior
- `SnapOverlay.jsx` – Emits accurately snapped points for mobile/desktop
- `DrawLayer.jsx` – Renders finalized and preview lines cleanly
- `App.css` – Maintains theme visuals and touch optimizations

## Notes

- Snap precision is now fully synced across preview and final lines
- You can cancel mid-draw anytime with a double tap
- Line starts only from frozen points (released from a hold)
