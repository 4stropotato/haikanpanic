# HaikanCAD v1.09

## New Features

### Zoom & Pan (v1.09)
- Added support for pinch-to-zoom and two-finger drag to pan across the workspace.
- Grid, snapping, drawings, and magnifier now move and scale together as one unified surface.
- Snapping logic has been upgraded to account for zoom level and offset, ensuring accurate alignment even when zoomed out or far from center.
- Drawing and preview lines now remain pixel-perfect at all zoom levels with consistent thickness and snapping fidelity.

## Key Files

- `App.jsx` – Introduces zoom and offset state, applies unified transformations across all components, and fixes snapping bugs during pan/zoom.
- `Magnify.jsx` – Continues to render the magnifier using live canvas compositing; now inherits correct workspace transforms via props.
- `SnapOverlay.jsx` – Applies zoom and offset to correctly position the red crosshair on the snapped grid point regardless of view state.
- `DrawLayer.jsx` – Applies zoom + offset transforms to all line drawings and previews to ensure workspace consistency.
- `IsoGrid.jsx` – Now renders a large virtual grid with zoom and pan transforms for a seamless infinite canvas illusion.

## Notes

- This release focuses on introducing mobile-friendly zooming and panning while preserving the fixed-grid drawing experience.
- All workspace components are now fully synchronized across transformations, ensuring precision drawing and snapping in any viewport.

