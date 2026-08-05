// v2.09 GL/FL datum plane geometry — shared by the renderer and the hit
// testing, so what you see is exactly what you can drag.
//
// The ground is spanned by the two horizontal iso axes, so it projects to a
// rhombus. A node's drop to the plane must follow the DRAWN geometry (the
// sketch is schematic: drawn length and true length are independent), while
// the EL callout reports the TRUE elevation from the typed lengths.
import { pointStep } from "./constants";
import { nodeElevations } from "../workshop/pipe3d";

export const ISO_U = { x: Math.cos(-Math.PI / 6), y: Math.sin(-Math.PI / 6) };
export const ISO_V = { x: Math.cos((-5 * Math.PI) / 6), y: Math.sin((-5 * Math.PI) / 6) };

const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const VERTICAL_EPS = 0.5;

// Height of every node above the lowest one, in DRAWN pixels. Only vertical
// segments change height; the other four iso directions are horizontal.
export function drawnHeights(lines) {
  const heights = new Map();
  for (const line of lines) {
    const startKey = key2D(line.start);
    const endKey = key2D(line.end);
    if (!heights.has(startKey)) heights.set(startKey, 0);
    const rise = Math.abs(line.end.x - line.start.x) < VERTICAL_EPS
      ? line.start.y - line.end.y
      : 0;
    if (!heights.has(endKey)) heights.set(endKey, heights.get(startKey) + rise);
  }
  let min = Infinity;
  for (const value of heights.values()) min = Math.min(min, value);
  if (!Number.isFinite(min)) return heights;
  for (const [key, value] of heights) heights.set(key, value - min);
  return heights;
}

export function glPlaneGeometry(lines, mmPerPoint, options = {}) {
  const { sizeMm = 0, offsetMm = 0, center = null } = options;
  if (!lines.length) return null;

  const pxPerMm = pointStep / mmPerPoint;
  const heights = drawnHeights(lines);
  const elevations = nodeElevations(lines, mmPerPoint);
  const shift = offsetMm * pxPerMm;

  const nodes = [];
  const seen = new Set();
  for (const line of lines) {
    for (const point of [line.start, line.end]) {
      const key = key2D(point);
      if (seen.has(key)) continue;
      seen.add(key);
      const height = heights.get(key) ?? 0;
      nodes.push({
        point,
        // where this node lands on the datum, in drawn pixels
        ground: { x: point.x, y: point.y + height + shift },
        elevation: (elevations.get(key) ?? 0) + offsetMm,
      });
    }
  }

  let cx = 0;
  let cy = 0;
  for (const node of nodes) { cx += node.ground.x; cy += node.ground.y; }
  cx /= nodes.length;
  cy /= nodes.length;
  if (center) { cx = center.x; cy = center.y; }

  let reach = 0;
  for (const node of nodes) {
    const dx = node.ground.x - cx;
    const dy = node.ground.y - cy;
    reach = Math.max(
      reach,
      Math.abs((dx / (2 * ISO_U.x)) - dy),
      Math.abs((-dx / (2 * ISO_U.x)) - dy),
    );
  }
  const half = sizeMm > 0 ? (sizeMm / 2) * pxPerMm : (reach * 1.4) + (pointStep * 3);

  const corners = [
    { x: cx + ((ISO_U.x + ISO_V.x) * half), y: cy + ((ISO_U.y + ISO_V.y) * half) },
    { x: cx + ((ISO_U.x - ISO_V.x) * half), y: cy + ((ISO_U.y - ISO_V.y) * half) },
    { x: cx - ((ISO_U.x + ISO_V.x) * half), y: cy - ((ISO_U.y + ISO_V.y) * half) },
    { x: cx - ((ISO_U.x - ISO_V.x) * half), y: cy - ((ISO_U.y - ISO_V.y) * half) },
  ];

  return { cx, cy, half, corners, nodes, pxPerMm };
}

// Size in mm implied by dragging a corner to `point`.
export function sizeFromCorner(point, cx, cy, mmPerPoint) {
  const dx = point.x - cx;
  const dy = point.y - cy;
  const a = Math.abs((dx / (2 * ISO_U.x)) - dy);
  const b = Math.abs((-dx / (2 * ISO_U.x)) - dy);
  const half = Math.max(a, b, pointStep);
  return Math.round(((half * 2) / (pointStep / mmPerPoint)) / 50) * 50;
}
