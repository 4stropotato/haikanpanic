// [v1.02] DrawLayer renders user-drawn lines and preview
// [v1.03] Added traditional versioned comments, no logic changes
// [v1.04] Continued documentation updates, no functional changes
// [v1.05] Verified consistency for magnifier integration, no logic changes
// [v1.08] Retina-scale canvas for ultra-sharp 2px lines at all zoom levels
// [v1.10] Apply zoom + offset transform to sync with workspace grid and assume workspace-space coordinates

import { useEffect, useRef } from "react";                      // v1.10+ React hook for canvas updates

const DrawLayer = ({ lines, preview, isDark, zoom, offset }) => { // [v1.09] Accept zoom and offset for scaling
  const canvasRef = useRef(null);                                 // [v1.02] Canvas DOM reference

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const width = window.innerWidth;                              // [v1.02] Fullscreen canvas width
    const height = window.innerHeight;                            // [v1.02] Fullscreen canvas height
    const dpr = window.devicePixelRatio || 1;                     // [v1.08] Retina awareness

    canvas.width = width * dpr;                                   // [v1.08] Set physical resolution
    canvas.height = height * dpr;                                 // [v1.08] Set physical resolution
    canvas.style.width = `${width}px`;                            // [v1.08] CSS pixel size
    canvas.style.height = `${height}px`;                          // [v1.08] CSS pixel size

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                        // [v1.08] Scale for crisp lines
    ctx.clearRect(0, 0, width, height);                           // [v1.02] Clear canvas before redraw

    if (!ctx) return;

    ctx.save();                                                   // [v1.10] Begin transform block
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);   // [v1.10] Center and apply pan
    ctx.scale(zoom, zoom);                                        // [v1.10] Apply zoom

    ctx.strokeStyle = isDark ? "white" : "black";                 // [v1.02] Stroke color based on theme
    ctx.lineWidth = 2 / zoom;                                     // [v1.10] Adjusted for consistent visual thickness
    ctx.lineCap = "round";                                        // [v1.08] Smooth end caps
    ctx.lineJoin = "round";                                       // [v1.08] Smooth joins

    for (const { start, end } of lines) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);                               // [v1.09] Use workspace-space coordinates directly
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (preview) {
      ctx.beginPath();
      ctx.moveTo(preview.start.x, preview.start.y);               // [v1.09] Preview in workspace coordinates
      ctx.lineTo(preview.end.x, preview.end.y);
      ctx.setLineDash([6 / zoom, 4 / zoom]);                      // [v1.10] Dash length adjusts with zoom
      ctx.stroke();
      ctx.setLineDash([]);                                        // [v1.02] Reset to solid line
    }

    ctx.restore();                                                // [v1.10] End transform block
  }, [lines, preview, isDark, zoom, offset]);                     // [v1.10] Redraw on zoom or pan

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",     // [v1.02] Layer positioned over grid
        top: 0,
        left: 0,
        zIndex: 6,                // [v1.02] Above grid, below overlays
        pointerEvents: "none",    // [v1.02] Let input pass through
      }}
    />
  );
};

export default DrawLayer;                                         // [v1.02] Export draw component
