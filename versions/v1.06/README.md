# HaikanCAD v1.06

## New Features

### Magnifying Glass (Updated in v1.06)
- Adjusted source‐coordinate calculation to remove redundant scaling compensation for accurate zoom.
- Corrected lens positioning offsets by updating CSS `top` and `left` calculations for proper centering.
- Updated `sx` and `sy` calculations in `Magnify.jsx` to use raw `x`, `y` values minus half the lens dimensions.
- Improved lens movement smoothness by applying consistent scaling factors.

## Key Files

- `App.jsx` – Updated magnifier snapshot logic and crosshair-hide timing to support scale-free touch coordinates.
- `Magnify.jsx` – Adjusted source-coordinate and lens positioning calculations for precise magnification.

## Notes
- This release focuses on improving magnifier accuracy; previous features remain unchanged.
