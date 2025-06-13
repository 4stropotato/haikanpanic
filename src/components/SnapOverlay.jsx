import { useEffect, useRef, useState } from "react";

// [v1.02] Detect touch devices to adjust crosshair size and cursor behavior
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// [v1.01] Grid spacing and isometric math constants
const dx = 20;
const tan30 = Math.tan(Math.PI / 6); // ≈ 0.577

// [v1.01] Main snap component to display live crosshair
// [v1.02] Added onSnapChange prop to emit current snapped point
const SnapOverlay = ({ onSnapChange }) => {
  const canvasRef = useRef(null);
  const [intersectionPoints, setIntersectionPoints] = useState([]);

  // [v1.01] Precompute grid intersections on mount
  // [v1.03] Increased density and added center fallback point
  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const points = [];
    const cols = 200;
    const rows = 200;

    for (let i = -cols; i <= cols; i++) {
      const x1 = i * dx;

      for (let j = -rows; j <= rows; j++) {
        const x2 = j * dx;
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1);

        points.push({
          x: centerX + x,
          y: centerY + y
        });
      }
    }

    // [v1.03] Add center point as guaranteed fallback
    points.push({ x: centerX, y: centerY });
    setIntersectionPoints(points);
  }, []);

  // [v1.02] Normalize coordinates from both mouse and touch events
  const getCoordinates = (e) => {
    if (e.touches) {
      return {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    } else {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;
    const size = isTouchDevice ? 12 : 6;

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
      const dist = dx * dx + dy * dy;

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

    drawCrosshair(nearest);
  };

  // [v1.01] Resize canvas to full screen on mount
  // [v1.03] Add responsive listener for window resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMove}
      onTouchMove={(e) => {
        e.preventDefault();
        handleMove(e);
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: "auto",
        cursor: isTouchDevice ? "default" : "none",
        backgroundColor: "rgba(255,0,0,0.01)"
      }}
    />
  );
};

export default SnapOverlay;
