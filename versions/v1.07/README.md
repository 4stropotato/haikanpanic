# HaikanCAD v1.07

## New Features

### Magnifying Glass (v1.07)
- Completely removed snapshot dependency (`html2canvas` no longer used).
- Magnifier now reflects real-time zoom directly from live canvas layers.
- Lens is permanently snapped to the red crosshair’s grid-aligned position.
- Automatically composites visible layers (`IsoGrid`, `DrawLayer`, `SnapOverlay`) into the lens.
- Theme-adaptive: background color of the magnifier updates on dark/light toggle instantly.

## Key Files

- `App.jsx` – Controls magnifier state, live snapping, and synchronizes lens position with crosshair.
- `Magnify.jsx` – Renders a circular lens by compositing live canvas layers at the snapped coordinates.

## Notes

- This release focuses on real-time magnifier accuracy and visual fidelity.
- All magnifier behavior now responds live to snapping, canvas changes, and theme transitions.

