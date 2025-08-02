import React, { useEffect, useRef } from "react";

const IsoGrid = ({ show }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const spacing = 20;                      // v1.0 base grid spacing (px)
    const dx = spacing;                      // v1.0 horizontal spacing
    const dy = spacing / 2;                  // v1.0 vertical spacing (half for isometric effect)

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = bold ? "#4cc1f7" : "#3aa0d8"; // v1.0 use bold color for major lines
      ctx.lineWidth = bold ? 1.2 : 0.4;              // v1.0 thicker for major grid
      ctx.stroke();
    };

    const drawCenterDot = () => {
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);
      ctx.fillStyle = "red";                // v1.0 center dot color
      ctx.fill();
    };

    const drawIsoGrid = () => {
      const width = canvas.width = window.innerWidth;
      const height = canvas.height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);    // v1.0 clear before redraw
      if (!show) return;                     // v1.01 respect `show` prop toggle

      ctx.save();
      ctx.translate(width / 2, height / 2);  // v1.0 center grid

      const cols = Math.ceil(width / dx);
      const rows = Math.ceil(height / dy);

      // Vertical grid lines
      for (let x = 0; x <= width; x += dx) {
        const bold = (Math.round(x) / dx) % 5 === 0; // v1.0 every 5th vertical line bold
        drawLine(-x, 0, -x, -height, bold);
        drawLine(-x, 0, -x, height, bold);
        drawLine(x, 0, x, -height, bold);
        drawLine(x, 0, x, height, bold);
      }

      const extra = Math.ceil(width / Math.tan(Math.PI / 6)); // v1.02+ wider slope margin

      for (let i = -cols - extra; i < cols + extra; i++) {
        const x = i * dx;
        const bold = i % 10 === 0;           // v1.0 every 10th slant line bold
        const slope = height / Math.tan(Math.PI / 6); // v1.02+ reuse slope calc

        // Slanted right grid lines (↗)
        drawLine(x, 0, x + slope, height, bold);
        drawLine(x, 0, x + slope, -height, bold);

        // Slanted left grid lines (↖)
        drawLine(x, 0, x - slope, height, bold);
        drawLine(x, 0, x - slope, -height, bold);
      }

      drawCenterDot();            // v1.0 center dot (red) to mark origin
      ctx.restore();
    };

    drawIsoGrid();                // v1.0 initial grid draw
    window.addEventListener("resize", drawIsoGrid);  // v1.0 redraw on resize
    return () => window.removeEventListener("resize", drawIsoGrid); // v1.0 cleanup
  }, [show]); // v1.01+ depend on `show` to redraw when toggled

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",
        display: show ? "block" : "none" // v1.01 respect show/hide toggle
      }}
    />
  );
};

export default IsoGrid;
