// v1.20+ JIS pipe data — the "配管tap" role, in-app. Source: public JIS
// standard tables (G3452 SGP carbon steel pipe; elbow center-to-face per
// JIS B2311 long-radius butt-weld). Values cross-checked against the
// 配管tap V1 app screenshot for 100A: OD 114.3, t 4.5, 12.2 kg/m.
//
// This table powers: pipe spec labels on drawn lines, cut-length fitting
// deductions (I5), and weight totals.

export const SGP = [
  // [nominal A, inches B, OD mm, wall mm, kg/m]
  { a: 15, b: "1/2", od: 21.7, t: 2.8, kgm: 1.31 },
  { a: 20, b: "3/4", od: 27.2, t: 2.8, kgm: 1.68 },
  { a: 25, b: "1", od: 34.0, t: 3.2, kgm: 2.43 },
  { a: 32, b: "1-1/4", od: 42.7, t: 3.5, kgm: 3.38 },
  { a: 40, b: "1-1/2", od: 48.6, t: 3.5, kgm: 3.89 },
  { a: 50, b: "2", od: 60.5, t: 3.8, kgm: 5.31 },
  { a: 65, b: "2-1/2", od: 76.3, t: 4.2, kgm: 7.47 },
  { a: 80, b: "3", od: 89.1, t: 4.2, kgm: 8.79 },
  { a: 90, b: "3-1/2", od: 101.6, t: 4.2, kgm: 10.1 },
  { a: 100, b: "4", od: 114.3, t: 4.5, kgm: 12.2 },
  { a: 125, b: "5", od: 139.8, t: 4.5, kgm: 15.0 },
  { a: 150, b: "6", od: 165.2, t: 5.0, kgm: 19.8 },
  { a: 200, b: "8", od: 216.3, t: 5.8, kgm: 30.1 },
  { a: 250, b: "10", od: 267.4, t: 6.6, kgm: 42.4 },
  { a: 300, b: "12", od: 318.5, t: 6.9, kgm: 53.0 },
  { a: 350, b: "14", od: 355.6, t: 7.9, kgm: 67.7 },
  { a: 400, b: "16", od: 406.4, t: 7.9, kgm: 77.6 },
  { a: 450, b: "18", od: 457.2, t: 7.9, kgm: 87.5 },
  { a: 500, b: "20", od: 508.0, t: 7.9, kgm: 97.4 },
];

export function pipeSpec(nominalA) {
  return SGP.find((row) => row.a === nominalA) ?? null;
}

// v1.20+ Long-radius butt-weld 90° elbow center-to-face (JIS B2311):
// A = 1.5 x nominal(inch) x 25.4. For 45°, the standard C-to-F is shorter;
// approximated per table practice as A45 = A90 x tan(22.5°) for LR.
const NOMINAL_INCH = {
  15: 0.5, 20: 0.75, 25: 1, 32: 1.25, 40: 1.5, 50: 2, 65: 2.5, 80: 3,
  90: 3.5, 100: 4, 125: 5, 150: 6, 200: 8, 250: 10, 300: 12, 350: 14,
  400: 16, 450: 18, 500: 20,
};

export function nominalInch(nominalA) {
  return NOMINAL_INCH[nominalA] ?? null;
}

export function elbowCenterToFace(nominalA, angleDeg = 90) {
  const row = pipeSpec(nominalA);
  if (!row) return null;
  const inches = NOMINAL_INCH[nominalA];
  const a90 = 1.5 * inches * 25.4;
  if (angleDeg === 90) return Math.round(a90 * 10) / 10;
  return Math.round(a90 * Math.tan(((angleDeg / 2) * Math.PI) / 180) * 10) / 10;
}

// v1.20+ Cut length of a run between two fittings: true centerline length
// minus each end's deduction. The root gap makes the pipe SHORTER: the gap
// is the gap left open for the 裏波 (uranami) back-bead, so it adds to the
// assembled length and must come off the cut.
export function cutLength(centerMm, endA = {}, endB = {}) {
  const deduction = (end) => {
    if (!end.fitting) return 0;
    const c2f = elbowCenterToFace(end.nominalA, end.angleDeg ?? 90) ?? 0;
    return c2f + (end.gapMm ?? 0);
  };
  return Math.round((centerMm - deduction(endA) - deduction(endB)) * 10) / 10;
}

// v2.07 Materials. `density` g/cm3, `defaultSchedule` is what the shop
// reaches for first, `gap` is the usual 裏波 root gap for that material.
export const MATERIALS = [
  { id: "SGP", label: "SGP 配管用炭素鋼", spec: "JIS G3452", density: 7.85, defaultSchedule: "SGP", gap: 2 },
  { id: "STPG370", label: "STPG370 圧力配管", spec: "JIS G3454", density: 7.85, defaultSchedule: "Sch40", gap: 2.5 },
  { id: "SUS304TP", label: "SUS304TP", spec: "JIS G3459", density: 7.93, defaultSchedule: "Sch10S", gap: 2.5 },
  { id: "SUS316TP", label: "SUS316TP", spec: "JIS G3459", density: 7.98, defaultSchedule: "Sch10S", gap: 2.5 },
];

export function material(id) {
  return MATERIALS.find((row) => row.id === id) ?? MATERIALS[0];
}

// v2.07 Wall thickness by schedule (mm). SGP comes from the G3452 table
// above; Sch40/80 are B36.10M, Sch10S is B36.19M (stainless).
const SCHEDULE_WALL = {
  Sch40: {
    15: 2.77, 20: 2.87, 25: 3.38, 32: 3.56, 40: 3.68, 50: 3.91, 65: 5.16,
    80: 5.49, 90: 5.74, 100: 6.02, 125: 6.55, 150: 7.11, 200: 8.18,
    250: 9.27, 300: 10.31, 350: 11.13, 400: 12.7, 450: 14.27, 500: 15.09,
  },
  Sch80: {
    15: 3.73, 20: 3.91, 25: 4.55, 32: 4.85, 40: 5.08, 50: 5.54, 65: 7.01,
    80: 7.62, 90: 8.08, 100: 8.56, 125: 9.53, 150: 10.97, 200: 12.7,
    250: 15.09, 300: 17.45, 350: 19.05, 400: 21.44, 450: 23.83, 500: 26.19,
  },
  Sch10S: {
    15: 2.11, 20: 2.11, 25: 2.77, 32: 2.77, 40: 2.77, 50: 2.77, 65: 3.05,
    80: 3.05, 90: 3.05, 100: 3.05, 125: 3.4, 150: 3.4, 200: 3.76,
    250: 4.19, 300: 4.57, 350: 4.78, 400: 4.78, 450: 4.78, 500: 5.54,
  },
};

export const SCHEDULES = ["SGP", "Sch10S", "Sch40", "Sch80"];

export function wallThickness(nominalA, schedule = "SGP") {
  if (schedule === "SGP") return pipeSpec(nominalA)?.t ?? null;
  return SCHEDULE_WALL[schedule]?.[nominalA] ?? pipeSpec(nominalA)?.t ?? null;
}

// v2.07 Mass per metre from the actual wall: pi*(OD-t)*t*density.
// Verified against 配管tap: 100A SGP -> 12.2 kg/m.
export function massPerMetre(nominalA, schedule = "SGP", materialId = "SGP") {
  const od = pipeSpec(nominalA)?.od;
  const t = wallThickness(nominalA, schedule);
  if (!od || !t) return null;
  const kg = (Math.PI * (od - t) * t * material(materialId).density) / 1000;
  return Math.round(kg * 100) / 100;
}

// v2.06 JIS B2220 10K slip-on flange dimensions:
// [flange OD, thickness, bolt circle dia, bolt count, bolt dia]
const FLANGE_10K = {
  15: [95, 12, 70, 4, 12], 20: [100, 14, 75, 4, 12], 25: [125, 14, 90, 4, 16],
  32: [135, 16, 100, 4, 16], 40: [140, 16, 105, 4, 16], 50: [155, 16, 120, 4, 16],
  65: [175, 18, 140, 4, 16], 80: [185, 18, 150, 8, 16], 90: [195, 18, 160, 8, 16],
  100: [210, 18, 175, 8, 16], 125: [250, 20, 210, 8, 20], 150: [280, 22, 240, 8, 20],
  200: [330, 22, 290, 12, 20], 250: [400, 24, 355, 12, 22], 300: [445, 24, 400, 16, 22],
  350: [490, 26, 445, 16, 22], 400: [560, 28, 510, 16, 24], 450: [620, 30, 565, 20, 24],
  500: [675, 30, 620, 20, 24],
};

export function flangeSpec(nominalA) {
  const row = FLANGE_10K[nominalA];
  if (!row) return null;
  const [od, t, boltCircle, boltCount, boltDia] = row;
  return { od, t, boltCircle, boltCount, boltDia };
}

// v2.10 ASME B16.9 / JIS B2311 straight tee, centre to end (mm).
const TEE_CENTRE_TO_END = {
  15: 25, 20: 29, 25: 38, 32: 48, 40: 57, 50: 64, 65: 76, 80: 86, 90: 95,
  100: 105, 125: 124, 150: 143, 200: 178, 250: 216, 300: 254, 350: 279,
  400: 305, 450: 343, 500: 381,
};

export function teeCentreToEnd(nominalA) {
  return TEE_CENTRE_TO_END[nominalA] ?? (nominalA ? nominalA * 1.05 : 105);
}
