// v1.19+ Tap-to-edit segment length. The typed mm value is authoritative:
// the segment is stretched along its own direction to match, and everything
// rigidly connected to its far endpoint translates with it (CAD-style chain
// move), so joints stay joined.
import { pointStep } from "./constants";

const EPS = 1e-6;

function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

// v1.19+ Distance from a workspace point to a segment (for tap hit-testing).
export function distanceToSegment(point, line) {
  const vx = line.end.x - line.start.x;
  const vy = line.end.y - line.start.y;
  const wx = point.x - line.start.x;
  const wy = point.y - line.start.y;
  const lenSq = (vx * vx) + (vy * vy);
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((wx * vx) + (wy * vy)) / lenSq)) : 0;
  const px = line.start.x + (vx * t);
  const py = line.start.y + (vy * t);
  return Math.hypot(point.x - px, point.y - py);
}

// v1.19+ Index of the segment nearest to a tap, or -1 if none within range.
export function findSegmentAt(point, lines, maxDist) {
  let best = -1;
  let bestDist = maxDist;
  for (let index = 0; index < lines.length; index += 1) {
    const dist = distanceToSegment(point, lines[index]);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  }
  return best;
}

// v1.19+ All line indices rigidly connected to `startPoint`, walking through
// shared endpoints, excluding `excludeIndex` (the segment being edited).
function connectedComponent(lines, startPoint, excludeIndex) {
  const found = new Set();
  const queue = [startPoint];
  const visitedPoints = [];
  while (queue.length) {
    const point = queue.pop();
    if (visitedPoints.some((seen) => samePoint(seen, point))) continue;
    visitedPoints.push(point);
    for (let index = 0; index < lines.length; index += 1) {
      if (index === excludeIndex || found.has(index)) continue;
      const line = lines[index];
      if (samePoint(line.start, point) || samePoint(line.end, point)) {
        found.add(index);
        queue.push(line.start, line.end);
      }
    }
  }
  return found;
}

// v1.19+ Set segment `index` to `newMm` at the given scale. Returns new lines
// array; the edited line keeps its start, its end moves along the direction,
// and the chain hanging off the old end translates by the same delta.
export function setSegmentLength(lines, index, newMm, mmPerPoint) {
  const line = lines[index];
  const len = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
  if (len < EPS || !(newMm > 0)) return lines;
  const newLen = (newMm / mmPerPoint) * pointStep;
  const ux = (line.end.x - line.start.x) / len;
  const uy = (line.end.y - line.start.y) / len;
  const newEnd = { x: line.start.x + (ux * newLen), y: line.start.y + (uy * newLen) };
  const dx = newEnd.x - line.end.x;
  const dy = newEnd.y - line.end.y;
  const moved = connectedComponent(lines, line.end, index);
  return lines.map((current, currentIndex) => {
    if (currentIndex === index) {
      return { ...current, end: newEnd, lengthMm: newMm };
    }
    if (moved.has(currentIndex)) {
      return {
        ...current,
        start: { x: current.start.x + dx, y: current.start.y + dy },
        end: { x: current.end.x + dx, y: current.end.y + dy },
      };
    }
    return current;
  });
}

// v2.16 All line indices rigidly connected to `index`, including itself.
// Moving a pipe has to move whatever is welded to it.
export function connectedIndices(lines, index) {
  const found = new Set([index]);
  const queue = [lines[index].start, lines[index].end];
  const visited = [];
  while (queue.length) {
    const point = queue.pop();
    if (visited.some((seen) => samePoint(seen, point))) continue;
    visited.push(point);
    for (let i = 0; i < lines.length; i += 1) {
      if (found.has(i)) continue;
      const line = lines[i];
      if (samePoint(line.start, point) || samePoint(line.end, point)) {
        found.add(i);
        queue.push(line.start, line.end);
      }
    }
  }
  return found;
}
