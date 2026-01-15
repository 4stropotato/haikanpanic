# HaikanCAD v1.12

## Bug Fixes & Cleanup

### CSS Class Mismatch Fix (v1.12)
- Fixed `Magnify.jsx` using `className="magnifier-lens"` while `Magnify.css` defined `.magnifier`
- Magnifier now properly inherits styles from CSS (size, shadow, overflow)

### CSS/JS Size & Z-Index Sync (v1.12)
- Synced `Magnify.css` width/height from 100px to 120px to match JS `lensSize` constant
- Synced `Magnify.css` z-index from 20 to 999 to match JS inline style
- Fixes magnifier positioning offset caused by CSS/JS dimension mismatch

### File Naming Consistency (v1.12)
- Renamed `Drawlayer.jsx` to `DrawLayer.jsx` to follow PascalCase convention
- Consistent with other component files (IsoGrid.jsx, SnapOverlay.jsx, etc.)

### Version Header Added (v1.12)
- Added `// [v1.10] Initial WorkspaceContext...` header to WorkspaceContext.js
- All workspace files now have proper version tracking headers

### Orphan File Cleanup (v1.12)
- Removed `test.html` from src/ (development-only canvas test, not used in app)

## Key Files Changed

- `workspace/magnify/Magnify.jsx` – Fixed className from `magnifier-lens` to `magnifier`
- `workspace/magnify/Magnify.css` – Synced size (120px) and z-index (999) with JS
- `workspace/draw/DrawLayer.jsx` – Renamed from `Drawlayer.jsx`
- `workspace/WorkspaceContext.js` – Added version header comment
- `src/test.html` – Deleted (unused development file)

## Notes

- This is a maintenance release focused on code consistency and cleanup
- No functional changes to the application behavior
- All changes applied to both `src/` and `versions/v1.12/src/` for snapshot consistency
