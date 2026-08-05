// v2.10 Sketch joints — the corners where drawn lines meet. Each one is a
// real fitting decision: long elbow, short elbow, チーズ (tee), or a plain
// mitered weld. Identified by the shared 2D point so the choice survives
// edits to either leg.
const EPS = 1e-6;

export const key2D = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;

export const JOINT_TYPES = ["elbowLR", "elbowSR", "tee", "weld"];

export const JOINT_LABEL = {
  en: { elbowLR: "Elbow LR", elbowSR: "Elbow SR", tee: "Tee", weld: "Miter weld" },
  jp: { elbowLR: "ロングエルボ", elbowSR: "ショートエルボ", tee: "チーズ", weld: "溶接（エビ）" },
};

export const JOINT_MARK = { elbowLR: "L", elbowSR: "S", tee: "T", weld: "W" };

// Every point shared by two or more line ends, with its legs.
export function sketchJoints(lines) {
  const map = new Map();
  lines.forEach((line, index) => {
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
  if (joint.legs.length >= 3) return "tee";
  const [a, b] = joint.legs;
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

export function jointTypeOf(joint, lines, jointTypes) {
  const chosen = jointTypes?.[joint.key];
  if (chosen && JOINT_TYPES.includes(chosen)) return chosen;
  return defaultJointType(joint, lines);
}

export { EPS };
