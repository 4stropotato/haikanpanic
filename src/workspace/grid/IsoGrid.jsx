// [v1.0] Initial isometric grid implementation
// [v1.01] Add toggle to hide/show grid
// [v1.08] HiDPI (Retina) canvas support
// [v1.09] Apply zoom and offset transform uniformly to match static workspace illusion
// [v1.10] Centralized grid math via constants, slope calculation via tan30

import { useEffect, useRef } from "react";                          // [v1.10] React hook for lifecycle
import { dx, pointStep } from "../utils/constants";      // [v1.10] Centralized grid constants
import { planeAxes, isoCoords } from "../utils/glPlane"; // v3.15 the grid follows the view
import { useViewport } from "../utils/viewport";                   // v1.18+ live workspace size

const IsoGrid = ({ show, zoom = 1, offset = { x: 0, y: 0 }, view = null, bounds = null }) => {  // [v1.09] Accept zoom and offset props
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

    const drawLine = (x1, y1, x2, y2, bold = false, dim = 1) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      // v2.01 premium grid: quiet field, bold lines only gently brighter
      ctx.strokeStyle = bold
        ? `rgba(124,196,255,${0.34 * dim})`
        : `rgba(124,196,255,${0.13 * dim})`;
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

    const family = (dir, along, boldEvery, dim = 1) => {
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
          px + (dir.x * reach), py + (dir.y * reach), k % boldEvery === 0, dim);
      }
    };

    // v3.17 At the home view the three families are the isometric grid you
    // draw on. Turned away from it, the uprights stop meaning "up the page"
    // and just clutter — so the grid becomes the ground alone, a floor seen
    // from where you stand, which is what a 3D view is read against.
    const turned = !!view && (Math.abs((view.yawDeg ?? 45) - 45) > 0.5
      || Math.abs((view.pitchDeg ?? 35.264) - 35.264) > 0.5);
    // v3.19 Three families are a lattice, and a lattice is what reads as
    // depth. Dropping the uprights when the view turned left a single flat
    // sheet — correct as a floor, but flat, and a turned view is exactly
    // where the third direction is worth seeing. They come back quietened
    // instead, so the ground still leads and the space around it is there.
    if (!turned) {
      // the drawing surface: the isometric grid, edge to edge
      family(step.u, step.v, 10);
      family(step.v, step.u, 10);
      family(step.w, step.u, 10);
    } else {
      // v3.20 A corner of the world, not a field of lines. Six families of
      // infinite lines is what a true 3D lattice needs, and it is unreadable;
      // one plane is readable and says nothing about the third direction.
      // Three bounded planes meeting at the origin say all of XYZ and stay
      // quiet, which is how a CAD viewport does it. The box is sized to the
      // view so it neither disappears nor swamps the drawing.
      // v3.22 The box belongs where the work is. Built at the origin it sat
      // off in a corner of the sheet with the drawing somewhere else — a
      // reference to nothing. It is centred on the drawing's own extent and
      // sized to cover it, so the ground lies under the pipes and the
      // uprights stand behind them.
      const mid = bounds
        ? { x: (bounds.x1 + bounds.x2) / 2, y: (bounds.y1 + bounds.y2) / 2 }
        : { x: 0, y: 0 };
      // v3.27 How far the box has to reach is measured, not guessed. The
      // old estimate was a fraction of the screen-space width, which says
      // nothing about how far the work runs along the box's own diagonal
      // axes — so a wall could finish past the last grid line. Each corner
      // of the work is decomposed into those axes and the largest wins.
      const n = 14;
      let need = 8;
      if (bounds) {
        const corners = [[bounds.x1, bounds.y1], [bounds.x2, bounds.y1],
          [bounds.x1, bounds.y2], [bounds.x2, bounds.y2]];
        for (const [x, y] of corners) {
          const ab = isoCoords({ x, y }, mid.x, mid.y, { u: step.u, v: step.v });
          need = Math.max(need, Math.abs(ab.a), Math.abs(ab.b));
        }
        // the uprights have to clear the tallest thing on the sheet too
        need = Math.max(need, Math.abs(bounds.y2 - bounds.y1) / pointStep / 2);
      }
      let cell = pointStep;
      while ((cell / pointStep) * n < need) cell *= 2;
      const at = (a, b, c) => ({
        x: mid.x + ((step.u.x * a) + (step.v.x * b) + (step.w.x * c)) * (cell / pointStep),
        y: mid.y + ((step.u.y * a) + (step.v.y * b) + (step.w.y * c)) * (cell / pointStep),
      });
      const seg = (p1, p2, bold, dim) => drawLine(p1.x, p1.y, p2.x, p2.y, bold, dim);
      const strong = (i) => i % 5 === 0;
      // v3.29 A full box, with the near faces left out. The work sits inside
      // it and you look in: the three faces between you and the drawing would
      // only be a screen over it, so they are dropped. Which three depends on
      // where you stand, so each face is tested against the view direction —
      // the ones whose outward normal points away from you are the ones you
      // keep. Turn the model and the box opens on the other side by itself.
      const yaw = ((view?.yawDeg ?? 45) * Math.PI) / 180;
      const pitch = ((view?.pitchDeg ?? 35.264) * Math.PI) / 180;
      const away = { x: Math.sin(yaw) * Math.cos(pitch),
        y: -Math.sin(pitch),
        z: -Math.cos(yaw) * Math.cos(pitch) };
      const facing = (nx, ny, nz) => ((nx * away.x) + (ny * away.y) + (nz * away.z)) > 0;
      const h = n;

      // the two ground-parallel faces
      for (const [c, ny] of [[0, -1], [-h, 1]]) {
        if (!facing(0, ny, 0)) continue;
        for (let i = -h; i <= h; i += 1) {
          seg(at(i, -h, c), at(i, h, c), strong(i), c === 0 ? 1 : 0.5);
          seg(at(-h, i, c), at(h, i, c), strong(i), c === 0 ? 1 : 0.5);
        }
      }
      // the four uprights
      for (const [b, nz] of [[-h, -1], [h, 1]]) {
        if (!facing(0, 0, nz)) continue;
        for (let i = -h; i <= h; i += 1) seg(at(i, b, 0), at(i, b, -h), strong(i), 0.45);
        for (let c = 0; c <= h; c += 1) seg(at(-h, b, -c), at(h, b, -c), strong(c), 0.45);
      }
      for (const [a, nx] of [[-h, -1], [h, 1]]) {
        if (!facing(nx, 0, 0)) continue;
        for (let i = -h; i <= h; i += 1) seg(at(a, i, 0), at(a, i, -h), strong(i), 0.45);
        for (let c = 0; c <= h; c += 1) seg(at(a, -h, -c), at(a, h, -c), strong(c), 0.45);
      }
    }

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
