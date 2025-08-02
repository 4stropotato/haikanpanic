import React, { useEffect, useRef } from "react";

// [v1.09] Applies zoom and offset transform uniformly to match static workspace illusion
const IsoGrid = ({ show, zoom = 1, offset = { x: 0, y: 0 } }) => { // [v1.09] Accept zoom and offset props
  const canvasRef = useRef(null);                                  // [v1.0] Reference to canvas element

  useEffect(() => {
    const canvas = canvasRef.current;                              // [v1.0] Get canvas DOM element
    const ctx = canvas.getContext("2d");                           // [v1.0] Get 2D drawing context

    const spacing = 20;                                            // [v1.0] Grid spacing in pixels
    const dx = spacing;                                            // [v1.0] Horizontal step size
    const dy = spacing / 2;                                        // [v1.0] Vertical step size (isometric projection)

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = bold ? "#4cc1f7" : "#3aa0d8";              // [v1.0] Use brighter color for bold lines
      ctx.lineWidth = bold ? 1.2 : 0.4;                            // [v1.0] Bold lines are thicker
      ctx.stroke();
    };

    const drawCenterDot = () => {
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);                          // [v1.0] Draw small red dot at center
      ctx.fillStyle = "red";
      ctx.fill();
    };

    const drawIsoGrid = () => {
      const dpr = window.devicePixelRatio || 1;                    // [v1.08] Support HiDPI (Retina) screens
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;                                  // [v1.08] Set physical canvas size
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;                           // [v1.08] CSS size for layout
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                       // [v1.08] Scale for sharpness
      ctx.clearRect(0, 0, width, height);                          // [v1.0] Clear canvas for redraw

      if (!show) return;                                           // [v1.01] Skip drawing if hidden

      ctx.save();
      ctx.translate(width / 2 + offset.x, height / 2 + offset.y);  // [v1.09] Apply pan offset to grid center
      ctx.scale(zoom, zoom);                                       // [v1.09] Apply zoom scaling

      const gridSize = 5000;                                       // [v1.09] Large virtual grid bounds
      const cols = Math.ceil(gridSize / dx);
      const slope = gridSize / Math.tan(Math.PI / 6);

      for (let x = -cols * dx; x <= cols * dx; x += dx) {
        const bold = Math.round(x / dx) % 5 === 0;                 // [v1.0] Bold every 5th vertical line
        drawLine(x, -gridSize, x, gridSize, bold);
      }

      for (let i = -cols; i <= cols; i++) {
        const x = i * dx;
        const bold = i % 10 === 0;                                 // [v1.0] Bold every 10th slanted line
        drawLine(x, 0, x + slope, gridSize, bold);                // [v1.0] ↗ right-slant
        drawLine(x, 0, x - slope, gridSize, bold);                // [v1.0] ↖ left-slant
        drawLine(x, 0, x + slope, -gridSize, bold);               // [v1.0] ↘ right-slant inverted
        drawLine(x, 0, x - slope, -gridSize, bold);               // [v1.0] ↙ left-slant inverted
      }

      drawCenterDot();                                            // [v1.0] Origin marker
      ctx.restore();
    };

    drawIsoGrid();                                                // [v1.0] Initial draw
    window.addEventListener("resize", drawIsoGrid);               // [v1.0] Redraw on window resize
    return () => window.removeEventListener("resize", drawIsoGrid); // [v1.0] Cleanup listener
  }, [show, zoom, offset]);                                       // [v1.09] Redraw on zoom/pan/show change

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

export default IsoGrid;

