import { useRef, useEffect } from "react";

// [v1.02] DrawLayer renders user-drawn lines and preview
// [v1.03] Added traditional comments, no logic changes
// [v1.04] Retained momentum, still purely comments
const DrawLayer = ({ lines, preview, isDark }) => {
  const canvasRef = useRef(null); // [v1.02] Canvas DOM reference

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = window.innerWidth;   // [v1.02] Fullscreen canvas width
    const height = window.innerHeight; // [v1.02] Fullscreen canvas height
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height); // [v1.02] Clear before redraw

    ctx.strokeStyle = isDark ? "white" : "black"; // [v1.02] Theme-aware stroke color
    ctx.lineWidth = 2;                            // [v1.02] Line thickness

    // [v1.02] Draw each confirmed line segment
    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // [v1.02] Draw current preview line (dashed) if dragging
    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6, 4]); // [v1.02] Dashed line style for preview
      ctx.stroke();
      ctx.setLineDash([]);     // [v1.02] Reset dash to solid for next lines
    }
  }, [lines, preview, isDark]); // [v1.02] Rerun when props change

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",   // [v1.02] Overlay above grid layer
        top: 0,
        left: 0,
        zIndex: 6,              // [v1.02] Ensures visibility above grid
        pointerEvents: "none",  // [v1.02] Allow clicks to pass through
      }}
    />
  );
};

export default DrawLayer;
