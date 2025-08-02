# HaikanCAD v1.10

## New Features

### Full Codebase Refactor & Modularization (v1.10)
- Reorganized the entire project structure for clarity, scalability, and maintainability.
- Introduced a clean `workspace/` architecture with dedicated subfolders: `draw/`, `grid/`, `snap/`, `magnify/`, `ui/`, and `utils/`.
- All grid math and coordinate logic now centralized in `utils/geometry.js` and `utils/constants.js`, each line annotated with versioned comments.
- UI layout elements (e.g. TopBar) separated from logic to improve readability and reusability.
- Functional components now receive only the props they need and no longer rely on ad-hoc state lifting.
- Magnifier, snapping, and drawing tools now fully track zoom and pan transformations without redundant code.

## Key Files

- `App.jsx` – Minimal entry point; now only renders `<Workspace />` for clean separation of concerns.
- `workspace/Workspace.jsx` – Core logic orchestrator for zooming, panning, snapping, and drawing. Acts as the shared state provider.
- `ui/TopBar.jsx` – Encapsulated control panel using `WorkspaceContext` to toggle theme, grid, magnifier, and reset view.
- `draw/DrawLayer.jsx` – Renders snapped and preview lines with zoom-aware line scaling and accurate positioning.
- `grid/IsoGrid.jsx` – Draws a large virtual isometric grid using unified transform logic from shared constants.
- `snap/SnapOverlay.jsx` – Crosshair tracking with real-time snapping, now fully zoom+pan aware.
- `magnify/Magnify.jsx` – Real-time magnifier compositing lens using canvas source overlays. Background and theme aware.
- `utils/geometry.js` – All snapping, angle-locking, and magnifier crop logic lives here. Fully documented with inline version tags.
- `utils/constants.js` – All shared constants (grid size, zoom limits, lens dimensions) centralized for easy tuning.

## Notes

- This release lays the foundation for future growth: the codebase is now fully modular, testable, and easy to expand.
- All coordinate calculations now route through `geometry.js`, avoiding duplication and simplifying debugging.
- Every functional file in this version is annotated with inline `// v1.10+` comments for precise version tracking and auditing.

