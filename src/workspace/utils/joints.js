// v2.20 Sketch joints — the corners where drawn lines meet. Each one is a
// real fitting decision. A joint's setting is an object so an elbow can also
// carry a take-out override, which is how a cut-down elbow or a tight-gemba
// special gets drawn without inventing a new fitting type.
const EPS = 1e-6;

export const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

export const JOINT_TYPES = ["elbowLR", "elbowSR", "elbowCut", "tee", "wye", "weld"];

export const JOINT_LABEL = {
  en: {
    elbowLR: "Elbow LR",
    elbowSR: "Elbow SR",
    elbowCut: "Cut elbow",
    tee: "Tee",
    wye: "Wye 45°",
    weld: "Miter weld",
  },
  jp: {
    elbowLR: "ロングエルボ",
    elbowSR: "ショートエルボ",
    elbowCut: "切詰エルボ",
    tee: "チーズ",
    wye: "ワイ 45°",
    weld: "エビ・溶接",
  },
};

export const JOINT_MARK = {
  elbowLR: "L", elbowSR: "S", elbowCut: "C", tee: "T", wye: "Y", weld: "W",
};

// Every point shared by two or more line ends, with its legs.
export function sketchJoints(lines) {
  const map = new Map();
  lines.forEach((line, index) => {
    // a dot contributes no direction, so it must not count as a leg
    if (Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y) < EPS) return;
    for (const which of [1, 2]) {
      const point = which === 1 ? line.start : line.end;
      const key = key2D(point);
      if (!map.has(key)) map.set(key, { key, point, legs: [] });
      map.get(key).legs.push({ index, which });
    }
  });
  return [...map.values()].filter((joint) => joint.legs.length >= 2);
}

// The joint nearest to a workspace point, within `maxDist`.
export function findJointAt(point, lines, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const joint of sketchJoints(lines)) {
    const dist = Math.hypot(point.x - joint.point.x, point.y - joint.point.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = joint;
    }
  }
  return best;
}

// Default when the fitter has not chosen: a straight pass-through is just a
// weld, a bend is a long-radius elbow, three legs is a tee.
export function defaultJointType(joint, lines) {
  if (!joint?.legs || joint.legs.length < 2) return "elbowLR";
  if (joint.legs.length >= 3) return "tee";
  const [a, b] = joint.legs;
  if (!lines[a?.index] || !lines[b?.index]) return "elbowLR";
  const dir = (leg) => {
    const line = lines[leg.index];
    const from = leg.which === 1 ? line.start : line.end;
    const to = leg.which === 1 ? line.end : line.start;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  const u = dir(a);
  const v = dir(b);
  const dot = (u.x * v.x) + (u.y * v.y);
  return dot < -1 + 0.02 ? "weld" : "elbowLR";
}

// Settings were plain strings before take-out overrides existed.
export function jointSettingOf(joint, lines, jointTypes) {
  const stored = jointTypes?.[joint.key];
  if (typeof stored === "string" && JOINT_TYPES.includes(stored)) return { type: stored };
  if (stored && typeof stored === "object" && JOINT_TYPES.includes(stored.type)) return stored;
  return { type: defaultJointType(joint, lines) };
}

export function jointTypeOf(joint, lines, jointTypes) {
  return jointSettingOf(joint, lines, jointTypes).type;
}

export { EPS };
