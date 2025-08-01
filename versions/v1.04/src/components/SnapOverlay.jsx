import { useEffect, useRef, useState } from "react";

// [v1.02] Detect touch devices to adjust crosshair size and cursor behavior
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// [v1.01] Grid spacing and isometric math constants
const dx = 20;                                   // v1.01 grid spacing (px)
const tan30 = Math.tan(Math.PI / 6);             // v1.01 tan(30°) slope ≈ 0.577

// [v1.01] Main snap component to display live crosshair
// [v1.02] Added onSnapChange prop to emit current snapped point
const SnapOverlay = ({ onSnapChange }) => {
  const canvasRef = useRef(null);                // v1.01 canvas reference
  const [intersectionPoints, setIntersectionPoints] = useState([]); // v1.01 precomputed points

  // [v1.01] Precompute grid intersections on mount
  // [v1.03] Increased density and added center fallback point
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;                   // v1.01 viewport center X
    const centerY = height / 2;                  // v1.01 viewport center Y

    const points = [];
    const cols = 200;                            // v1.03 larger grid for zoom/pan
    const rows = 200;

    for (let i = -cols; i <= cols; i++) {
      const x1 = i * dx;

      for (let j = -rows; j <= rows; j++) {
        const x2 = j * dx;
        const x = (x1 + x2) / 2;                  // v1.01 intersection X
        const y = tan30 * (x - x1);               // v1.01 intersection Y

        points.push({
          x: centerX + x,                         // v1.01 shift relative to center
          y: centerY + y
        });
      }
    }

    // [v1.03] Add center point as guaranteed fallback
    points.push({ x: centerX, y: centerY });
    setIntersectionPoints(points);               // v1.01 store in state
  }, []);

  // [v1.02] Normalize coordinates from both mouse and touch events
  const getCoordinates = (e) => {
    if (e.touches) {                             // v1.02 handle touch devices
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else {                                     // v1.01 handle mouse
      return {
        x: e.clientX,
        y: e.clientY
      };
    }
  };

  // [v1.02] Draw crosshair at snapped position
  // [v1.04] Increased size for touch devices
  const drawCrosshair = (pt) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // v1.01 clear previous

    ctx.save();
    ctx.strokeStyle = "red";                      // v1.01 crosshair color
    ctx.lineWidth = 1.5;                           // v1.01 crosshair thickness
    const size = isTouchDevice ? 12 : 6;           // v1.04 larger size on touch

    ctx.beginPath();
    ctx.moveTo(pt.x - size, pt.y);
    ctx.lineTo(pt.x + size, pt.y);
    ctx.moveTo(pt.x, pt.y - size);
    ctx.lineTo(pt.x, pt.y + size);
    ctx.stroke();
    ctx.restore();
  };

  // [v1.01] Compute nearest grid point from pointer location
  // [v1.02] Pass snapped point back to parent via onSnapChange
  const handleMove = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    const mouseX = x;
    const mouseY = y - canvas.getBoundingClientRect().top;

    let nearest = null;
    let minDist = Infinity;

    for (const pt of intersectionPoints) {
      const dx = pt.x - mouseX;
      const dy = pt.y - mouseY;
      const dist = dx * dx + dy * dy;             // v1.01 squared distance
      if (dist < minDist) {
        minDist = dist;
        nearest = pt;
      }
    }

    if (!nearest) return;

    // [v1.02] Emit snapped point to App
    if (onSnapChange) {
      onSnapChange(nearest);
    }

    drawCrosshair(nearest);                       // v1.01 draw red crosshair
  };

  // [v1.01] Resize canvas to full screen on mount
  // [v1.03] Add responsive listener for window resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;           // v1.01 set canvas width
      canvas.height = window.innerHeight;         // v1.01 set canvas height
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas); // v1.03 respond to resize
    return () => window.removeEventListener("resize", resizeCanvas); // v1.03 cleanup
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMove}                     // v1.01 mouse move tracking
      onTouchMove={(e) => {                        // v1.02 support touch move
        e.preventDefault();
        handleMove(e);
      }}
      style={{
        position: "absolute",                      // v1.01 overlay styling
        top: 0,
        left: 0,
        zIndex: 9999,                              // v1.01 top layer
        pointerEvents: "auto",                     // v1.01 allow pointer interaction
        cursor: isTouchDevice ? "default" : "none",// v1.02 hide cursor except touch
        backgroundColor: "rgba(255,0,0,0.01)"      // v1.01 transparent touch layer
      }}
    />
  );
};

export default SnapOverlay;
