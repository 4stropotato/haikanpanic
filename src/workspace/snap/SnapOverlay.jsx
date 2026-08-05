// [v1.01] Grid snapping and crosshair overlay
// [v1.02] Pointer normalization and parent callback
// [v1.03] Responsive canvas and fallback point
// [v1.08] Retina-aware canvas and scaled rendering
// [v1.09] Verified alignment with static workspace illusion
// [v1.10] Unified zoom snapping logic via utility, simplified dynamic transform
// [v1.15] Endpoint snapping with green elbow indicator

import { useEffect, useRef } from "react";                         // [v1.01] React hook for canvas rendering
import { snapToNearestGrid, findNearestEndpoint } from "../utils/geometry"; // v1.15+ endpoint snap

const SnapOverlay = ({ onSnapChange, onEndpointSnap, zoom, offset, lines }) => {
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

  // v1.15+ Draw green elbow indicator (C-shape with dot) based on pipe direction
  const drawElbow = (pt, angle) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const armLen = 12;                                              // v1.15+ elbow arm length
    const radius = 5;                                               // v1.15+ curve radius

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    ctx.strokeStyle = "#22c55e";                                    // v1.15+ green color
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // v1.15+ Snap incoming angle to nearest isometric direction
    const isoAngles = [Math.PI/2, -Math.PI/2, Math.PI/6, -Math.PI/6, 5*Math.PI/6, -5*Math.PI/6];
    let snappedAngle = isoAngles[0];
    let minDiff = Math.abs(angle - isoAngles[0]);
    for (const iso of isoAngles) {
      const diff = Math.abs(angle - iso);
      if (diff < minDiff) { minDiff = diff; snappedAngle = iso; }
    }

    // v1.15+ Calculate the two arms of the L-elbow
    // Incoming arm (from existing pipe) and outgoing arm (rotated 60 or 120 deg)
    const inAngle = snappedAngle + Math.PI;                         // v1.15+ flip to show incoming direction
    let outAngle;                                                   // v1.15+ perpendicular isometric direction

    // v1.15+ Choose perpendicular direction based on incoming angle
    if (Math.abs(snappedAngle) === Math.PI/2) {                     // vertical pipe
      outAngle = Math.PI/6;                                         // v1.15+ go to 30 deg
    } else if (Math.abs(snappedAngle - Math.PI/6) < 0.1 || Math.abs(snappedAngle + Math.PI/6) < 0.1) {
      outAngle = Math.PI/2;                                         // v1.15+ go vertical
    } else {
      outAngle = -Math.PI/6;                                        // v1.15+ go to -30 deg
    }

    // v1.15+ Draw L-shape elbow with curved corner
    ctx.beginPath();

    // v1.15+ First arm (incoming direction)
    const arm1EndX = pt.x + (armLen - radius) * Math.cos(inAngle);
    const arm1EndY = pt.y - (armLen - radius) * Math.sin(inAngle);
    ctx.moveTo(pt.x + armLen * Math.cos(inAngle), pt.y - armLen * Math.sin(inAngle));
    ctx.lineTo(arm1EndX, arm1EndY);

    // v1.15+ Curved corner (C-shape bend)
    const cornerX = pt.x + radius * Math.cos(inAngle);
    const cornerY = pt.y - radius * Math.sin(inAngle);
    ctx.quadraticCurveTo(pt.x, pt.y, pt.x + radius * Math.cos(outAngle), pt.y - radius * Math.sin(outAngle));

    // v1.15+ Second arm (outgoing direction)
    ctx.lineTo(pt.x + armLen * Math.cos(outAngle), pt.y - armLen * Math.sin(outAngle));
    ctx.stroke();

    // v1.15+ Center connection dot
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const handleMove = (e) => {                                       // [v1.01] Track pointer move
    const canvas = canvasRef.current;
    if (!canvas) return;

    const raw = getCoordinates(e);
    const rect = canvas.getBoundingClientRect();                   // [v1.10] Adjust for canvas offset
    raw.x -= rect.left;
    raw.y -= rect.top;

    // v1.15+ Check endpoint snap first
    const endpoint = findNearestEndpoint(raw, lines || [], zoom, offset);
    if (endpoint) {
      onSnapChange?.({ x: endpoint.x, y: endpoint.y });
      onEndpointSnap?.(endpoint.workspacePoint);                   // v1.15+ notify parent of endpoint snap
      drawElbow({ x: endpoint.x, y: endpoint.y }, endpoint.angle); // v1.15+ draw elbow based on pipe direction
      return;
    }

    // v1.15+ Fall back to grid snap
    onEndpointSnap?.(null);                                        // v1.15+ clear endpoint snap
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
