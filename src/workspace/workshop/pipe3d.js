// v2.05 Piping model builder — pure math, no renderer dependency.
// Turns the isometric sketch into real fabrication geometry:
//   runs      = straight pipe, trimmed to make room for its fittings
//   elbows    = JIS long-radius bends (swept arc, R = 1.5 x nominal)
//   reducers  = concentric cones, auto-detected where the size changes
// Everything is mm. The renderer only draws what this returns.
import { isoDeltaTo3D, ISO_UX } from "../utils/handoff";
import { segmentLengthMm } from "../utils/lengths";
import {
  pipeSpec, nominalInch, flangeSpec, wallThickness, massPerMetre, material, teeCentreToEnd,
} from "../data/jis";
import { sketchJoints, jointSettingOf } from "../utils/joints";
import { pointStep } from "../utils/constants";

const EPS = 1e-6;
const GASKET_MM = 3;            // JIS 10K non-asbestos sheet, per joint
export const ISO_YAW = 45;               // the isometric viewpoint
export const ISO_PITCH = (Math.atan(Math.SQRT1_2) * 180) / Math.PI;  // exact isometric tilt
const VIEW_K = 1 / Math.cos((ISO_PITCH * Math.PI) / 180);  // keeps the home view's scale

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
    // a zero-length line is a stray tap, not a pipe; it would otherwise add
    // a phantom leg at its corner and turn an elbow into a tee
    if (Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) < EPS) continue;
    const d = isoDeltaTo3D(line.end.x - line.start.x, line.end.y - line.start.y);
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
      flangeType: line.spec?.flangeType ?? "SO",
      flangeSizeA: line.spec?.flangeSizeA ?? null,
      lineIndex: segments.length,
      trim1: 0, trim2: 0, weld1: false, weld2: false,
    });
  }
  // v2.42 An endpoint given its own level overrides what the walk derived.
  // This has to happen here, inside the single placement, or the elevations
  // and the drawing disagree — which quietly slid the datum plane whenever
  // a level was edited.
  const overrides = new Map();
  for (const line of lines) {
    if (Number.isFinite(line.elev1Mm)) overrides.set(key2D(line.start), line.elev1Mm);
    if (Number.isFinite(line.elev2Mm)) overrides.set(key2D(line.end), line.elev2Mm);
  }
  if (overrides.size) {
    for (const seg of segments) {
      if (overrides.has(seg.key1)) seg.p1.y = overrides.get(seg.key1);
      if (overrides.has(seg.key2)) seg.p2.y = overrides.get(seg.key2);
    }
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
  // v2.40 A lifted endpoint makes the run slope, so every direction has to
  // come from the actual geometry. Keeping the sketch's iso axis here left
  // elbows reading 90 degrees and flanges standing plumb on a sloping pipe.
  for (const seg of segments) {
    const v = sub(seg.p2, seg.p1);
    if (len(v) > EPS) seg.dir = norm(v);
  }

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
    chosenTypes.set(joint.key, jointSettingOf(joint, lines, options.jointTypes));
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
    const setting = chosenTypes.get(sketchKey) ?? { type: "elbowLR" };
    const jointType = setting.type;
    const override = Number.isFinite(setting.takeoutMm) && setting.takeoutMm > 0
      ? setting.takeoutMm : null;

    if (refA.which === 1) segA.weld1 = true; else segA.weld2 = true;
    if (refB.which === 1) segB.weld1 = true; else segB.weld2 = true;

    // v2.35 A flange is a connection, not a pipe end: it always comes in a
    // pair with a gasket between. Asking for one on either side of a joint
    // gives both sides one, which is what a fitter means by "flanged here"
    // and stops a lone flange stacking on top of an elbow.
    const wantsFlange = (seg, which) => (which === 1
      ? seg.flange === "start" || seg.flange === "both"
      : seg.flange === "end" || seg.flange === "both");
    const setFlange = (seg, which) => {
      if (which === 1) seg.flange = seg.flange === "end" ? "both" : "start";
      else seg.flange = seg.flange === "start" ? "both" : "end";
    };
    const aWants = wantsFlange(segA, refA.which);
    const bWants = wantsFlange(segB, refB.which);
    if (aWants || bWants) {
      const donor = aWants ? segA : segB;
      if (!aWants) { segA.flangeType = donor.flangeType; segA.flangeSizeA = donor.flangeSizeA; }
      if (!bWants) { segB.flangeType = donor.flangeType; segB.flangeSizeA = donor.flangeSizeA; }
      setFlange(segA, refA.which);
      setFlange(segB, refB.which);
      if (refA.which === 1) segA.jointFlange1 = true; else segA.jointFlange2 = true;
      if (refB.which === 1) segB.jointFlange1 = true; else segB.jointFlange2 = true;
    }

    if (straight) {
      if (!sizesDiffer) continue;                 // plain butt weld, nothing to draw
      const L = reducerLength(bigA || 100);
      const half = L / 2;
      reducers.push({
        p1: add(p, mul(u, half)),
        p2: add(p, mul(v, half)),
        od1: segA.od,
        od2: segB.od,
        kind: setting.reducer ?? "concentric",
        nominalA: bigA || null,
      });
      if (refA.which === 1) segA.trim1 = half; else segA.trim2 = half;
      if (refB.which === 1) segB.trim1 = half; else segB.trim2 = half;
      continue;
    }

    // --- チーズ used as a corner: two ports on the legs, one spare ---
    if (jointType === "tee" || jointType === "wye") {
      const c2e = override ?? (jointType === "wye"
        ? wyeCentreToEnd(bigA || 100)
        : teeCentreToEnd(bigA || 100));
      const od = Math.max(segA.od, segB.od);
      tees.push({
        p,
        od,
        kind: jointType,
        sketchKey,
        deflectionDeg: Math.round((Math.PI - between) * (180 / Math.PI) * 10) / 10,
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
    // A cut-down elbow keeps the bend but not the standard take-out, so the
    // override wins over the table when the fitter has measured one.
    const radius = elbowRadius(bigA || 100, jointType === "elbowSR" ? "elbowSR" : "elbowLR");
    const standard = radius / Math.tan(alpha);    // center-to-face distance
    const tangent = override ?? (jointType === "elbowCut" ? standard / 2 : standard);
    const bisector = norm(add(u, v));
    const arcRadius = tangent * Math.tan(alpha);  // follow the actual take-out
    const center = add(p, mul(bisector, arcRadius / Math.sin(alpha)));
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
    // v2.27 Roll. A sloped tie-in usually keeps a stock 90 degree elbow and
    // simply rolls it so the outlet points along the sloping run. The roll is
    // the angle between the bend plane and the vertical plane through the
    // incoming leg: 0 means the bend is plumb, 90 means it lies flat.
    const bendNormal = norm(cross(u, v));
    const worldUp = { x: 0, y: 1, z: 0 };
    let refNormal = cross(u, worldUp);
    if (len(refNormal) < 1e-6) refNormal = cross(u, { x: 1, y: 0, z: 0 });
    refNormal = norm(refNormal);
    const rollDeg = Math.round(
      Math.acos(Math.min(1, Math.abs(dot(bendNormal, refNormal)))) * (180 / Math.PI) * 10,
    ) / 10;

    // elbow takes the larger size; a reducer follows on the smaller leg
    const elbowOd = Math.max(segA.od, segB.od);
    elbows.push({
      path, od: elbowOd, kind: jointType, nominalA: bigA || null, takeout: tangent,
      sketchKey, rollDeg,
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
        kind: setting.reducer ?? "concentric",
        nominalA: bigA || null,
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
    // a flange is usually the pipe's size, but a tie-in can call for another
    const spec = flangeSpec(seg.flangeSizeA ?? seg.nominalA ?? 0);
    if (!spec) continue;
    if (wantStart) {
      const half1 = seg.jointFlange1 ? GASKET_MM / 2 : 0;
      flanges.push({
        p: add(seg.p1, mul(seg.dir, seg.trim1)), dir: mul(seg.dir, -1),
        pipeOd: seg.od, nominalA: seg.flangeSizeA ?? seg.nominalA,
        type: seg.flangeType, ...spec,
      });
      seg.trim1 += spec.t + half1;
      seg.weld1 = true;
    }
    if (wantEnd) {
      const half2 = seg.jointFlange2 ? GASKET_MM / 2 : 0;
      flanges.push({
        p: sub(seg.p2, mul(seg.dir, seg.trim2)), dir: seg.dir,
        pipeOd: seg.od, nominalA: seg.flangeSizeA ?? seg.nominalA,
        type: seg.flangeType, ...spec,
      });
      seg.trim2 += spec.t + half2;
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
      const over = Math.round(total - seg.lengthMm);
      warnings.push(
        `${label}: fittings meet directly — ${over}mm over, allow ${seg.gap}mm root gap`,
      );
      continue;
    }
    // v2.24 A run between two different elevations is a sloped line — a
    // real case (drains, tie-ins after a move), so report its angle.
    const rise = seg.p2.y - seg.p1.y;
    const horizontal = Math.hypot(seg.p2.x - seg.p1.x, seg.p2.z - seg.p1.z);
    const slopeDeg = Math.round((Math.atan2(rise, horizontal) * (180 / Math.PI)) * 10) / 10;

    const gapTotal = (seg.weld1 ? seg.gap : 0) + (seg.weld2 ? seg.gap : 0);
    const cutLengthMm = Math.round((seg.lengthMm - total - gapTotal) * 10) / 10;
    runs.push({
      p1: add(seg.p1, mul(seg.dir, seg.trim1)),
      p2: sub(seg.p2, mul(seg.dir, seg.trim2)),
      od: seg.od,
      nominalA: seg.nominalA,
      lengthMm: seg.lengthMm,
      cutLengthMm,
      riseMm: Math.round(rise),
      slopeDeg,
      // the real centre-to-centre length once the run slopes; the typed
      // value only ever described the horizontal
      trueLengthMm: Math.round(Math.hypot(seg.lengthMm, rise) * 10) / 10,
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
    kind: "tee",
    nominalA: bigA || null,
    arms: legs.map((leg) => mul(leg.u, c2e)),
  });
}

// v2.27 The angle a corner actually needs, keyed by its sketch point. A run
// that slopes makes its corner something other than 90 degrees, and the
// fitter has to know whether that is a stock fitting or a cut one.
export function jointAngles(lines, mmPerPoint, options = {}) {
  const model = buildPipeModel(lines, mmPerPoint, options);
  const out = new Map();
  for (const elbow of model.elbows) {
    if (elbow.sketchKey) {
      out.set(elbow.sketchKey, {
        deflectionDeg: elbow.deflectionDeg,
        rollDeg: elbow.rollDeg,
        takeoutMm: Math.round(elbow.takeout),
        nominalA: elbow.nominalA,
      });
    }
  }
  for (const tee of model.tees) {
    if (tee.sketchKey) {
      out.set(tee.sketchKey, {
        deflectionDeg: tee.deflectionDeg ?? 90,
        nominalA: tee.nominalA,
      });
    }
  }
  return out;
}

// v2.40 Where each sketch node ends up once the model is solved, projected
// back to the isometric. A run between two levels then draws at a slant
// instead of staying locked to one of the six axes.
// v2.54 Turning the view must not turn the drawing's maths. A drag is read
// in whatever perspective is on screen and handed back in sketch space, so
// pulling a run to the right always sends it right — from any viewpoint.
export function viewDeltas(mmPerPoint, view = {}) {
  const yaw = ((view.yawDeg ?? ISO_YAW) * Math.PI) / 180;
  const pitch = ((view.pitchDeg ?? ISO_PITCH) * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const k = VIEW_K * (pointStep / mmPerPoint);

  // the horizontal half of the projection is a 2x2 turn, so it inverts
  const screenToWorld = (sx, sy2) => {
    const a = sx / k;
    const b = Math.abs(sp) > 1e-6 ? sy2 / (k * sp) : 0;
    return { x: (a * cy) - (b * sy), z: (a * sy) + (b * cy) };
  };

  // straight-down views flatten height away; hold the sketch scale there
  // rather than divide by nothing
  const risePerPx = Math.abs(cp) > 1e-3 ? 1 / (k * cp) : mmPerPoint / pointStep;
  return { screenToWorld, risePerPx };
}

export function projectedNodes(lines, mmPerPoint, options = {}) {
  const out = new Map();
  if (!lines.length) return out;
  const segments = placeNodes(lines, mmPerPoint, 60);
  // v2.46 The viewpoint turns the world before it is projected, so the same
  // model can be read from the far side, or from above or below.
  // v2.48 The viewpoint is a free orbit now: yaw turns the world, pitch
  // tips it. The defaults are the true isometric angles, so the home view
  // is exactly what it always was.
  const yaw = ((options.view?.yawDeg ?? ISO_YAW) * Math.PI) / 180;
  const pitch = ((options.view?.pitchDeg ?? ISO_PITCH) * Math.PI) / 180;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const pxPerMm = pointStep / mmPerPoint;
  // iso is the working view; top and bottom are the plan views a fitter
  // reaches for when the run has to be read square-on
  const project = (p) => {
    const x = (p.x * cy) + (p.z * sy);
    const z = (-p.x * sy) + (p.z * cy);
    return {
      x: VIEW_K * x * pxPerMm,
      y: VIEW_K * ((z * sp) - (p.y * cp)) * pxPerMm,
    };
  };

  const raw = new Map();
  for (const seg of segments) {
    raw.set(seg.key1, project(seg.p1));
    raw.set(seg.key2, project(seg.p2));
  }

  // anchor the projection on the sketch so the drawing stays where it was
  const firstKey = key2D(lines[0].start);
  const anchor = raw.get(firstKey);
  if (!anchor) return out;
  const dx = lines[0].start.x - anchor.x;
  const dy = lines[0].start.y - anchor.y;
  for (const [key, point] of raw) {
    out.set(key, { x: point.x + dx, y: point.y + dy });
  }
  return out;
}

// v2.43 What each drawn run actually measures once the model is solved.
export function runMetrics(lines, mmPerPoint, options = {}) {
  const model = buildPipeModel(lines, mmPerPoint, options);
  const out = new Map();
  for (const run of model.runs) {
    out.set(run.lineIndex, {
      trueLengthMm: run.trueLengthMm,
      riseMm: run.riseMm,
      slopeDeg: run.slopeDeg,
      cutLengthMm: run.cutLengthMm,
    });
  }
  return out;
}
