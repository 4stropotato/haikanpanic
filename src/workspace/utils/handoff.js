// v1.16+ Draw-to-Studio handoff: joint detection and envelope construction.
// Implements integration/DRAW_TO_STUDIO_HANDOFF.md. Draw exports only what it
// owns: centerline runs on the 6 isometric directions, in explicit units.
// Studio validates, and the category choice stays explicit on the Studio side.

const HANDOFF_VERSION = "0.1.0";
const EPS = 1e-6;

// v1.16+ The 6 legal screen directions map to signed 3D axes.
// Screen y grows downward, so "up" on screen is -PI/2.
//   vertical        -> Z
//   up-right (-30°) -> +X   down-left (150°) -> -X
//   up-left (-150°) -> +Y   down-right (30°) -> -Y
function isoDirectionTo3D(dxs, dys) {
  const angle = Math.atan2(dys, dxs);
  const table = [
    { a: -Math.PI / 2, v: [0, 0, 1] },
    { a: Math.PI / 2, v: [0, 0, -1] },
    { a: -Math.PI / 6, v: [1, 0, 0] },
    { a: (5 * Math.PI) / 6, v: [-1, 0, 0] },
    { a: -(5 * Math.PI) / 6, v: [0, 1, 0] },
    { a: Math.PI / 6, v: [0, -1, 0] },
  ];
  let best = table[0];
  let bestDiff = Infinity;
  for (const entry of table) {
    let diff = Math.abs(angle - entry.a);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = entry;
    }
  }
  return best.v;
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

function lineLength(line) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

// v1.16+ Find all joints: endpoints shared by exactly two lines.
// Returns them in drawing order so the most recent joint is last.
export function findJoints(lines) {
  const joints = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      let joint = null;
      if (samePoint(a.end, b.start)) joint = { point: a.end, aOut: a.start, bOut: b.end };
      else if (samePoint(a.end, b.end)) joint = { point: a.end, aOut: a.start, bOut: b.start };
      else if (samePoint(a.start, b.start)) joint = { point: a.start, aOut: a.end, bOut: b.end };
      else if (samePoint(a.start, b.end)) joint = { point: a.start, aOut: a.end, bOut: b.start };
      if (joint) {
        joints.push({ ...joint, lineIndexA: i, lineIndexB: j });
      }
    }
  }
  return joints;
}

// v1.16+ True 3D angle between the two runs meeting at a joint.
// Outgoing unit vectors u, v from the joint; elbow deviation angle is
// 180 - angle(u, v): collinear pass-through gives 0 (no elbow),
// orthogonal runs give 90.
export function jointElbowAngle(joint) {
  const u = isoDirectionTo3D(joint.aOut.x - joint.point.x, joint.aOut.y - joint.point.y);
  const v = isoDirectionTo3D(joint.bOut.x - joint.point.x, joint.bOut.y - joint.point.y);
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const clamped = Math.max(-1, Math.min(1, dot));
  const between = (Math.acos(clamped) * 180) / Math.PI;
  return Math.round((180 - between) * 100) / 100;
}

// v1.16+ Build the StudioHandoff envelope for the most recent joint.
// Workspace units are exported 1:1 as mm and declared in metadata so the
// Studio side never has to guess the scale.
export function buildStudioHandoff(lines) {
  const joints = findJoints(lines);
  if (joints.length === 0) return null;
  const joint = joints[joints.length - 1];
  const lineA = lines[joint.lineIndexA];
  const lineB = lines[joint.lineIndexB];
  const elbowDeg = jointElbowAngle(joint);

  const nodes = [
    { id: "n-joint", x: joint.point.x, y: joint.point.y, tags: ["joint"] },
    { id: "n-a", x: joint.aOut.x, y: joint.aOut.y },
    { id: "n-b", x: joint.bOut.x, y: joint.bOut.y },
  ];
  const runs = [
    { id: "run-a", pathNodeIds: ["n-a", "n-joint"] },
    { id: "run-b", pathNodeIds: ["n-joint", "n-b"] },
  ];

  return {
    version: HANDOFF_VERSION,
    source: "haikanpanic-draw",
    units: { linear: "mm", angular: "deg" },
    documentId: `draw-${Date.now()}`,
    selection: {
      entityIds: [`line-${joint.lineIndexA}`, `line-${joint.lineIndexB}`],
      categoryHint: "shrimp",
    },
    geometry: { nodes, runs },
    metadata: {
      elbowDeg,
      legAMm: Math.round(lineLength(lineA)),
      legBMm: Math.round(lineLength(lineB)),
      workspaceUnitIsMm: true,
      jointCount: joints.length,
    },
  };
}

// v1.16+ Encode for transport in a URL query parameter.
export function encodeHandoff(envelope) {
  const json = JSON.stringify(envelope);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
