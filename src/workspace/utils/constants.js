export const dx = 20;                             // v1.10+ grid spacing (px)
export const tan30 = Math.tan(Math.PI / 6);       // v1.10+ tan(30°) slope ≈ 0.577
export const gridSize = 5000;                     // v1.10+ half-extent of grid canvas (px)
// v3.28 Far enough back to see a whole site. A quarter scale was barely two
// rooms, and the grid thins itself now, so the sheet stays readable however
// far out you pull.
export const zoomMin = 0.05;                      // v1.10+ minimum zoom level
export const zoomMax = 4;                         // v1.10+ maximum zoom level
export const snapRange = 200;                     // v1.10+ search radius for snapping

export const lensSize = 120;                      // v1.10+ magnifier lens diameter (px)
export const magnifyZoom = 1;                     // v1.10+ magnification scale
export const crosshairLength = 12;                // v1.10+ inner crosshair arm length
export const endpointSnapThreshold = 15;          // v1.15+ pixel distance for endpoint snapping

export const pointStep = dx * tan30;              // v1.17+ 1 "point" = dot-to-dot distance (px), same in all 6 directions
