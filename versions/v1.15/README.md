# HaikanCAD v1.15

## Endpoint Snapping with Directional Elbow Indicator

### Features
- Cursor snaps to existing line endpoints with priority over grid
- Green elbow symbol (L-shape with curved corner + dot) appears when near an endpoint
- Elbow rotates based on the direction of the existing pipe
- Shows incoming pipe direction and possible new direction
- Red crosshair for grid snap, green elbow for endpoint snap

### Visual Indicators
| Indicator | Meaning |
|-----------|---------|
| Red crosshair | Snapped to grid point |
| Green L-elbow | Snapped to line endpoint (shows pipe direction) |

### Elbow Symbol
- L-shape with curved corner (C-bend)
- One arm shows incoming pipe direction
- Other arm shows perpendicular isometric direction
- Green dot at center connection point
- Automatically rotates based on existing line angle

### New Constants
- `endpointSnapThreshold`: 15px - distance to trigger endpoint snap

### New Functions (geometry.js)
- `findNearestEndpoint(screenPoint, lines, zoom, offset)` - finds closest endpoint and returns its direction angle

### Files Changed
- `src/workspace/utils/constants.js` - Added endpointSnapThreshold
- `src/workspace/utils/geometry.js` - Added findNearestEndpoint with direction angle
- `src/workspace/snap/SnapOverlay.jsx` - Endpoint snap detection, directional L-elbow drawing
- `src/workspace/Workspace.jsx` - Pass lines to SnapOverlay, track endpoint snap
