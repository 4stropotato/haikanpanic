import { useRef, useEffect } from "react";

// [v1.02] DrawLayer renders user-drawn lines and preview
// [v1.03] Added traditional versioned comments, no logic changes
// [v1.04] Continued documentation updates, no functional changes
// [v1.05] Verified consistency for magnifier integration, no logic changes
// [v1.08] Retina-scale canvas for ultra-sharp 2px lines at all zoom levels
const DrawLayer = ({ lines, preview, isDark }) => {
  const canvasRef = useRef(null); // [v1.02] Canvas DOM reference

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1; // [v1.08] Retina awareness

    // [v1.08] Set physical resolution for sharpness
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // [v1.08] Scale for crisp vector-quality lines
    ctx.clearRect(0, 0, width, height);     // [v1.02] Clear logical dimensions

    ctx.strokeStyle = isDark ? "white" : "black"; // [v1.02] Theme
    ctx.lineWidth = 2;                            // [v1.02] Consistent visual thickness
    ctx.lineCap = "round";                        // [v1.08] Smooth end caps
    ctx.lineJoin = "round";                       // [v1.08] Smooth line joins

    // [v1.02] Draw all confirmed lines
    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y); // [v1.08] No offset needed with transform
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // [v1.02] Draw dashed preview line
    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [lines, preview, isDark]); // [v1.02] Redraw on updates

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",   // [v1.02] Stacks above grid
        top: 0,
        left: 0,
        zIndex: 6,
        pointerEvents: "none",  // [v1.02] Ignore mouse/touch
      }}
    />
  );
};

export default DrawLayer;
