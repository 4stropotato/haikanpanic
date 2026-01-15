// [v1.01] Grid snapping and crosshair overlay
// [v1.02] Pointer normalization and parent callback
// [v1.03] Responsive canvas and fallback point
// [v1.08] Retina-aware canvas and scaled rendering
// [v1.09] Verified alignment with static workspace illusion
// [v1.10] Unified zoom snapping logic via utility, simplified dynamic transform

import { useEffect, useRef } from "react";                         // [v1.01] React hook for canvas rendering
import { snapToNearestGrid } from "../utils/geometry";             // [v1.10] Centralized snapping logic

const SnapOverlay = ({ onSnapChange, zoom, offset }) => {
  const canvasRef = useRef(null);                                  // [v1.01] Canvas DOM reference

  const getCoordinates = (e) => {                                  // [v1.02] Normalize mouse/touch input
    if (e.touches) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  };

  const drawCrosshair = (pt) => {                                  // [v1.01] Render red crosshair
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 10;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                         // [v1.08] Retina-aware rendering
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(pt.x - size, pt.y);
    ctx.lineTo(pt.x + size, pt.y);
    ctx.moveTo(pt.x, pt.y - size);
    ctx.lineTo(pt.x, pt.y + size);
    ctx.stroke();
    ctx.restore();
  };

  const handleMove = (e) => {                                       // [v1.01] Track pointer move
    const canvas = canvasRef.current;
    if (!canvas) return;

    const raw = getCoordinates(e);
    const rect = canvas.getBoundingClientRect();                   // [v1.10] Adjust for canvas offset
    raw.x -= rect.left;
    raw.y -= rect.top;

    const snapped = snapToNearestGrid(raw, zoom, offset);          // [v1.10] Snap to grid using utility
    if (!snapped) return;

    const centerX = window.innerWidth / 2 + offset.x;
    const centerY = window.innerHeight / 2 + offset.y;
    const screenX = centerX + snapped.x * zoom;                    // [v1.10] Convert to screen coordinates
    const screenY = centerY + snapped.y * zoom;

    onSnapChange?.({ x: screenX, y: screenY });                    // [v1.02] Notify parent
    drawCrosshair({ x: screenX, y: screenY });                     // [v1.01] Draw visual indicator
  };

  useEffect(() => {                                                // [v1.03] Initialize canvas size
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;                                    // [v1.08] Physical resolution
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;                             // [v1.08] Logical screen size
    canvas.style.height = `${height}px`;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMove}                                     // [v1.01] Track mouse
      onTouchMove={(e) => {
        e.preventDefault();                                        // [v1.02] Prevent default scrolling
        handleMove(e);                                             // [v1.02] Track touch
      }}
      style={{
        position: "absolute",                                      // [v1.01] Overlay canvas
        top: 0,
        left: 0,
        zIndex: 9999,                                              // [v1.01] Highest priority
        pointerEvents: "auto",                                     // [v1.01] Enable pointer detection
        cursor: "none",                                            // [v1.02] Hide cursor
        backgroundColor: "rgba(255,0,0,0.01)",                     // [v1.01] Transparent overlay
      }}
    />
  );
};

export default SnapOverlay;                                       // [v1.01] Export crosshair overlay
