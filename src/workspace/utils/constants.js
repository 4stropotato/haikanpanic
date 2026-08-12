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

// v4.29 How fine the lattice is at a given zoom, shared by the grid that draws
// it and the snap that lands on it — so you can always place a point on a line
// you can actually see. It divides as well as it multiplies: crowded lines
// thin out, and zoomed in far enough it goes down to a single millimetre.
export function gridStride(zoom, mmPerPoint = 100) {
  const spacing = pointStep;                 // one unit, in workspace px
  let stride = 1;
  while (spacing * stride * zoom < 8 && stride < 4096) stride *= 2;
  const finest = 1 / Math.max(1, mmPerPoint);            // one millimetre
  while (spacing * stride * zoom > 110 && stride > finest) stride /= 2;
  return Math.max(stride, finest);
}
