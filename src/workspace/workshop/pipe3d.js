// v2.05 Piping model builder — pure math, no renderer dependency.
// Turns the isometric sketch into real fabrication geometry:
//   runs      = straight pipe, trimmed to make room for its fittings
//   elbows    = JIS long-radius bends (swept arc, R = 1.5 x nominal)
//   reducers  = concentric cones, auto-detected where the size changes
// Everything is mm. The renderer only draws what this returns.
import { isoDirectionTo3D } from "../utils/handoff";
import { segmentLengthMm } from "../utils/lengths";
import {
  pipeSpec, nominalInch, flangeSpec, wallThickness, massPerMetre, material, teeCentreToEnd,
} from "../data/jis";
import { key2D as jointKey, sketchJoints, jointTypeOf } from "../utils/joints";
import { pointStep } from "../utils/constants";

const EPS = 1e-6;
const ISO_UX = Math.cos(-Math.PI / 6);   // screen x of the +X ground axis

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

// JIS B2311 elbow bend radius. Long radius R = 1.5D is the default;
// short radius R = 1.0D is the ショートエルボ.
export function elbowRadius(nominalA, kind = "elbowLR") {
  const factor = kind === "elbowSR" ? 1.0 : 1.5;
  const inch = nominalInch(nominalA);
  return inch ? factor * inch * 25.4 : factor * nominalA;
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
      // A disconnected piece lands on the ground plane at the horizontal
      // position its sketch point implies. The 2D point is decomposed into
      // the two horizontal iso axes; the old code spent the whole vertical
      // coordinate on elevation, which left every loose piece stranded on a
      // single line in 3D. Height is explicit — the move tool freezes it and
      // the datum sheet edits it.
      const a = (line.start.x / (2 * ISO_UX)) - line.start.y;
      const b = (-line.start.x / (2 * ISO_UX)) - line.start.y;
      pos.set(startKey, {
        x: a * scale,
        y: line.elevationMm ?? 0,
        z: -b * scale,
      });
    }
    const p1 = pos.get(startKey);
    // sketch Z (screen vertical) becomes world Y (up)
    const dir = { x: d[0], y: d[2], z: -d[1] };
    const p2 = pos.get(endKey) ?? add(p1, mul(dir, lengthMm));
    pos.set(endKey, p2);
    const nominalA = line.spec?.a ?? null;
    const od = nominalA ? (pipeSpec(nominalA)?.od ?? defaultOd) : defaultOd;
    const materialId = line.spec?.material ?? "SGP";
    const schedule = line.spec?.schedule ?? material(materialId).defaultSchedule;
    const conn = line.spec?.conn ?? "BW";
    segments.push({
      p1, p2, dir, od, nominalA, lengthMm, conn, materialId, schedule,
      key1: key2D(line.start), key2: key2D(line.end),
      // 裏波 root gap only applies to butt-welded joints
      gap: conn === "BW" ? (line.spec?.gap ?? material(materialId).gap) : 0,
      wall: nominalA ? wallThickness(nominalA, schedule) : null,
      kgm: nominalA ? massPerMetre(nominalA, schedule, materialId) : null,
      flange: line.spec?.flange ?? "none",
      lineIndex: segments.length,
      trim1: 0, trim2: 0, weld1: false, weld2: false,
    });
  }
  return segments;
}

// v2.07 Elevation of every sketch node above GL, keyed by its 2D position.
// The 2D isometric uses this to print EL callouts and the GL line.
export function nodeElevations(lines, mmPerPoint) {
  const out = new Map();
  if (!lines.length) return out;
  const segments = placeNodes(lines, mmPerPoint, 60);
  let minY = Infinity;
  for (const seg of segments) minY = Math.min(minY, seg.p1.y, seg.p2.y);
  if (!Number.isFinite(minY)) return out;
  lines.forEach((line, index) => {
    const seg = segments[index];
    if (!seg) return;
    out.set(key2D(line.start), Math.round(seg.p1.y - minY));
    out.set(key2D(line.end), Math.round(seg.p2.y - minY));
  });
  return out;
}

export function buildPipeModel(lines, mmPerPoint, options = {}) {
  if (!lines.length) return { runs: [], elbows: [], reducers: [], tees: [], flanges: [], points: [], warnings: [] };

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
  // v2.09 the datum can sit below the lowest pipe, which lifts the whole
  // model in 3D exactly as the 2D plane offset shows it.
  const lift = (Number.isFinite(minY) ? -minY : 0) + (options.glOffsetMm ?? 0);
  if (Math.abs(lift) > EPS) {
    const seen = new Set();
    for (const seg of segments) {
      for (const p of [seg.p1, seg.p2]) {
        if (seen.has(p)) continue;
        seen.add(p);
        p.y += lift;
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
  const tees = [];

  // the fitter's choice per corner, keyed by the sketch point
  const chosenTypes = new Map();
  for (const joint of sketchJoints(lines)) {
    chosenTypes.set(joint.key, jointTypeOf(joint, lines, options.jointTypes));
  }

  for (const { p, refs } of ends.values()) {
    if (refs.length === 3) {
      buildTee(segments, refs, p, tees);
      continue;
    }
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
    const sketchKey = refA.which === 1 ? segA.key1 : segA.key2;
    const jointType = chosenTypes.get(sketchKey) ?? "elbowLR";

    if (refA.which === 1) segA.weld1 = true; else segA.weld2 = true;
    if (refB.which === 1) segB.weld1 = true; else segB.weld2 = true;

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

    // --- チーズ used as a corner: two ports on the legs, one spare ---
    if (jointType === "tee") {
      const c2e = teeCentreToEnd(bigA || 100);
      const od = Math.max(segA.od, segB.od);
      tees.push({
        p,
        od,
        nominalA: bigA || null,
        arms: [mul(u, c2e), mul(v, c2e), mul(u, -c2e)],
      });
      if (refA.which === 1) segA.trim1 = c2e; else segA.trim2 = c2e;
      if (refB.which === 1) segB.trim1 = c2e; else segB.trim2 = c2e;
      continue;
    }

    // --- mitered weld: the pipes meet directly, no fitting ---
    if (jointType === "weld") continue;

    // --- elbow ---
    const alpha = between / 2;                    // half-angle between legs
    const radius = elbowRadius(bigA || 100, jointType);
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
    elbows.push({
      path, od: elbowOd, kind: jointType, nominalA: bigA || null,
      deflectionDeg: Math.round((Math.PI - between) * (180 / Math.PI)),
    });

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
      flanges.push({
        p: add(seg.p1, mul(seg.dir, seg.trim1)), dir: seg.dir,
        pipeOd: seg.od, nominalA: seg.nominalA, ...spec,
      });
      seg.trim1 += spec.t;
      seg.weld1 = true;
    }
    if (wantEnd) {
      flanges.push({
        p: sub(seg.p2, mul(seg.dir, seg.trim2)), dir: seg.dir,
        pipeOd: seg.od, nominalA: seg.nominalA, ...spec,
      });
      seg.trim2 += spec.t;
      seg.weld2 = true;
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
    const gapTotal = (seg.weld1 ? seg.gap : 0) + (seg.weld2 ? seg.gap : 0);
    const cutLengthMm = Math.round((seg.lengthMm - total - gapTotal) * 10) / 10;
    runs.push({
      p1: add(seg.p1, mul(seg.dir, seg.trim1)),
      p2: sub(seg.p2, mul(seg.dir, seg.trim2)),
      od: seg.od,
      nominalA: seg.nominalA,
      lengthMm: seg.lengthMm,
      cutLengthMm,
      conn: seg.conn,
      materialId: seg.materialId,
      schedule: seg.schedule,
      wall: seg.wall,
      kgm: seg.kgm,
      gap: seg.gap,
      weldEnds: (seg.weld1 ? 1 : 0) + (seg.weld2 ? 1 : 0),
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

  return { runs, elbows, reducers, tees, flanges, points, warnings };
}

// v2.10 Three legs meeting is a tee: the two collinear legs are the run,
// the odd one out is the branch. Every leg is trimmed by the centre-to-end.
function buildTee(segments, refs, p, tees) {
  const legs = refs.map((ref) => {
    const seg = segments[ref.index];
    const outward = ref.which === 1 ? seg.dir : mul(seg.dir, -1);
    return { ref, seg, u: norm(outward) };
  });
  const bigA = Math.max(...legs.map((leg) => leg.seg.nominalA ?? 0));
  const c2e = teeCentreToEnd(bigA || 100);
  for (const leg of legs) {
    if (leg.ref.which === 1) leg.seg.trim1 = c2e; else leg.seg.trim2 = c2e;
  }
  tees.push({
    p,
    od: Math.max(...legs.map((leg) => leg.seg.od)),
    nominalA: bigA || null,
    arms: legs.map((leg) => mul(leg.u, c2e)),
  });
}
