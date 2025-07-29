import React, { useEffect, useRef } from "react";

const IsoGrid = ({ show }) => {
  const canvasRef = useRef(null); // v1.0 reference to canvas element

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const spacing = 20;
    const dx = spacing;
    const dy = spacing / 2;

    const drawLine = (x1, y1, x2, y2, bold = false) => {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = bold ? "#4cc1f7" : "#3aa0d8";
      ctx.lineWidth = bold ? 1.2 : 0.4;
      ctx.stroke();
    };

    const drawCenterDot = () => {
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    };

    const drawIsoGrid = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      canvas.width = width * dpr;        // pixel-perfect resolution
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale all drawing ops
      ctx.clearRect(0, 0, width, height);

      if (!show) return;

      ctx.save();
      ctx.translate(width / 2, height / 2); // center origin

      const cols = Math.ceil(width / dx);
      const rows = Math.ceil(height / dy);

      for (let x = 0; x <= width; x += dx) {
        const bold = (Math.round(x) / dx) % 5 === 0;
        drawLine(-x, 0, -x, -height, bold);
        drawLine(-x, 0, -x, height, bold);
        drawLine(x, 0, x, -height, bold);
        drawLine(x, 0, x, height, bold);
      }

      const extra = Math.ceil(width / Math.tan(Math.PI / 6));
      for (let i = -cols - extra; i < cols + extra; i++) {
        const x = i * dx;
        const bold = i % 10 === 0;
        const slope = height / Math.tan(Math.PI / 6);

        drawLine(x, 0, x + slope, height, bold);
        drawLine(x, 0, x + slope, -height, bold);
        drawLine(x, 0, x - slope, height, bold);
        drawLine(x, 0, x - slope, -height, bold);
      }

      drawCenterDot();
      ctx.restore();
    };

    drawIsoGrid();
    window.addEventListener("resize", drawIsoGrid);
    return () => window.removeEventListener("resize", drawIsoGrid);
  }, [show]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0,
        pointerEvents: "none",
        display: show ? "block" : "none",
      }}
    />
  );
};

export default IsoGrid;
