// v2.05 Piping model builder — pure math, no renderer dependency.
// Turns the isometric sketch into real fabrication geometry:
//   runs      = straight pipe, trimmed to make room for its fittings
//   elbows    = JIS long-radius bends (swept arc, R = 1.5 x nominal)
//   reducers  = concentric cones, auto-detected where the size changes
// Everything is mm. The renderer only draws what this returns.
import { isoDirectionTo3D } from "../utils/handoff";
import { segmentLengthMm } from "../utils/lengths";
import { pipeSpec, nominalInch, flangeSpec } from "../data/jis";
import { pointStep } from "../utils/constants";

const EPS = 1e-6;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0, z: 0 } : mul(a, 1 / l);
};
const cross = (a, b) => ({
  x: (a.y * b.z) - (a.z * b.y),
  y: (a.z * b.x) - (a.x * b.z),
  z: (a.x * b.y) - (a.y * b.x),
});

// Rodrigues rotation of v about unit axis k by angle t.
function rotate(v, k, t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

// ASME B16.9 / JIS B2313 concentric reducer face-to-face, keyed by the
// LARGER nominal size (mm). Values are the standard published lengths.
const REDUCER_LENGTH = {
  20: 38, 25: 51, 32: 51, 40: 64, 50: 76, 65: 89, 80: 89, 90: 89,
  100: 102, 125: 127, 150: 140, 200: 152, 250: 178, 300: 203,
  350: 330, 400: 356, 450: 381, 500: 508,
};

export function reducerLength(largerA) {
  return REDUCER_LENGTH[largerA] ?? Math.max(76, largerA * 0.8);
}

// JIS B2311 long-radius elbow bend radius: R = 1.5 x nominal diameter.
export function elbowRadius(nominalA) {
  const inch = nominalInch(nominalA);
  return inch ? 1.5 * inch * 25.4 : 1.5 * nominalA;
}

const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
const key3D = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;

// Place every sketch endpoint in 3D mm-space, walking in draw order.
function placeNodes(lines, mmPerPoint, defaultOd) {
  const pos = new Map();
  const segments = [];
  const scale = mmPerPoint / pointStep;
  for (const line of lines) {
    const d = isoDirectionTo3D(line.end.x - line.start.x, line.end.y - line.start.y);
    const lengthMm = line.lengthMm ?? segmentLengthMm(line, mmPerPoint);
    const startKey = key2D(line.start);
    const endKey = key2D(line.end);
    if (!pos.has(startKey)) {
      // disconnected piece: anchor from its sketch position, not the origin
      pos.set(startKey, { x: line.start.x * scale, y: -line.start.y * scale, z: 0 });
    }
    const p1 = pos.get(startKey);
    // sketch Z (screen vertical) becomes world Y (up)
    const dir = { x: d[0], y: d[2], z: -d[1] };
    const p2 = pos.get(endKey) ?? add(p1, mul(dir, lengthMm));
    pos.set(endKey, p2);
    const nominalA = line.spec?.a ?? null;
    const od = nominalA ? (pipeSpec(nominalA)?.od ?? defaultOd) : defaultOd;
    segments.push({
      p1, p2, dir, od, nominalA, lengthMm,
      conn: line.spec?.conn ?? null,
      flange: line.spec?.flange ?? "none",
      lineIndex: segments.length,
      trim1: 0, trim2: 0,
    });
  }
  return segments;
}

export function buildPipeModel(lines, mmPerPoint) {
  if (!lines.length) return { runs: [], elbows: [], reducers: [], flanges: [], points: [], warnings: [] };

  // Unspecified lines get an OD proportional to the sketch so any sketch
  // still reads as pipe; a real JIS spec always wins.
  const lens = lines
    .map((l) => l.lengthMm ?? segmentLengthMm(l, mmPerPoint))
    .sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)] || 500;
  const defaultOd = Math.min(Math.max(median * 0.12, 4), 114.3);

  const segments = placeNodes(lines, mmPerPoint, defaultOd);

  // v2.06 GL datum: drop the whole model so its lowest point sits on the
  // ground line, making every elevation readable as height above GL.
  let minY = Infinity;
  for (const seg of segments) minY = Math.min(minY, seg.p1.y, seg.p2.y);
  if (Number.isFinite(minY) && Math.abs(minY) > EPS) {
    const seen = new Set();
    for (const seg of segments) {
      for (const p of [seg.p1, seg.p2]) {
        if (seen.has(p)) continue;
        seen.add(p);
        p.y -= minY;
      }
    }
  }

  // Group segment ends by 3D position to find joints.
  const ends = new Map();
  segments.forEach((seg, index) => {
    for (const which of [1, 2]) {
      const p = which === 1 ? seg.p1 : seg.p2;
      const k = key3D(p);
      if (!ends.has(k)) ends.set(k, { p, refs: [] });
      ends.get(k).refs.push({ index, which });
    }
  });

  const elbows = [];
  const reducers = [];

  for (const { p, refs } of ends.values()) {
    if (refs.length !== 2) continue;
    const [refA, refB] = refs;
    const segA = segments[refA.index];
    const segB = segments[refB.index];

    // outgoing unit vectors from the joint, along each leg
    const u = norm(refA.which === 1 ? segA.dir : mul(segA.dir, -1));
    const v = norm(refB.which === 1 ? segB.dir : mul(segB.dir, -1));

    const cosAngle = Math.max(-1, Math.min(1, dot(u, v)));
    const between = Math.acos(cosAngle);          // angle between the legs
    const straight = between > Math.PI - 0.02;    // collinear pass-through

    const bigA = Math.max(segA.nominalA ?? 0, segB.nominalA ?? 0);
    const sizesDiffer = segA.od !== segB.od;

    if (straight) {
      if (!sizesDiffer) continue;                 // plain butt weld, nothing to draw
      const L = reducerLength(bigA || 100);
      const half = L / 2;
      reducers.push({
        p1: add(p, mul(u, half)),
        p2: add(p, mul(v, half)),
        od1: segA.od,
        od2: segB.od,
      });
      if (refA.which === 1) segA.trim1 = half; else segA.trim2 = half;
      if (refB.which === 1) segB.trim1 = half; else segB.trim2 = half;
      continue;
    }

    // --- elbow ---
    const alpha = between / 2;                    // half-angle between legs
    const radius = elbowRadius(bigA || 100);
    const tangent = radius / Math.tan(alpha);     // center-to-face distance
    const bisector = norm(add(u, v));
    const center = add(p, mul(bisector, radius / Math.sin(alpha)));
    const start = add(p, mul(u, tangent));
    const end = add(p, mul(v, tangent));

    const ra = sub(start, center);
    const rb = sub(end, center);
    const axis = norm(cross(ra, rb));
    const sweep = Math.acos(Math.max(-1, Math.min(1, dot(norm(ra), norm(rb)))));

    const steps = 16;
    const path = [];
    for (let i = 0; i <= steps; i += 1) {
      path.push(add(center, rotate(ra, axis, (sweep * i) / steps)));
    }
    // elbow takes the larger size; a reducer follows on the smaller leg
    const elbowOd = Math.max(segA.od, segB.od);
    elbows.push({ path, od: elbowOd, deflectionDeg: Math.round((Math.PI - between) * (180 / Math.PI)) });

    let trimA = tangent;
    let trimB = tangent;
    if (sizesDiffer) {
      const L = reducerLength(bigA || 100);
      const smallIsA = segA.od < segB.od;
      const smallSeg = smallIsA ? segA : segB;
      const smallRef = smallIsA ? refA : refB;
      const smallDir = smallIsA ? u : v;
      const from = add(p, mul(smallDir, tangent));
      reducers.push({
        p1: from,
        p2: add(from, mul(smallDir, L)),
        od1: elbowOd,
        od2: smallSeg.od,
      });
      if (smallRef === refA) trimA += L; else trimB += L;
    }
    if (refA.which === 1) segA.trim1 = trimA; else segA.trim2 = trimA;
    if (refB.which === 1) segB.trim1 = trimB; else segB.trim2 = trimB;
  }

  // v2.06 flanges sit on the pipe ends the user marked.
  const flanges = [];
  for (const seg of segments) {
    const wantStart = seg.flange === "start" || seg.flange === "both";
    const wantEnd = seg.flange === "end" || seg.flange === "both";
    const spec = flangeSpec(seg.nominalA ?? 0);
    if (!spec) continue;
    if (wantStart) {
      flanges.push({ p: add(seg.p1, mul(seg.dir, seg.trim1)), dir: seg.dir, pipeOd: seg.od, ...spec });
      seg.trim1 += spec.t;
    }
    if (wantEnd) {
      flanges.push({ p: sub(seg.p2, mul(seg.dir, seg.trim2)), dir: seg.dir, pipeOd: seg.od, ...spec });
      seg.trim2 += spec.t;
    }
  }

  // Trim the straight runs so the fittings have room.
  const runs = [];
  const warnings = [];
  const points = [];
  for (const seg of segments) {
    const total = seg.trim1 + seg.trim2;
    const label = `${seg.lengthMm}mm${seg.nominalA ? ` ${seg.nominalA}A` : ""}`;
    if (seg.lengthMm < seg.od) {
      warnings.push(`${label}: shorter than its ${seg.od}mm diameter`);
    }
    if (total >= seg.lengthMm - 1) {
      warnings.push(`${label}: too short for its fittings`);
      continue;
    }
    runs.push({
      p1: add(seg.p1, mul(seg.dir, seg.trim1)),
      p2: sub(seg.p2, mul(seg.dir, seg.trim2)),
      od: seg.od,
      nominalA: seg.nominalA,
      lengthMm: seg.lengthMm,
      conn: seg.conn,
      lineIndex: seg.lineIndex,
      mid: mul(add(seg.p1, seg.p2), 0.5),
    });
  }

  // unique endpoints, for elevation annotation against GL
  const pointKeys = new Set();
  for (const seg of segments) {
    for (const p of [seg.p1, seg.p2]) {
      const k = key3D(p);
      if (pointKeys.has(k)) continue;
      pointKeys.add(k);
      points.push(p);
    }
  }

  return { runs, elbows, reducers, flanges, points, warnings };
}
