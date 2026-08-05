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
