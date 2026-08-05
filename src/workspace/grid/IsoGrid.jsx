// [v1.0] Initial isometric grid implementation
// [v1.01] Add toggle to hide/show grid
// [v1.08] HiDPI (Retina) canvas support
// [v1.09] Apply zoom and offset transform uniformly to match static workspace illusion
// [v1.10] Centralized grid math via constants, slope calculation via tan30

import { useEffect, useRef } from "react";                          // [v1.10] React hook for lifecycle
import { dx, tan30 } from "../utils/constants";          // [v1.10] Centralized grid constants
import { useViewport } from "../utils/viewport";                   // v1.18+ live workspace size

const IsoGrid = ({ show, zoom = 1, offset = { x: 0, y: 0 } }) => {  // [v1.09] Accept zoom and offset props
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

    for (let i = Math.floor(xa / dx) - 1; i <= Math.ceil(xb / dx) + 1; i += 1) {
      drawLine(i * dx, ya, i * dx, yb, i % 5 === 0);
    }

    // slanted families: y = ±tan30 * (x - i*dx); param t = x ∓ y/tan30
    for (const sign of [1, -1]) {
      const t1 = xa - (sign * ya) / tan30;
      const t2 = xa - (sign * yb) / tan30;
      const t3 = xb - (sign * ya) / tan30;
      const t4 = xb - (sign * yb) / tan30;
      const tMin = Math.min(t1, t2, t3, t4);
      const tMax = Math.max(t1, t2, t3, t4);
      for (let i = Math.floor(tMin / dx) - 1; i <= Math.ceil(tMax / dx) + 1; i += 1) {
        const xAtYa = (i * dx) + ((sign * ya) / tan30);
        const xAtYb = (i * dx) + ((sign * yb) / tan30);
        drawLine(xAtYa, ya, xAtYb, yb, i % 10 === 0);
      }
    }

    ctx.restore();
  }, [show, zoom, offset, vpW, vpH]);                                       // [v1.09] Redraw on zoom/pan/show change

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
