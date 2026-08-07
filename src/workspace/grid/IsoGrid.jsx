// [v1.0] Initial isometric grid implementation
// [v1.01] Add toggle to hide/show grid
// [v1.08] HiDPI (Retina) canvas support
// [v1.09] Apply zoom and offset transform uniformly to match static workspace illusion
// [v1.10] Centralized grid math via constants, slope calculation via tan30

import { useEffect, useRef } from "react";                          // [v1.10] React hook for lifecycle
import { dx, pointStep } from "../utils/constants";      // [v1.10] Centralized grid constants
import { planeAxes } from "../utils/glPlane";           // v3.15 the grid follows the view
import { useViewport } from "../utils/viewport";                   // v1.18+ live workspace size

const IsoGrid = ({ show, zoom = 1, offset = { x: 0, y: 0 }, view = null }) => {  // [v1.09] Accept zoom and offset props
  const canvasRef = useRef(null);
  const { w: vpW, h: vpH } = useViewport();                          // v1.18+ re-render on resize                                  // [v1.0] Reference to canvas element

  useEffect(() => {
    const canvas = canvasRef.current;                              // [v1.0] Get canvas DOM element
    const ctx = canvas.getContext("2d");                           // [v1.0] Get 2D drawing context
    const dpr = window.devicePixelRatio || 1;                      // [v1.08] Support HiDPI (Retina) screens
    const width = vpW;
    const height = vpH;

    canvas.width = width * dpr;                                    // [v1.08] Set physical canvas size
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;                             // [v1.08] CSS size for layout
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                         // [v1.08] Scale for sharpness
    ctx.clearRect(0, 0, width, height);                            // [v1.0] Clear canvas for redraw
    if (!show) return;                                             // [v1.01] Skip drawing if hidden

    ctx.save();
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);    // [v1.09] Apply pan offset to grid center
    ctx.scale(zoom, zoom);                                         // [v1.09] Apply zoom scaling

    // v2.02 unlimited workspace: derive the visible workspace-space rect
    // from pan/zoom and draw only the lines that cross it.
    const xa = (-width / 2 - offset.x) / zoom;
    const xb = (width / 2 - offset.x + width) / zoom;
    const ya = (-height / 2 - offset.y) / zoom;
    const yb = (height / 2 - offset.y + height) / zoom;

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      // v2.01 premium grid: quiet field, bold lines only gently brighter
      ctx.strokeStyle = bold ? "rgba(124,196,255,0.34)" : "rgba(124,196,255,0.13)";
      ctx.lineWidth = (bold ? 1.1 : 0.5) / zoom;
      ctx.stroke();
    };

    // v3.15 The grid is the world lattice seen from where you stand, not a
    // fixed pattern on the glass. Drawn the old way it kept its 30 degrees
    // while the pipes reprojected, so the moment you left the home view the
    // drawing no longer sat on its own grid — which is what "it does not
    // align" was. The three families run along the same axes the datum plane
    // and the snapping use, so everything agrees at any angle.
    const axes = planeAxes(view);
    const step = { u: { x: axes.u.x * pointStep, y: axes.u.y * pointStep },
      v: { x: axes.v.x * pointStep, y: axes.v.y * pointStep },
      w: { x: 0, y: pointStep } };
    const reach = Math.hypot(xb - xa, yb - ya) * 1.5;

    const family = (dir, along, boldEvery) => {
      const n = { x: -dir.y, y: dir.x };
      const nl = Math.hypot(n.x, n.y);
      if (nl < 1e-9) return;
      const spacing = ((along.x * n.x) + (along.y * n.y)) / nl;
      if (Math.abs(spacing) < 0.5) return;                  // edge-on: no family to draw
      const cast = [[xa, ya], [xb, ya], [xa, yb], [xb, yb]]
        .map(([x, y]) => ((x * n.x) + (y * n.y)) / nl / spacing);
      const lo = Math.floor(Math.min(...cast)) - 1;
      const hi = Math.ceil(Math.max(...cast)) + 1;
      // v3.18 The step is chosen by how far apart the lines land on the
      // glass, not by how many there are. Counting them made the stride
      // depend on how much workspace happened to be in view, so a family
      // could thin out to nothing at one zoom and be fine at the next.
      // Eight screen pixels is about where a grid stops reading as a grid.
      let stride = 1;
      while (Math.abs(spacing) * stride * zoom < 8 && stride < 4096) stride *= 2;
      for (let k = Math.ceil(lo / stride) * stride; k <= hi; k += stride) {
        const px = along.x * k;
        const py = along.y * k;
        drawLine(px - (dir.x * reach), py - (dir.y * reach),
          px + (dir.x * reach), py + (dir.y * reach), k % boldEvery === 0);
      }
    };

    // v3.17 At the home view the three families are the isometric grid you
    // draw on. Turned away from it, the uprights stop meaning "up the page"
    // and just clutter — so the grid becomes the ground alone, a floor seen
    // from where you stand, which is what a 3D view is read against.
    const turned = !!view && (Math.abs((view.yawDeg ?? 45) - 45) > 0.5
      || Math.abs((view.pitchDeg ?? 35.264) - 35.264) > 0.5);
    if (!turned) family(step.w, step.u, 10);
    family(step.u, step.v, 10);
    family(step.v, step.u, 10);

    ctx.restore();
  }, [show, zoom, offset, vpW, vpH, view]);                                       // [v1.09] Redraw on zoom/pan/show change

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",                  // [v1.0] Layer behind everything
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",                 // [v1.0] Let input pass through
        display: show ? "block" : "none",      // [v1.01] Hide canvas when toggled off
      }}
    />
  );
};

export default IsoGrid;                                            // [v1.0] Export isometric grid
