import { useRef, useEffect } from "react";

const DrawLayer = ({ lines, preview, isDark }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = isDark ? "white" : "black";
    ctx.lineWidth = 2;

    // ✅ Draw confirmed lines
    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // ✅ Draw preview (while dragging)
    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6, 4]); // dashed preview
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [lines, preview, isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 6,
        pointerEvents: "none",
      }}
    />
  );
};

export default DrawLayer;
