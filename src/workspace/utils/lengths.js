// v2.05 Pure length math, renderer-free so solvers and tests can import it.
import { pointStep } from "./constants";

// Segment length in mm: drawn px -> grid points -> configured scale.
export function segmentLengthMm(line, mmPerPoint) {
  const px = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
  return Math.round(px / pointStep) * mmPerPoint;
}

// The typed value always wins: schematic runs may be drawn short and
// labeled with their true length.
export function trueLengthMm(line, mmPerPoint) {
  return line.lengthMm ?? segmentLengthMm(line, mmPerPoint);
}

// v2.28 A tap that never became a run leaves a zero-length line behind. It
// is invisible on the drawing but it counts as a leg at its corner, so an
// elbow reads as a tee and no fitting can be built. A dot does not exist in
// a pipeline, so it is removed everywhere lines are accepted.
export function dropDegenerate(lines) {
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (const line of lines) {
    if (!line?.start || !line?.end) continue;
    // only a line with no drawn extent is a stray tap
    const px = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
    if (px < pointStep * 0.5) continue;
    // a nonsense length is a data fault, not a reason to delete the pipe:
    // drop the bad value and let the drawn length speak for it
    if (line.lengthMm != null && !(line.lengthMm > 0)) {
      const { lengthMm, ...rest } = line;
      out.push(rest);
      continue;
    }
    out.push(line);
  }
  return out;
}
