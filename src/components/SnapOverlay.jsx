import { useEffect, useRef, useState } from "react";

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const dx = 20;
const tan30 = Math.tan(Math.PI / 6); // ≈ 0.577

// v1.02+ add onSnapChange prop to emit current snapped point
const SnapOverlay = ({ onSnapChange }) => {
  const canvasRef = useRef(null);
  const [intersectionPoints, setIntersectionPoints] = useState([]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const points = [];
    const cols = 200; // v1.02+ overgenerate to support zoom/pan/overflow
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

    points.push({ x: centerX, y: centerY });

    setIntersectionPoints(points);
  }, []);

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

  const handleMove = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

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

    // v1.02+ emit snapped point to parent
    if (onSnapChange) {
      onSnapChange(nearest);
    }

    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;
    const size = isTouchDevice ? 12 : 6;
    ctx.beginPath();
    ctx.moveTo(nearest.x - size, nearest.y);
    ctx.lineTo(nearest.x + size, nearest.y);
    ctx.moveTo(nearest.x, nearest.y - size);
    ctx.lineTo(nearest.x, nearest.y + size);
    ctx.stroke();
    ctx.restore();
  };

  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

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
      onMouseLeave={handleMouseLeave}
      onTouchMove={(e) => {
        e.preventDefault();
        handleMove(e);
      }}
      onTouchEnd={handleMouseLeave}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: "auto",
        cursor: isTouchDevice ? "default" : "none",
        backgroundColor: "rgba(255,0,0,0.01)",
      }}
    />
  );
};

export default SnapOverlay;
