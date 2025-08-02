import { useRef, useEffect } from "react";

// [v1.02] DrawLayer renders user-drawn lines and preview
// [v1.03] Added traditional versioned comments, no logic changes
// [v1.04] Continued documentation updates, no functional changes
// [v1.05] Verified consistency for magnifier integration, no logic changes
const DrawLayer = ({ lines, preview, isDark }) => {
  const canvasRef = useRef(null); // [v1.02] Canvas DOM reference

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = window.innerWidth;   // [v1.02] Fullscreen canvas width
    const height = window.innerHeight; // [v1.02] Fullscreen canvas height
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height); // [v1.02] Clear entire canvas before redraw

    ctx.strokeStyle = isDark ? "white" : "black"; // [v1.02] Set stroke color based on theme
    ctx.lineWidth = 2;                            // [v1.02] Set default line thickness

    // [v1.02] Draw all confirmed line segments
    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // [v1.02] Draw current preview line as dashed if dragging
    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6, 4]); // [v1.02] Apply dashed style for preview line
      ctx.stroke();
      ctx.setLineDash([]);     // [v1.02] Reset dash to solid for future lines
    }
  }, [lines, preview, isDark]); // [v1.02] Redraw on lines, preview, or theme change

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",   // [v1.02] Position layer above grid
        top: 0,
        left: 0,
        zIndex: 6,              // [v1.02] Ensure visibility above grid and below overlays
        pointerEvents: "none",  // [v1.02] Allow pointer events to pass through
      }}
    />
  );
};

export default DrawLayer;
