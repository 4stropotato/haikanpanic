import { useRef, useEffect } from "react";

// [v1.02] DrawLayer component renders confirmed lines & preview line
// [v1.03] No logic changes, added traditional comments for clarity
const DrawLayer = ({ lines, preview, isDark }) => {
  const canvasRef = useRef(null); // [v1.02] Reference to the canvas element

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = window.innerWidth;   // [v1.02] Canvas matches window width
    const height = window.innerHeight; // [v1.02] Canvas matches window height
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height); // [v1.02] Clear canvas on every render

    ctx.strokeStyle = isDark ? "white" : "black"; // [v1.02] Line color depends on theme
    ctx.lineWidth = 2;                            // [v1.02] Standard line thickness

    // [v1.02] Draw all confirmed lines from the lines array
    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // [v1.02] Draw preview line if dragging (dashed)
    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6, 4]); // [v1.02] Dashed line for live preview
      ctx.stroke();
      ctx.setLineDash([]);     // [v1.02] Reset dash to solid for next draw
    }
  }, [lines, preview, isDark]); // [v1.02] Redraw when lines, preview, or theme changes

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",   // [v1.02] Overlay the drawing on screen
        top: 0,
        left: 0,
        zIndex: 6,              // [v1.02] Higher z-index than grid
        pointerEvents: "none",  // [v1.02] Allow mouse events to pass through
      }}
    />
  );
};

export default DrawLayer;
