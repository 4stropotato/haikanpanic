// [v1.02] DrawLayer renders user-drawn lines and preview
// [v1.03] Added traditional versioned comments, no logic changes
// [v1.04] Continued documentation updates, no functional changes
// [v1.05] Verified consistency for magnifier integration, no logic changes
// [v1.08] Retina-scale canvas for ultra-sharp 2px lines at all zoom levels
// [v1.10] Apply zoom + offset transform to sync with workspace grid and assume workspace-space coordinates

import { useEffect, useRef } from "react";                      // v1.10+ React hook for canvas updates
import { pointStep } from "../utils/constants";                 // v1.17+ dot-step distance for real lengths
import { useViewport } from "../utils/viewport";                // v1.18+ live workspace size
import { segmentLengthMm } from "../utils/lengths";             // v2.05 pure length math
import { overlappingRuns } from "../utils/editLength";          // v2.41 two pipes, one line
import { glPlaneGeometry, viewRect, clampHandle } from "../utils/glPlane"; // v2.09 GL/FL datum plane
import { nodeElevations, runMetrics } from "../workshop/pipe3d"; // v2.24 slope from elevations
import { sketchJoints, jointTypeOf, JOINT_MARK } from "../utils/joints"; // v2.10 corner fittings
import { datumFor } from "../utils/datums";
import { LABEL_DEFAULT, LABEL_HOME } from "../utils/labelFields";      // v2.51 what a label says                      // v2.38 which level a height is read from

export { segmentLengthMm } from "../utils/lengths";   // v2.05 moved to pure module

// v1.17+ Label text honors an override: schematic mode can claim any true
// length regardless of drawn length (label is authoritative, per DRAW2 spec).
function labelFor(line, mmPerPoint, elevations, metric, fields = LABEL_DEFAULT) {
  // a sloped run is longer than the horizontal it was typed as, and that
  // extra is rarely a round number — which is exactly what has to be cut
  const sloped = metric && Math.abs(metric.slopeDeg) > 0.4 && Math.abs(metric.slopeDeg) < 89.6;
  const mm = sloped ? metric.trueLengthMm : (line.lengthMm ?? segmentLengthMm(line, mmPerPoint));
  const parts = [];
  if (fields.length) parts.push(`${mm}mm`);
  if (line.spec) {
    const { a, conn, material, schedule } = line.spec;
    const bits = [];
    if (fields.size) bits.push(`${a}A`);
    if (fields.sch) {
      if (material && material !== "SGP") bits.push(material.replace("TP", ""));
      if (schedule && schedule !== "SGP") bits.push(schedule);
    }
    if (fields.joint && conn) bits.push(conn);
    if (bits.length) parts.push(bits.join(" "));
  }
  // v2.24 A run whose ends sit at different levels is sloped; the angle is
  // what a fitter needs, and it is invisible in a 6-direction sketch.
  if (sloped && fields.angle) parts.push(`∠${Math.abs(metric.slopeDeg)}°`);
  if (sloped && fields.rise) {
    parts.push(`${metric.riseMm > 0 ? "↑" : "↓"}${Math.abs(metric.riseMm)}`);
  }
  // v2.51 The run's own elevations, for when the leaders are turned off.
  if (fields.el && elevations) {
    const key = (n) => `${n.x.toFixed(3)},${n.y.toFixed(3)}`;
    const a = elevations.get(key(line.start));
    const b = elevations.get(key(line.end));
    const show = (v) => `${v >= 0 ? "+" : ""}${Math.round(v)}`;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      parts.push(a === b ? `EL${show(a)}` : `EL${show(a)}→${show(b)}`);
    }
  }
  return parts.join("  ");
}

const DrawLayer = ({
  lines, preview, isDark, zoom, offset, mmPerPoint = 10,
  showGL = true, glEditPlane = false,
  jointTypes = {}, datums = [], activeDatum = -1, showJointMarks = true,
  selection = [], marquee = null, moveMode = false, projection = null,
  labelFields = LABEL_DEFAULT, labelAvoid = true, onLabelLayout = null,
  elOffsets = {}, labelFlat = false,
}) => { // [v1.09] Accept zoom and offset for scaling
  const canvasRef = useRef(null);                                 // [v1.02] Canvas DOM reference
  const { w: vpW, h: vpH } = useViewport();                       // v1.18+ re-render on resize

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = vpW;                                            // v1.18+ shared viewport size
    const height = vpH;
    const dpr = window.devicePixelRatio || 1;                     // [v1.08] Retina awareness

    canvas.width = width * dpr;                                   // [v1.08] Set physical resolution
    canvas.height = height * dpr;                                 // [v1.08] Set physical resolution
    canvas.style.width = `${width}px`;                            // [v1.08] CSS pixel size
    canvas.style.height = `${height}px`;                          // [v1.08] CSS pixel size

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                        // [v1.08] Scale for crisp lines
    ctx.clearRect(0, 0, width, height);                           // [v1.02] Clear canvas before redraw

    if (!ctx) return;

    ctx.save();                                                   // [v1.10] Begin transform block
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);   // [v1.10] Center and apply pan
    ctx.scale(zoom, zoom);                                        // [v1.10] Apply zoom

    ctx.strokeStyle = isDark ? "white" : "black";                 // [v1.02] Stroke color based on theme
    ctx.lineWidth = 2 / zoom;                                     // [v1.10] Adjusted for consistent visual thickness
    ctx.lineCap = "round";                                        // [v1.08] Smooth end caps
    ctx.lineJoin = "round";                                       // [v1.08] Smooth joins

    const elevationsForLabels = lines.length ? nodeElevations(lines, mmPerPoint) : null;
    const metrics = lines.length ? runMetrics(lines, mmPerPoint) : null;
    // v2.49 A run's label rides along the run, the way dimension text does
    // on a drawn isometric: set on the line's own angle and lifted clear of
    // it, so a busy sketch reads as annotated pipes rather than loose text.
    // v2.52 Two labels that would land on top of each other are pushed
    // apart along their own runs' normals — an unreadable label is worse
    // than one sitting a little further out.
    const layout = [];
    const obstacles = [];      // v2.52 EL callouts are text too — labels dodge them
    const elLayout = [];       // v2.57 the callouts a finger can pick up
    const placeLabel = (line, index) => {
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const len = Math.hypot(dx, dy);
      if (len < pointStep * 0.5) return;

      // never upside down: a run heading left is lettered from its far end
      let angle = Math.atan2(dy, dx);
      let flip = 1;
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
        flip = -1;
      }

      const text = labelFor(line, mmPerPoint, elevationsForLabels, metrics?.get(index), labelFields);
      if (!text) return;

      const place = line.label ?? LABEL_HOME;
      ctx.font = `${12 / zoom}px system-ui, sans-serif`;
      const w = ctx.measureText(text).width;
      const h = 14 / zoom;
      const ux = Math.cos(angle);
      const uy = Math.sin(angle);
      const mx = (line.start.x + line.end.x) / 2;
      const my = (line.start.y + line.end.y) / 2;

      // the text box, turned the way the text will be, as a screen extent
      const tx = labelFlat ? 1 : ux;
      const ty = labelFlat ? 0 : uy;
      const hw = (Math.abs(tx) * w + Math.abs(ty) * h) / 2;
      const hh = (Math.abs(ty) * w + Math.abs(tx) * h) / 2;

      const at = (across) => ({
        x: mx + (ux * place.along * len * flip) - (uy * (across / zoom) * flip),
        y: my + (uy * place.along * len * flip) + (ux * (across / zoom) * flip),
      });

      let across = place.across;
      let spot = at(across);
      const clashes = (p, other) => Math.abs(p.x - other.x) < hw + other.hw
        && Math.abs(p.y - other.y) < hh + other.hh;
      const hits = (p) => layout.some((o) => clashes(p, o)) || obstacles.some((o) => clashes(p, o));
      for (let step = 1; labelAvoid && step <= 8 && hits(spot); step += 1) {
        // walk outward on the side the label already prefers, then the other
        const push = Math.ceil(step / 2) * (h * zoom + 4);
        across = place.across + (step % 2 === 1 ? push : -push) * Math.sign(place.across || -1);
        spot = at(across);
      }

      layout.push({ index, x: spot.x, y: spot.y, hw, hh, text, angle, flip, ux, uy, len });
    };

    const drawLabel = (entry) => {
      ctx.save();
      ctx.translate(entry.x, entry.y);
      // v2.57 directional text rides the run; traditional text stays level
      if (!labelFlat) ctx.rotate(entry.angle);
      ctx.font = `${12 / zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3 / zoom;
      ctx.strokeStyle = isDark ? "rgba(15,20,27,0.85)" : "rgba(255,255,255,0.85)";
      ctx.fillStyle = isDark ? "#7cc4ff" : "#1d6fb8";
      ctx.strokeText(entry.text, 0, 0);
      ctx.fillText(entry.text, 0, 0);
      ctx.restore();
      if (moveMode) {
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(124,196,255,0.55)";
        ctx.fill();
      }
    };

    // v2.19 Datum planes. A job has several levels, so every datum in the
    // list is drawn; the first one is primary and carries the EL leaders.
    if (showGL && lines.length && datums.length) {
      datums.forEach((datum, datumIdx) => {
        const plane = glPlaneGeometry(lines, mmPerPoint, { ...datum, projection });
        if (!plane) return;
        const { corners, edges, nodes } = plane;
        const active = datumIdx === activeDatum;
        const tint = datumIdx === 0 ? "245,186,102" : "124,196,255";

        ctx.save();
        if (datum.continuous) {
          const left = ((-width / 2) - offset.x) / zoom;
          const top = ((-height / 2) - offset.y) / zoom;
          ctx.fillStyle = `rgba(${tint},0.05)`;
          ctx.fillRect(left, top, (width * 2) / zoom, (height * 2) / zoom);
        } else {
          ctx.beginPath();
          ctx.moveTo(corners[0].x, corners[0].y);
          for (const corner of corners.slice(1)) ctx.lineTo(corner.x, corner.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${tint},${active ? 0.09 : 0.055})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${tint},${active || glEditPlane ? 0.85 : 0.38})`;
          ctx.lineWidth = (active || glEditPlane ? 1.8 : 1.2) / zoom;
          ctx.stroke();
        }
        ctx.restore();

        // label: name and its own elevation
        ctx.save();
        ctx.font = `bold ${12 / zoom}px system-ui, sans-serif`;
        ctx.fillStyle = `rgb(${tint})`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        const elText = datum.offsetMm ? ` +${datum.offsetMm}` : " ±0";
        ctx.fillText(`${datum.name}${elText}`, corners[2].x + (10 / zoom), corners[2].y + (6 / zoom));
        ctx.restore();

        if (datumIdx === 0) {
          ctx.save();
          ctx.strokeStyle = "rgba(245,186,102,0.45)";
          ctx.setLineDash([6 / zoom, 5 / zoom]);
          ctx.lineWidth = 1 / zoom;
          ctx.font = `bold ${12 / zoom}px system-ui, sans-serif`;
          ctx.fillStyle = "#f5ba66";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const node of nodes) {
            if (Math.abs(node.ground.y - node.point.y) < 2) continue;
            ctx.beginPath();
            ctx.moveTo(node.point.x, node.point.y);
            ctx.lineTo(node.ground.x, node.ground.y);
            ctx.stroke();
            // v2.56 The callout rides its own leader, the way a run label
            // rides its pipe: set on the leader's angle and lifted off it, so
            // the height reads beside the drop line instead of across it.
            const ref = datumFor(node.elevation, datums);
            const rel = Math.round(node.elevation - ref.offsetMm);
            const callout = `${ref.name} ${rel >= 0 ? "+" : ""}${rel}`;
            const ldx = node.ground.x - node.point.x;
            const ldy = node.ground.y - node.point.y;
            const llen = Math.hypot(ldx, ldy) || 1;
            let la = Math.atan2(ldy, ldx);
            if (la > Math.PI / 2 || la < -Math.PI / 2) la += Math.PI;
            const lux = Math.cos(la);
            const luy = Math.sin(la);
            // a third of the way down the drop by default, clear of the
            // fitting mark; the fitter can slide it anywhere from there
            const place = elOffsets[node.key]
              ?? { along: Math.min(0.35, (90 / zoom) / llen), across: -5 };
            const along = place.along * llen;
            const cross = place.across / zoom;
            const cx = node.point.x + ((ldx / llen) * along) - (luy * cross);
            const cy = node.point.y + ((ldy / llen) * along) + (lux * cross);
            ctx.save();
            ctx.translate(cx, cy);
            // v2.57 traditional callouts stay horizontal whatever the leader
            // does; directional ones lie along it
            if (!labelFlat) ctx.rotate(la);
            ctx.fillText(callout, 0, 0);
            ctx.restore();
            const cw = ctx.measureText(callout).width;
            const ch = 14 / zoom;
            const turn = labelFlat ? { x: 1, y: 0 } : { x: lux, y: luy };
            obstacles.push({
              x: cx,
              y: cy,
              hw: ((Math.abs(turn.x) * cw) + (Math.abs(turn.y) * ch)) / 2,
              hh: ((Math.abs(turn.y) * cw) + (Math.abs(turn.x) * ch)) / 2,
            });
            elLayout.push({
              kind: "el", key: node.key, x: cx, y: cy, len: llen, flip: 1,
              homeAlong: place.along,
              ux: labelFlat ? 1 : lux, uy: labelFlat ? 0 : luy,
              leadX: ldx / llen, leadY: ldy / llen,
            });
          }
          ctx.restore();
        }

        // handles only on the plane being edited
        if (active && glEditPlane && !datum.continuous) {
          ctx.save();
          ctx.strokeStyle = "rgba(10,14,20,0.9)";
          ctx.lineWidth = 2 / zoom;
          // v2.62 A plane wider than the screen kept its grips off it. They
          // are drawn at the edge instead, hollow, so it reads as "the corner
          // is out that way" while still being something you can take hold of.
          const rect = viewRect(width, height, zoom, offset);
          const grips = [
            ...corners.map((c) => ({ at: c, kind: "corner" })),
            ...edges.map((e) => ({ at: e.point, kind: "edge" })),
          ];
          for (const grip of grips) {
            const at = clampHandle(grip.at, plane.cx, plane.cy, rect);
            ctx.beginPath();
            ctx.arc(at.x, at.y, (grip.kind === "corner" ? 9 : 8) / zoom, 0, Math.PI * 2);
            ctx.fillStyle = at.clamped ? "rgba(10,14,20,0.85)" : `rgba(${tint},0.92)`;
            ctx.fill();
            ctx.strokeStyle = at.clamped ? `rgba(${tint},0.95)` : "rgba(10,14,20,0.9)";
            ctx.stroke();
            ctx.strokeStyle = "rgba(10,14,20,0.9)";
          }
          // centre handle: the one grip that moves the whole plane
          ctx.beginPath();
          ctx.arc(plane.cx, plane.cy, 11 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${tint},0.95)`;
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(plane.cx - (5 / zoom), plane.cy);
          ctx.lineTo(plane.cx + (5 / zoom), plane.cy);
          ctx.moveTo(plane.cx, plane.cy - (5 / zoom));
          ctx.lineTo(plane.cx, plane.cy + (5 / zoom));
          ctx.strokeStyle = "rgba(10,14,20,0.9)";
          ctx.stroke();

          const half = 7 / zoom;
          for (const edge of edges) {
            ctx.beginPath();
            ctx.rect(edge.point.x - half, edge.point.y - half, half * 2, half * 2);
            ctx.fillStyle = `rgba(${tint},0.72)`;
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      });
    }

    const selected = new Set(selection);
    const stacked = overlappingRuns(lines);
    lines.forEach((line, index) => {
      const on = selected.has(index);
      // two runs sharing a grid line read as one pipe, so they are called out
      const clash = stacked.has(index);
      ctx.strokeStyle = on ? "#7cc4ff" : (clash ? "#f5ba66" : (isDark ? "white" : "black"));
      ctx.lineWidth = (on || clash ? 4 : 2) / zoom;
      ctx.setLineDash(clash && !on ? [9 / zoom, 5 / zoom] : []);
      ctx.beginPath();
      ctx.moveTo(line.start.x, line.start.y);                     // [v1.09] Use workspace-space coordinates directly
      ctx.lineTo(line.end.x, line.end.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    ctx.strokeStyle = isDark ? "white" : "black";
    ctx.lineWidth = 2 / zoom;
    lines.forEach(placeLabel);                                    // v2.52 lay out, then keep apart
    for (const entry of layout) drawLabel(entry);                 // v1.17+ labels ride the runs
    onLabelLayout?.([
      ...layout.map(({ index, x, y, ux, uy, len, flip }) => ({ index, x, y, ux, uy, len, flip })),
      ...elLayout,
    ]);

    // v2.10 corner fittings: L / S / T / W so the choice is visible on the
    // drawing, the way a fitter marks up an isometric by hand.
    for (const joint of showJointMarks ? sketchJoints(lines) : []) {
      const type = jointTypeOf(joint, lines, jointTypes);
      const r = 9 / zoom;
      ctx.beginPath();
      ctx.arc(joint.point.x, joint.point.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? "rgba(10,14,20,0.92)" : "rgba(255,255,255,0.92)";
      ctx.fill();
      ctx.strokeStyle = "#7cc4ff";
      ctx.lineWidth = 1.6 / zoom;
      ctx.stroke();
      ctx.fillStyle = "#7cc4ff";
      ctx.font = `bold ${11 / zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(JOINT_MARK[type], joint.point.x, joint.point.y);
    }
    ctx.lineWidth = 2 / zoom;

    if (preview) {
      ctx.strokeStyle = isDark ? "white" : "black";
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);               // [v1.09] Preview in workspace coordinates
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6 / zoom, 4 / zoom]);                      // [v1.10] Dash length adjusts with zoom
      ctx.stroke();
      ctx.setLineDash([]);                                        // [v1.02] Reset to solid line
      const before = layout.length;                               // v1.17+ live length while drawing
      placeLabel(preview, -1);
      for (let i = before; i < layout.length; i += 1) drawLabel(layout[i]);
    }

    // v2.38 Level handles. You cannot grab what you cannot see: while Move
    // is active every endpoint shows a ring, and dragging one changes that
    // node's elevation rather than sliding the whole run.
    if (moveMode) {
      const seenEnds = new Set();
      ctx.save();
      for (const line of lines) {
        for (const node of [line.start, line.end]) {
          const key = `${node.x.toFixed(3)},${node.y.toFixed(3)}`;
          if (seenEnds.has(key)) continue;
          seenEnds.add(key);
          ctx.beginPath();
          ctx.arc(node.x, node.y, 7 / zoom, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(10,14,20,0.85)";
          ctx.fill();
          ctx.strokeStyle = "rgba(245,186,102,0.95)";
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(node.x, node.y - (3.5 / zoom));
          ctx.lineTo(node.x, node.y + (3.5 / zoom));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // v2.29 Rubber band. It is deliberately square to the screen, not to
    // the isometric axes, because that is how a selection box reads.
    if (marquee) {
      const left = Math.min(marquee.x0, marquee.x1);
      const top = Math.min(marquee.y0, marquee.y1);
      const w = Math.abs(marquee.x1 - marquee.x0);
      const h = Math.abs(marquee.y1 - marquee.y0);
      ctx.save();
      ctx.fillStyle = "rgba(124,196,255,0.10)";
      ctx.fillRect(left, top, w, h);
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeStyle = "rgba(124,196,255,0.9)";
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeRect(left, top, w, h);
      ctx.restore();
    }

    ctx.restore();                                                // [v1.10] End transform block
  }, [lines, preview, isDark, zoom, offset, mmPerPoint, showGL, glEditPlane,
      jointTypes, datums, activeDatum, showJointMarks,
      selection, marquee, moveMode, projection, vpW, vpH]);   // [v1.10] Redraw on zoom or pan

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",     // [v1.02] Layer positioned over grid
        top: 0,
        left: 0,
        zIndex: 6,                // [v1.02] Above grid, below overlays
        pointerEvents: "none",    // [v1.02] Let input pass through
      }}
    />
  );
};

export default DrawLayer;                                         // [v1.02] Export draw component
