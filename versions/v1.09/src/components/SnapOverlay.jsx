import { useEffect, useRef, useState } from "react";

// [v1.02] Detect touch devices for crosshair size & cursor adjustments
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// [v1.01] Grid spacing and isometric math constants
const dx = 20;                                   // v1.01 grid spacing (px)
const tan30 = Math.tan(Math.PI / 6);             // v1.01 tan(30°) slope ≈ 0.577

// [v1.01] SnapOverlay component shows live snapping crosshair
// [v1.02] Added onSnapChange prop for parent callback
// [v1.08] Retina-scaled canvas for sharp crosshair rendering
const SnapOverlay = ({ onSnapChange }) => {
  const canvasRef = useRef(null);                // v1.01 canvas reference
  const [intersectionPoints, setIntersectionPoints] = useState([]); // v1.01 store precomputed points

  // [v1.01] Precompute grid intersections
  // [v1.03] Increased density & added center fallback point
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const points = [];
    for (let i = -200; i <= 200; i++) {
      const x1 = i * dx;
      for (let j = -200; j <= 200; j++) {
        const x2 = j * dx;
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1);
        points.push({ x: centerX + x, y: centerY + y });
      }
    }

    points.push({ x: centerX, y: centerY });      // v1.03 add center fallback point
    setIntersectionPoints(points);                // v1.01 save points to state
  }, []);

  // [v1.02] Normalize pointer coordinates for mouse/touch events
  const getCoordinates = (e) => {
    if (e.touches) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  };

  // [v1.02] Draw crosshair at nearest snapped point
  // [v1.04] Adjusted size for touch devices
  // [v1.08] Apply HiDPI scaling
  const drawCrosshair = (pt) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = isTouchDevice ? 12 : 6;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);                        // v1.08+ scale coordinates
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr); // v1.08+ clear logical space
    ctx.strokeStyle = "red";                                      // v1.01 crosshair color
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(pt.x - size, pt.y);
    ctx.lineTo(pt.x + size, pt.y);
    ctx.moveTo(pt.x, pt.y - size);
    ctx.lineTo(pt.x, pt.y + size);
    ctx.stroke();
    ctx.restore();
  };

  // [v1.01] Locate nearest grid point from pointer location
  // [v1.02] Pass snapped point to parent callback
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
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = pt;
      }
    }

    if (!nearest) return;

    onSnapChange?.(nearest);           // v1.02 notify parent
    drawCrosshair(nearest);            // v1.01 draw red crosshair
  };

  // [v1.01] Resize canvas to full screen on mount
  // [v1.03] Add resize listener for responsiveness
  // [v1.08] Retina-aware canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;                          // v1.08+ physical pixels
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;                   // v1.08+ logical size
      canvas.style.height = `${height}px`;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);       // v1.03 add resize listener
    return () => window.removeEventListener("resize", resizeCanvas); // v1.03 cleanup
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMove}                     // v1.01 track mouse movement
      onTouchMove={(e) => {
        e.preventDefault();
        handleMove(e);                             // v1.02 track touch movement
      }}
      style={{
        position: "absolute",                      // v1.01 overlay styling
        top: 0,
        left: 0,
        zIndex: 9999,                              // v1.01 render on top
        pointerEvents: "auto",                     // v1.01 allow interactions
        cursor: isTouchDevice ? "default" : "none",// v1.02 hide cursor for mouse
        backgroundColor: "rgba(255,0,0,0.01)"      // v1.01 transparent overlay
      }}
    />
  );
};

export default SnapOverlay;

