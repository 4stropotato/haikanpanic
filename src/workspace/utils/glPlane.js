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
import { nodeElevations, ISO_YAW, ISO_PITCH } from "../workshop/pipe3d";

export const ISO_U = { x: Math.cos(-Math.PI / 6), y: Math.sin(-Math.PI / 6) };
export const ISO_V = { x: Math.cos((-5 * Math.PI) / 6), y: Math.sin((-5 * Math.PI) / 6) };

// v2.79 The plane turns with the view. Its two axes are the horizontal world
// axes as the current viewpoint projects them — not unit vectors, and of
// unequal length, which is the foreshortening that makes a turned plane read
// as a floor. At the home view they come out exactly ISO_U and ISO_V.
const VIEW_K = 1 / Math.cos((ISO_PITCH * Math.PI) / 180);

export function planeAxes(view) {
  if (!view) return { u: ISO_U, v: ISO_V };
  const yaw = ((view.yawDeg ?? ISO_YAW) * Math.PI) / 180;
  const pitch = ((view.pitchDeg ?? ISO_PITCH) * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const sp = Math.sin(pitch);
  return {
    u: { x: VIEW_K * cy, y: -VIEW_K * sy * sp },
    v: { x: -VIEW_K * sy, y: -VIEW_K * cy * sp },
  };
}

const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const VERTICAL_EPS = 0.5;

// Iso-axis coordinates of a point relative to a centre: p - c = a*u + b*v.
export function isoCoords(point, cx, cy, axes = { u: ISO_U, v: ISO_V }) {
  const dx = point.x - cx;
  const dy = point.y - cy;
  const { u, v } = axes;
  const det = (u.x * v.y) - (v.x * u.y);
  if (Math.abs(det) < 1e-9) return { a: 0, b: 0 };
  return {
    a: ((dx * v.y) - (v.x * dy)) / det,
    b: ((u.x * dy) - (dx * u.y)) / det,
  };
}

// v2.19 A site has more than one datum — GL outside, FL on each floor, TOS
// on a platform — so planes are a list. `plane` is one entry of that list.
export function glPlaneGeometry(lines, mmPerPoint, plane = {}) {
  const {
    sizeMm = 0, sizeVMm = 0, offsetMm = 0, center = null, centerAB = null,
    projection = null, view = null, kind = "floor", facing = "u",
    vAnchor = "free", vMm = 0,
  } = plane;
  const ground = planeAxes(view);
  // v2.98 A wall is spanned by one ground direction and the vertical; a
  // floor by the two ground directions. Everything downstream — the corners,
  // the grips, the hit tests — is written against these two axes, so a wall
  // needs nothing else.
  // v3.02 A ceiling is a floor seen from underneath: the same horizontal
  // plane, and the drop to it simply goes up because the run sits below it.
  // The arithmetic already handles that, so it needs no case of its own.
  const wall = kind === "wall";
  const along = facing === "v" ? ground.v : ground.u;
  const away = facing === "v" ? ground.u : ground.v;
  // v3.73 A wall turns over with everything else. Its vertical was pinned
  // to the page rather than to the world, so once the view passed the
  // horizon the runs inverted and the wall stayed the right way up.
  const upSign = Math.cos(((view?.pitchDeg ?? ISO_PITCH) * Math.PI) / 180) < 0 ? -1 : 1;
  const axes = wall ? { u: along, v: { x: 0, y: upSign } } : ground;
  if (!lines.length) return null;

  const pxPerMm = pointStep / mmPerPoint;
  // v3.74 A millimetre of height is not a millimetre on the page once the
  // view is turned — it is VIEW_K * cos(pitch) of one. Dropping nodes to the
  // datum with the flat scale put the plane at the wrong level and laid
  // elevated runs flat on it, and made the height appear to change with the
  // camera. Height has one scale, and this is it.
  // v3.76 Signed, not absolute. Above the horizon and below it the
  // projection flips, and abs() did not — so dropping a node to its datum
  // pushed it the wrong way from underneath, and the level a pipe reported
  // depended on which side you were watching from. Height cannot depend on
  // where you stand.
  const upPerMm = pxPerMm * VIEW_K
    * Math.cos(((view?.pitchDeg ?? ISO_PITCH) * Math.PI) / 180);
  const elevations = nodeElevations(lines, mmPerPoint);

  const nodes = [];
  const seen = new Set();
  for (const line of lines) {
    for (const point of [line.start, line.end]) {
      const key = key2D(point);
      if (seen.has(key)) continue;
      seen.add(key);
      // FIXED v3.96 — "makikita mo pag nag orbit view naka lutang ang gl mas
      //   mataas pa sa naka elevated na pipe"
      // CAUSE: the datum's own height was ADDED to each node's elevation here,
      //   while the leaders in DrawLayer subtract it. With GL at 0 the two
      //   agreed by accident; the moment a datum sat anywhere else the plane
      //   went the wrong way by twice its offset, which is the float.
      // A node stands `elevation - offsetMm` above its datum. That difference
      //   is the drop, and the drop is what the leader measures.
      // GUARD: nodes[].elevation stays the RAW height — DrawLayer subtracts the
      //   datum itself when it prints a relative figure, so applying the offset
      //   here too would count it twice.
      const raw = elevations.get(key) ?? 0;
      const drop = raw - offsetMm;
      // the drawing may show this node slanted; the datum must follow it
      const drawn = projection?.get(key) ?? point;
      nodes.push({
        key,                                  // v2.57 so a callout can be moved and remembered
        point: drawn,
        // the drop equals the height above the datum, so a leader reads as height
        ground: { x: drawn.x, y: drawn.y + (drop * upPerMm) },
        elevation: raw,
      });
    }
  }

  let cx = 0;
  let cy = 0;
  for (const node of nodes) { cx += node.ground.x; cy += node.ground.y; }
  cx /= nodes.length;
  cy /= nodes.length;
  if (wall) {
    // a wall stands where the drawing does, pushed out along the axis it
    // does not run along; its offset is a distance, not a height
    cx = 0;
    cy = 0;
    for (const node of nodes) { cx += node.point.x; cy += node.point.y; }
    cx /= nodes.length;
    cy /= nodes.length;
    cx += away.x * offsetMm * pxPerMm;
    cy += away.y * offsetMm * pxPerMm;
  }
  // v3.06 Where a moved plane sits is kept along the ground axes, not as a
  // screen position. A screen position does not turn: every floor and wall
  // stayed put while the pipes rotated, so the drawing stopped being one
  // space. Along the axes it rotates with everything else.
  // v3.10 Measured from the origin, not from the drawing's own centre. Tied
  // to the centre, every placed floor and wall followed the pipes around:
  // moving one run shifted the centroid and dragged the whole site with it.
  // The origin does not move, and the axes turn, so a placed surface now
  // stays where it was put and still rotates with everything else.
  // v3.64 Always read back on the ground axes, whatever the surface is. A
  // wall's own pair is (along, vertical), so a centre stored in ground terms
  // and rebuilt in wall terms came out somewhere else entirely — which is
  // why moving a wall sent it off in a direction of its own.
  if (centerAB) {
    cx = (ground.u.x * centerAB.a) + (ground.v.x * centerAB.b);
    cy = (ground.u.y * centerAB.a) + (ground.v.y * centerAB.b);
  } else if (center) {
    cx = center.x;
    cy = center.y;
  }

  let reachA = 0;
  let reachB = 0;
  for (const node of nodes) {
    // v2.98 A wall is fitted to where the pipes actually are, not to where
    // they would land on the floor
    const { a, b } = isoCoords(wall ? node.point : node.ground, cx, cy, axes);
    reachA = Math.max(reachA, Math.abs(a));
    reachB = Math.max(reachB, Math.abs(b));
  }
  // Auto-fit stays square: a run along one axis would otherwise give a
  // ribbon instead of a floor. Explicit sizes are free to differ.
  // v3.36 A wall auto-sized to the square that fits the drawing was a height
  // with no meaning — a wall labelled +1200 stood some three metres tall,
  // because that number is its distance and its height had never been set.
  // Left unsaid, a wall is a storey: 2400mm, which is at least a real answer.
  const autoHalf = (Math.max(reachA, reachB) * 1.4) + (pointStep * 3);
  const autoWallHalf = ((2400 / 2) * Math.abs(upPerMm));
  const halfU = sizeMm > 0 ? (sizeMm / 2) * pxPerMm : autoHalf;
  const halfV = sizeVMm > 0 ? (sizeVMm / 2) * (wall ? Math.abs(upPerMm) : pxPerMm) : (wall ? autoWallHalf : autoHalf);

  // v3.11 A wall can be pinned by its bottom or its top to a known height,
  // the way a real one stands on a slab or hangs from a beam. Left free it
  // floats with the drawing, which is fine while sketching and useless once
  // the levels matter.
  if (wall && vAnchor !== "free") {
    // v3.84 The anchor turns over with the wall. Its axis flipped past the
    // horizon but this offset did not, so the two cancelled and the wall
    // stood upright in an upside-down model.
    cy += (-vMm * upPerMm) + (upSign * (vAnchor === "bottom" ? -halfV : halfV));
  }

  const at = (a, b) => ({
    x: cx + (axes.u.x * a) + (axes.v.x * b),
    y: cy + (axes.u.y * a) + (axes.v.y * b),
  });

  // corners, then the four side midpoints with the axis each one resizes
  const corners = [at(halfU, halfV), at(halfU, -halfV), at(-halfU, -halfV), at(-halfU, halfV)];
  const edges = [
    { point: at(halfU, 0), axis: "u" },
    { point: at(-halfU, 0), axis: "u" },
    { point: at(0, halfV), axis: "v" },
    { point: at(0, -halfV), axis: "v" },
  ];

  // upPerMm is how far a millimetre of height moves on screen at this view.
  // It is handed out because anything drawing a drop — a leader, a curtain —
  // must use the same scale the plane itself was placed with.
  return { cx, cy, halfU, halfV, corners, edges, centre: { x: cx, y: cy }, nodes, pxPerMm, upPerMm, axes, wall };
}

// Is a workspace point inside the rhombus?
export function insidePlane(point, plane) {
  const { a, b } = isoCoords(point, plane.cx, plane.cy, plane.axes);
  return Math.abs(a) <= plane.halfU && Math.abs(b) <= plane.halfV;
}

// Sizes in mm implied by dragging a handle to `point`. `axis` limits the
// change to one direction, which is what the side handles do.
export function sizeFromHandle(point, cx, cy, mmPerPoint, axis = "both", axes) {
  const { a, b } = isoCoords(point, cx, cy, axes);
  const toMm = (half) => Math.round(((Math.max(Math.abs(half), pointStep) * 2)
    / (pointStep / mmPerPoint)) / 50) * 50;
  return {
    u: axis === "v" ? null : toMm(a),
    v: axis === "u" ? null : toMm(b),
  };
}

// v2.62 A datum plane is usually bigger than the phone screen, which put
// seven of its eight handles outside the viewport — there was no way to
// resize it by dragging, however hard you looked. Handles that fall outside
// are pulled to the edge, along the line from the plane's centre, so the
// direction still reads and the grip is always reachable.
export function viewRect(w, h, zoom, offset, margin = 30) {
  const m = margin / zoom;
  return {
    x1: ((-w / 2) - offset.x) / zoom + m,
    x2: ((w / 2) - offset.x) / zoom - m,
    y1: ((-h / 2) - offset.y) / zoom + m,
    y2: ((h / 2) - offset.y) / zoom - m,
  };
}

export function clampHandle(point, cx, cy, rect) {
  const inside = point.x >= rect.x1 && point.x <= rect.x2
    && point.y >= rect.y1 && point.y <= rect.y2;
  if (inside) return { x: point.x, y: point.y, clamped: false };
  const dx = point.x - cx;
  const dy = point.y - cy;
  let t = 1;
  if (dx > 0) t = Math.min(t, (rect.x2 - cx) / dx);
  if (dx < 0) t = Math.min(t, (rect.x1 - cx) / dx);
  if (dy > 0) t = Math.min(t, (rect.y2 - cy) / dy);
  if (dy < 0) t = Math.min(t, (rect.y1 - cy) / dy);
  t = Math.max(0, Math.min(1, t));
  return { x: cx + (dx * t), y: cy + (dy * t), clamped: true };
}

// v3.33 Where a surface begins and ends in height. Nothing answered this,
// so anything that needed a wall's foot — the grid box, for one — guessed at
// it from the wall's size around its own middle, and a wall standing on the
// slab appeared to start halfway up. A floor and a ceiling are a single
// level; a wall runs between two, and which two depends on what holds it.
export function planeVerticalExtent(datum = {}) {
  const { kind = "floor", offsetMm = 0, sizeVMm = 0, vAnchor = "free", vMm = 0 } = datum;
  if (kind !== "wall") return { bottomMm: offsetMm, topMm: offsetMm };
  const height = Math.max(sizeVMm, 0);
  if (vAnchor === "bottom") return { bottomMm: vMm, topMm: vMm + height };
  if (vAnchor === "top") return { bottomMm: vMm - height, topMm: vMm };
  // free: it floats with the drawing, so the best that can be said is that
  // it is half its height either side of where the drawing sits
  return { bottomMm: -height / 2, topMm: height / 2 };
}
