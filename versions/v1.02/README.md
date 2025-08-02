# HaikanCAD v1.02

## New Features

This version introduces drawing functionality using snapping logic.

### Tap or click-to-draw:
- **Desktop**: click once to start a line, click again to end it
- **Mobile**: hold or drag to start a line, release, then hold or drag again to finish
- Live snapping preview updates as you move

### Rules:
- Only straight lines allowed (vertical or 30° slant)
- Snaps to precomputed grid intersections
- Tap-only interaction is ignored on mobile to prevent accidental lines

### Visual:
- Line is black in light mode, white in dark mode
- Preview line is dashed while dragging

## Key Files

- `DrawLayer.jsx` – New component that renders lines
- `App.jsx` – Handles tap/click logic and segment storage
- `SnapOverlay.jsx` – Updated to emit snapped position
- `App.css` – Locks scroll/touch behavior

## Notes

- Canvas is now scroll-locked on mobile
- Touch and mouse both supported
- Snapping logic remains accurate and responsive
