import { dx, tan30, snapRange, endpointSnapThreshold } from "./constants"; // v1.15+ added endpoint threshold
import { viewport } from "./viewport"; // v1.18+ shared workspace size (matches canvas layers)

// v1.10+ Find nearest snapped isometric grid point given screen input
export function snapToNearestGrid(point, zoom, offset) {
  const centerX = viewport.w / 2 + offset.x;                        // v1.18+ shared center X
  const centerY = viewport.h / 2 + offset.y;
  const px = (point.x - centerX) / zoom;                            // v1.10+ convert to workspace X
  const py = (point.y - centerY) / zoom;                            // v1.10+ convert to workspace Y

  let nearest = null;                                               // v1.10+ best snapped point
  let minDist = Infinity;                                           // v1.10+ shortest distance found

  for (let i = -snapRange; i <= snapRange; i++) {                   // v1.10+ iterate grid column
    const x1 = i * dx;                                              // v1.10+ first axis line (vertical)
    for (let j = -snapRange; j <= snapRange; j++) {                 // v1.10+ iterate grid row
      const x2 = j * dx;                                            // v1.10+ second axis line (angled)
      const x = (x1 + x2) / 2;                                      // v1.10+ isometric midpoint X
      const y = tan30 * (x - x1);                                   // v1.10+ isometric midpoint Y
      const dist = (px - x) ** 2 + (py - y) ** 2;                   // v1.10+ squared distance to input
      if (dist < minDist) {                                       
        minDist = dist;                                             // v1.10+ update closest match
        nearest = { x, y };                                         // v1.10+ store snapped point
      }
    }
  }

  return nearest;                                                   // v1.10+ return nearest snapped coordinate
}

// v1.10+ Lock a freeform segment to the closest of 6 isometric angles
export function snapToAllowedAngle(start, end) {
  const dx = end.x - start.x;                                       // v1.10+ delta X
  const dy = end.y - start.y;                                       // v1.10+ delta Y
  const len = Math.sqrt(dx * dx + dy * dy);                         // v1.10+ line length
  if (len === 0) return { start, end };                             // v1.10+ ignore 0-length lines

  const angle = Math.atan2(dy, dx);                                 // v1.10+ actual angle
  const directions = [                                              // v1.10+ legal isometric directions
    Math.PI / 2, -Math.PI / 2,                                      // ↑ ↓
    Math.PI / 6, -Math.PI / 6,                                      // ↗ ↘
    (5 * Math.PI) / 6, -(5 * Math.PI) / 6                           // ↖ ↙
  ];

  let best = directions[0];                                         // v1.10+ initial best direction
  let minDiff = Math.abs(angle - best);                             // v1.10+ initial difference
  for (let i = 1; i < directions.length; i++) {
    const diff = Math.abs(angle - directions[i]);                   // v1.10+ compare all candidates
    if (diff < minDiff) {
      minDiff = diff;                                               // v1.10+ update minimum
      best = directions[i];                                         // v1.10+ update best angle
    }
  }

  return {
    start,                                                          // v1.10+ original starting point
    end: {
      x: start.x + len * Math.cos(best),                            // v1.10+ adjusted X with snapped angle
      y: start.y + len * Math.sin(best),                            // v1.10+ adjusted Y with snapped angle
    },
  };
}

// v1.10+ Compute safe crop bounds for magnifier lens compositing
export function getLensBounds(x, y, canvasWidth, canvasHeight, dpr, lensSize, zoom) {
  const cx = x * dpr;                                               // v1.10+ scaled center X
  const cy = y * dpr;                                               // v1.10+ scaled center Y
  const src = lensSize / zoom;                                      // v1.10+ visible crop size
  const sx = Math.max(0, Math.min(cx - src / 2, canvasWidth - src)); // v1.10+ clamp crop left
  const sy = Math.max(0, Math.min(cy - src / 2, canvasHeight - src)); // v1.10+ clamp crop top
  return { sx, sy, src };                                           // v1.10+ return crop parameters
}

// v1.15+ Find nearest line endpoint within threshold distance
export function findNearestEndpoint(screenPoint, lines, zoom, offset) {
  const centerX = viewport.w / 2 + offset.x;                        // v1.18+ shared center X
  const centerY = viewport.h / 2 + offset.y;

  let nearest = null;                                               // v1.15+ closest endpoint
  let minDist = Infinity;                                           // v1.15+ minimum distance found

  for (const line of lines) {
    // v1.15+ check start endpoint
    const startX = centerX + line.start.x * zoom;
    const startY = centerY + line.start.y * zoom;
    const startDist = Math.hypot(screenPoint.x - startX, screenPoint.y - startY);
    if (startDist < minDist && startDist < endpointSnapThreshold) {
      minDist = startDist;
      // v1.15+ direction: from start toward end (outgoing from this endpoint)
      const angle = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
      nearest = { x: startX, y: startY, workspacePoint: line.start, angle };
    }

    // v1.15+ check end endpoint
    const endX = centerX + line.end.x * zoom;
    const endY = centerY + line.end.y * zoom;
    const endDist = Math.hypot(screenPoint.x - endX, screenPoint.y - endY);
    if (endDist < minDist && endDist < endpointSnapThreshold) {
      minDist = endDist;
      // v1.15+ direction: from end toward start (outgoing from this endpoint)
      const angle = Math.atan2(line.start.y - line.end.y, line.start.x - line.end.x);
      nearest = { x: endX, y: endY, workspacePoint: line.end, angle };
    }
  }
  return nearest;                                                   // v1.15+ return nearest or null
}

