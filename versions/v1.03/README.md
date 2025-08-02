# HaikanCAD v1.03

## New Features

This version adds directional constraint logic for drawing lines. Line segments now snap strictly to six valid isometric angles.

### Drawing Behavior:
- **Desktop**: click once to start, click again to finish
- **Mobile**: hold or drag to start a line, release to initiate, hold/drag again to end
- Live snapping continues while previewing

### Direction Rules:
- Lines snap to the nearest of 6 allowed directions:
  - 90° (vertical ↑)
  - -90° (vertical ↓)
  - 30° (↗)
  - -30° (↘)
  - 150° (↖)
  - -150° (↙)
- Only these directions are permitted, regardless of drag angle

### Visual:
- Dashed preview while drawing
- Line color adapts to theme (white on dark, black on light)

## Key Files

- `App.jsx` – Enforces angle logic and line behavior
- `DrawLayer.jsx` – Renders confirmed and previewed lines
- `SnapOverlay.jsx` – Tracks and emits crosshair snapping positions
- `App.css` – Minor adjustments for theme/touch-locking

## Notes

- Tap-only gestures are ignored on mobile to avoid accidental input
- Draw initiation requires holding or dragging, both for start and end
- Angle snapping applies both to final lines and preview display
