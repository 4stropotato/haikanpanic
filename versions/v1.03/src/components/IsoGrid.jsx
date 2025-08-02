import React, { useEffect, useRef } from "react";

const IsoGrid = ({ show }) => {
  const canvasRef = useRef(null); // v1.0 canvas reference for grid drawing

  useEffect(() => {
    const canvas = canvasRef.current;            // v1.0 get canvas DOM element
    const ctx = canvas.getContext("2d");          // v1.0 2D drawing context

    const spacing = 20;                           // v1.0 base grid spacing (px)
    const dx = spacing;                           // v1.0 horizontal spacing
    const dy = spacing / 2;                       // v1.0 vertical spacing (isometric)

    // v1.0 function to draw a single grid line
    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = bold ? "#4cc1f7" : "#3aa0d8"; // v1.0 bold color for major lines
      ctx.lineWidth = bold ? 1.2 : 0.4;              // v1.0 thicker for major grid
      ctx.stroke();
    };

    // v1.0 function to draw red dot at grid center
    const drawCenterDot = () => {
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    };

    // v1.0 main function to draw isometric grid
    const drawIsoGrid = () => {
      const width = canvas.width = window.innerWidth;  // v1.0 fit canvas to window
      const height = canvas.height = window.innerHeight;

      ctx.clearRect(0, 0, width, height);              // v1.0 clear canvas
      if (!show) return;                               // v1.01 respect show toggle

      ctx.save();
      ctx.translate(width / 2, height / 2);            // v1.0 center grid

      const cols = Math.ceil(width / dx);
      const rows = Math.ceil(height / dy);

      // v1.0 draw vertical grid lines
      for (let x = 0; x <= width; x += dx) {
        const bold = (Math.round(x) / dx) % 5 === 0;   // v1.0 every 5th line bold
        drawLine(-x, 0, -x, -height, bold);
        drawLine(-x, 0, -x, height, bold);
        drawLine(x, 0, x, -height, bold);
        drawLine(x, 0, x, height, bold);
      }

      const extra = Math.ceil(width / Math.tan(Math.PI / 6)); // v1.02+ extend slope margin

      // v1.0 draw slanted grid lines (↗ and ↖)
      for (let i = -cols - extra; i < cols + extra; i++) {
        const x = i * dx;
        const bold = i % 10 === 0;                       // v1.0 every 10th slant bold
        const slope = height / Math.tan(Math.PI / 6);

        // ↗ slanted lines
        drawLine(x, 0, x + slope, height, bold);
        drawLine(x, 0, x + slope, -height, bold);

        // ↖ slanted lines
        drawLine(x, 0, x - slope, height, bold);
        drawLine(x, 0, x - slope, -height, bold);
      }

      drawCenterDot();           // v1.0 draw center red dot
      ctx.restore();
    };

    drawIsoGrid();               // v1.0 draw grid on load
    window.addEventListener("resize", drawIsoGrid);  // v1.0 redraw grid on window resize
    return () => window.removeEventListener("resize", drawIsoGrid); // v1.0 cleanup listener
  }, [show]); // v1.01 re-draw grid when show prop changes

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",
        display: show ? "block" : "none" // v1.01 hide canvas when show=false
      }}
    />
  );
};

export default IsoGrid;
