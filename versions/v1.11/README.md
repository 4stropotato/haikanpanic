# HaikanCAD v1.11

## New Features

### Magnifier Positioning Modes (v1.11)
- Introduced three distinct magnifier positioning modes to improve usability on touch devices:
  - **Auto-Locate**: Magnifier sits at the exact crosshair position when idle, then moves above the finger when holding/touching. Best for precision work.
  - **Follow**: Magnifier always stays above the finger position (original v1.10 behavior). Best when you need to see the magnifier while drawing.
  - **Center**: Magnifier always stays at the crosshair position, even during hold/touch. Best for stationary precision viewing.
- Mode toggle button appears in TopBar when magnifier is enabled.
- Modes cycle in order: Auto-Locate → Follow → Center → Auto-Locate...

### Remote Development Support (v1.11)
- Added `host: true` to vite.config.js to expose dev server to all network interfaces.
- Enables testing on mobile devices via Tailscale or local network without manual `--host` flag.

## Key Files Changed

- `workspace/Workspace.jsx` – Added `isHolding` state to track touch hold, `magnifyMode` state for mode switching.
- `workspace/magnify/Magnify.jsx` – Updated positioning logic to support three modes based on `isHolding` and `mode` props.
- `ui/TopBar.jsx` – Added magnify mode cycle button with labels (Auto-Locate/Follow/Center).
- `vite.config.js` – Added `server.host: true` for remote access.

## Notes

- All changes annotated with inline `// v1.11+` comments for version tracking.
- This version focuses on improving touch device usability without breaking existing functionality.
- The magnifier now provides flexible positioning options to accommodate different user preferences and use cases.
