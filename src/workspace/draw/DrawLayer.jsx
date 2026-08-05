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
import { glPlaneGeometry } from "../utils/glPlane";              // v2.09 GL/FL datum plane
import { sketchJoints, jointTypeOf, JOINT_MARK } from "../utils/joints"; // v2.10 corner fittings

export { segmentLengthMm } from "../utils/lengths";   // v2.05 moved to pure module

// v1.17+ Label text honors an override: schematic mode can claim any true
// length regardless of drawn length (label is authoritative, per DRAW2 spec).
function labelFor(line, mmPerPoint) {
  const mm = line.lengthMm ?? segmentLengthMm(line, mmPerPoint);
  if (!line.spec) return `${mm}mm`;
  const { a, conn, material, schedule } = line.spec;
  const grade = material && material !== "SGP" ? ` ${material.replace("TP", "")}` : "";
  const sch = schedule && schedule !== "SGP" ? ` ${schedule}` : "";
  return `${mm}mm  ${a}A${grade}${sch} ${conn}`;
}

const DrawLayer = ({
  lines, preview, isDark, zoom, offset, mmPerPoint = 10,
  showGL = true, glEditPlane = false,
  jointTypes = {}, datums = [], activeDatum = -1,
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

    // v1.17+ Length label beside a segment's midpoint, offset perpendicular
    // so it never sits on the line. Halo keeps it readable over the grid.
    const drawLabel = (line) => {
      const mx = (line.start.x + line.end.x) / 2;
      const my = (line.start.y + line.end.y) / 2;
      const len = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
      if (len < pointStep * 0.5) return;
      const nx = -(line.end.y - line.start.y) / len;
      const ny = (line.end.x - line.start.x) / len;
      const off = 11 / zoom;
      ctx.font = `${12 / zoom}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3 / zoom;
      ctx.strokeStyle = isDark ? "rgba(15,20,27,0.85)" : "rgba(255,255,255,0.85)";
      ctx.fillStyle = isDark ? "#7cc4ff" : "#1d6fb8";
      const text = labelFor(line, mmPerPoint);
      ctx.strokeText(text, mx + nx * off, my + ny * off);
      ctx.fillText(text, mx + nx * off, my + ny * off);
    };

    // v2.19 Datum planes. A job has several levels, so every datum in the
    // list is drawn; the first one is primary and carries the EL leaders.
    if (showGL && lines.length && datums.length) {
      datums.forEach((datum, datumIdx) => {
        const plane = glPlaneGeometry(lines, mmPerPoint, datum);
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
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          for (const node of nodes) {
            if (Math.abs(node.ground.y - node.point.y) < 2) continue;
            ctx.beginPath();
            ctx.moveTo(node.point.x, node.point.y);
            ctx.lineTo(node.ground.x, node.ground.y);
            ctx.stroke();
            ctx.fillText(
              `EL +${node.elevation}`,
              node.point.x - (14 / zoom),
              node.point.y + (16 / zoom),
            );
          }
          ctx.restore();
        }

        // handles only on the plane being edited
        if (active && glEditPlane && !datum.continuous) {
          ctx.save();
          ctx.strokeStyle = "rgba(10,14,20,0.9)";
          ctx.lineWidth = 2 / zoom;
          for (const corner of corners) {
            ctx.beginPath();
            ctx.arc(corner.x, corner.y, 9 / zoom, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${tint},0.92)`;
            ctx.fill();
            ctx.stroke();
          }
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

    for (const line of lines) {
      ctx.beginPath();
      ctx.moveTo(line.start.x, line.start.y);                     // [v1.09] Use workspace-space coordinates directly
      ctx.lineTo(line.end.x, line.end.y);
      ctx.stroke();
    }
    ctx.lineWidth = 2 / zoom;
    for (const line of lines) drawLabel(line);                    // v1.17+ labels above lines

    // v2.10 corner fittings: L / S / T / W so the choice is visible on the
    // drawing, the way a fitter marks up an isometric by hand.
    for (const joint of sketchJoints(lines)) {
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
      drawLabel(preview);                                         // v1.17+ live length while drawing
    }

    ctx.restore();                                                // [v1.10] End transform block
  }, [lines, preview, isDark, zoom, offset, mmPerPoint, showGL, glEditPlane,
      jointTypes, datums, activeDatum, vpW, vpH]);   // [v1.10] Redraw on zoom or pan

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
