import React, { useEffect, useRef } from "react";

const IsoGrid = ({ show }) => {
  const canvasRef = useRef(null); // v1.0 reference to canvas element

  useEffect(() => {
    const canvas = canvasRef.current;                      // v1.0 get canvas DOM element
    const ctx = canvas.getContext("2d");                   // v1.0 get 2D drawing context

    const spacing = 20;                                    // v1.0 grid spacing in pixels
    const dx = spacing;                                    // v1.0 horizontal step size
    const dy = spacing / 2;                                // v1.0 vertical step size (isometric projection)

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = bold ? "#4cc1f7" : "#3aa0d8";       // v1.0 use brighter color for bold lines
      ctx.lineWidth = bold ? 1.2 : 0.4;                     // v1.0 bold lines are thicker
      ctx.stroke();
    };

    const drawCenterDot = () => {
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);                   // v1.0 draw small red dot
      ctx.fillStyle = "red";
      ctx.fill();
    };

    const drawIsoGrid = () => {
      const dpr = window.devicePixelRatio || 1;            // v1.08+ support HiDPI (Retina) screens
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;                          // v1.08+ set physical canvas size
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;                   // v1.08+ scale to logical CSS size
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);              // v1.08+ scale drawing ops for sharpness
      ctx.clearRect(0, 0, width, height);                  // v1.0 clear canvas for redraw

      if (!show) return;                                   // v1.01 skip drawing if grid is hidden

      ctx.save();
      ctx.translate(width / 2, height / 2);                // v1.0 move origin to center

      const cols = Math.ceil(width / dx);
      const rows = Math.ceil(height / dy);

      for (let x = 0; x <= width; x += dx) {
        const bold = (Math.round(x) / dx) % 5 === 0;       // v1.0 bold every 5th vertical line
        drawLine(-x, 0, -x, -height, bold);
        drawLine(-x, 0, -x, height, bold);
        drawLine(x, 0, x, -height, bold);
        drawLine(x, 0, x, height, bold);
      }

      const extra = Math.ceil(width / Math.tan(Math.PI / 6)); // v1.02+ extra margin for slants
      for (let i = -cols - extra; i < cols + extra; i++) {
        const x = i * dx;
        const bold = i % 10 === 0;                         // v1.0 bold every 10th slant line
        const slope = height / Math.tan(Math.PI / 6);

        drawLine(x, 0, x + slope, height, bold);           // v1.0 ↗ right-slant
        drawLine(x, 0, x + slope, -height, bold);
        drawLine(x, 0, x - slope, height, bold);           // v1.0 ↖ left-slant
        drawLine(x, 0, x - slope, -height, bold);
      }

      drawCenterDot();                                     // v1.0 draw origin marker
      ctx.restore();
    };

    drawIsoGrid();                                         // v1.0 initial grid draw
    window.addEventListener("resize", drawIsoGrid);        // v1.0 redraw grid on window resize
    return () => window.removeEventListener("resize", drawIsoGrid); // v1.0 cleanup on unmount
  }, [show]);                                              // v1.01 redraw grid when show prop changes

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",          // v1.0 layer behind all elements
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",         // v1.0 pass through events
        display: show ? "block" : "none" // v1.01 hide/show grid with prop
      }}
    />
  );
};

export default IsoGrid;

