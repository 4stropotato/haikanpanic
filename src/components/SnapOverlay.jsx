import { useEffect, useRef, useState } from "react";

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const dx = 20;
const tan30 = Math.tan(Math.PI / 6);

const SnapOverlay = ({ onSnapChange }) => {
  const canvasRef = useRef(null);
  const [intersectionPoints, setIntersectionPoints] = useState([]);

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

    points.push({ x: centerX, y: centerY });
    setIntersectionPoints(points);
  }, []);

  const getCoordinates = (e) => {
    if (e.touches) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  };

  const drawCrosshair = (pt) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = isTouchDevice ? 12 : 6;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 🔧 apply scaling
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

    onSnapChange?.(nearest);
    drawCrosshair(nearest);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
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
