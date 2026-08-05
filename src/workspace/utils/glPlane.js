// v2.09 GL/FL datum plane geometry — shared by the renderer and the hit
// testing, so what you see is exactly what you can drag.
//
// The ground is spanned by the two horizontal iso axes, so it projects to a
// rhombus. A node drops to the plane by exactly its elevation, so the length
// of a leader is always proportional to the EL it is labelled with — an
// earlier version measured the drop from the drawn geometry instead, which
// anchored every disconnected piece at zero and made the leaders disagree
// with their own labels.
import { pointStep } from "./constants";
import { nodeElevations } from "../workshop/pipe3d";

export const ISO_U = { x: Math.cos(-Math.PI / 6), y: Math.sin(-Math.PI / 6) };
export const ISO_V = { x: Math.cos((-5 * Math.PI) / 6), y: Math.sin((-5 * Math.PI) / 6) };

const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const VERTICAL_EPS = 0.5;

// Iso-axis coordinates of a point relative to a centre: p - c = a*u + b*v.
export function isoCoords(point, cx, cy) {
  const dx = point.x - cx;
  const dy = point.y - cy;
  return {
    a: (dx / (2 * ISO_U.x)) - dy,
    b: (-dx / (2 * ISO_U.x)) - dy,
  };
}

// v2.19 A site has more than one datum — GL outside, FL on each floor, TOS
// on a platform — so planes are a list. `plane` is one entry of that list.
export function glPlaneGeometry(lines, mmPerPoint, plane = {}) {
  const {
    sizeMm = 0, sizeVMm = 0, offsetMm = 0, center = null,
  } = plane;
  if (!lines.length) return null;

  const pxPerMm = pointStep / mmPerPoint;
  const elevations = nodeElevations(lines, mmPerPoint);

  const nodes = [];
  const seen = new Set();
  for (const line of lines) {
    for (const point of [line.start, line.end]) {
      const key = key2D(point);
      if (seen.has(key)) continue;
      seen.add(key);
      const elevation = (elevations.get(key) ?? 0) + offsetMm;
      nodes.push({
        point,
        // the drop equals the elevation, so leader length reads as height
        ground: { x: point.x, y: point.y + (elevation * pxPerMm) },
        elevation,
      });
    }
  }

  let cx = 0;
  let cy = 0;
  for (const node of nodes) { cx += node.ground.x; cy += node.ground.y; }
  cx /= nodes.length;
  cy /= nodes.length;
  if (center) { cx = center.x; cy = center.y; }

  let reachA = 0;
  let reachB = 0;
  for (const node of nodes) {
    const { a, b } = isoCoords(node.ground, cx, cy);
    reachA = Math.max(reachA, Math.abs(a));
    reachB = Math.max(reachB, Math.abs(b));
  }
  // Auto-fit stays square: a run along one axis would otherwise give a
  // ribbon instead of a floor. Explicit sizes are free to differ.
  const autoHalf = (Math.max(reachA, reachB) * 1.4) + (pointStep * 3);
  const halfU = sizeMm > 0 ? (sizeMm / 2) * pxPerMm : autoHalf;
  const halfV = sizeVMm > 0 ? (sizeVMm / 2) * pxPerMm : autoHalf;

  const at = (a, b) => ({
    x: cx + (ISO_U.x * a) + (ISO_V.x * b),
    y: cy + (ISO_U.y * a) + (ISO_V.y * b),
  });

  // corners, then the four side midpoints with the axis each one resizes
  const corners = [at(halfU, halfV), at(halfU, -halfV), at(-halfU, -halfV), at(-halfU, halfV)];
  const edges = [
    { point: at(halfU, 0), axis: "u" },
    { point: at(-halfU, 0), axis: "u" },
    { point: at(0, halfV), axis: "v" },
    { point: at(0, -halfV), axis: "v" },
  ];

  return { cx, cy, halfU, halfV, corners, edges, nodes, pxPerMm };
}

// Is a workspace point inside the rhombus?
export function insidePlane(point, plane) {
  const { a, b } = isoCoords(point, plane.cx, plane.cy);
  return Math.abs(a) <= plane.halfU && Math.abs(b) <= plane.halfV;
}

// Sizes in mm implied by dragging a handle to `point`. `axis` limits the
// change to one direction, which is what the side handles do.
export function sizeFromHandle(point, cx, cy, mmPerPoint, axis = "both") {
  const { a, b } = isoCoords(point, cx, cy);
  const toMm = (half) => Math.round(((Math.max(Math.abs(half), pointStep) * 2)
    / (pointStep / mmPerPoint)) / 50) * 50;
  return {
    u: axis === "v" ? null : toMm(a),
    v: axis === "u" ? null : toMm(b),
  };
}
