# HaikanCAD v1.01

## ✅ Summary

This version fixes snapping coverage and improves performance.

### Changes:
- Expanded grid intersection logic using corrected math
- Resolved "diamond-only" snapping bug on mobile
- Maintains 30° and vertical line logic with clean canvas centering
- Reduced lag by limiting intersection generation to viewport bounds

## 📂 Key Files

- `SnapOverlay.jsx` – Updated point generator
- `IsoGrid.jsx` – No changes in this version
- `App.jsx` / `App.css` – UI stable, no structural change

## 🔧 Notes

- Snapping is now uniform across all devices
- Mobile touch fully reaches edges
- Canvas still centered with `ctx.translate(width/2, height/2)`
