// [v1.0] Initial isometric grid implementation
// [v1.01] Add toggle to hide/show grid
// [v1.08] HiDPI (Retina) canvas support
// [v1.09] Apply zoom and offset transform uniformly to match static workspace illusion
// [v1.10] Centralized grid math via constants, slope calculation via tan30

import { useEffect, useRef } from "react";                          // [v1.10] React hook for lifecycle
import { dx, tan30, gridSize } from "../utils/constants";          // [v1.10] Centralized grid constants
import { useViewport } from "../utils/viewport";                   // v1.18+ live workspace size

const IsoGrid = ({ show, zoom = 1, offset = { x: 0, y: 0 } }) => {  // [v1.09] Accept zoom and offset props
  const canvasRef = useRef(null);
  const { w: vpW, h: vpH } = useViewport();                          // v1.18+ re-render on resize                                  // [v1.0] Reference to canvas element

  useEffect(() => {
    const canvas = canvasRef.current;                              // [v1.0] Get canvas DOM element
    const ctx = canvas.getContext("2d");                           // [v1.0] Get 2D drawing context
    const slope = 1 / tan30;                                       // [v1.10] Use inverse tan30 for slant slope
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

    const cols = Math.ceil(gridSize / dx);                         // [v1.09] Number of visible columns

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      // v2.01 premium grid: quiet field, bold lines only gently brighter
      ctx.strokeStyle = bold ? "rgba(124,196,255,0.34)" : "rgba(124,196,255,0.13)";
      ctx.lineWidth = bold ? 1.1 : 0.5;
      ctx.stroke();
    };

    for (let x = -cols * dx; x <= cols * dx; x += dx) {
      const bold = Math.round(x / dx) % 5 === 0;                   // [v1.0] Bold every 5th vertical line
      drawLine(x, -gridSize, x, gridSize, bold);
    }

    for (let i = -cols; i <= cols; i++) {
      const x = i * dx;
      const bold = i % 10 === 0;                                   // [v1.0] Bold every 10th slanted line
      drawLine(x, 0, x + gridSize * slope, gridSize, bold);       // [v1.0] ↗ right-slant
      drawLine(x, 0, x - gridSize * slope, gridSize, bold);       // [v1.0] ↖ left-slant
      drawLine(x, 0, x + gridSize * slope, -gridSize, bold);      // [v1.0] ↘ right-slant inverted
      drawLine(x, 0, x - gridSize * slope, -gridSize, bold);      // [v1.0] ↙ left-slant inverted
    }

    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);                            // [v1.0] Draw small red dot at center
    ctx.fillStyle = "red";
    ctx.fill();
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
