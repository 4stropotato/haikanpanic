import { useEffect, useRef, useState } from "react";

const dx = 20;
const tan30 = Math.tan(Math.PI / 6); // ≈ 0.577

const SnapOverlay = () => {
  const canvasRef = useRef(null);
  const [intersectionPoints, setIntersectionPoints] = useState([]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const points = [];
    const cols = Math.ceil(width / dx);
    const rows = Math.ceil(height / dx);

    // Loop through every pair of slanted lines
    for (let i = -cols; i <= cols; i++) {
      const x1 = i * dx;

      for (let j = -cols; j <= cols; j++) {
        const x2 = j * dx;

        // Intersect +30° and -30° lines
        // y = tan30 * (x - x1)
        // y = -tan30 * (x - x2)

        // Solve for x:
        // tan30 * (x - x1) = -tan30 * (x - x2)
        // tan30*x - tan30*x1 = -tan30*x + tan30*x2
        // 2*tan30*x = tan30*(x2 + x1)
        // x = (x1 + x2) / 2
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1); // Plug into +30° line

        points.push({
          x: centerX + x,
          y: centerY + y
        });
      }
    }

    // Always include the center (0,0) explicitly
    points.push({ x: centerX, y: centerY });

    setIntersectionPoints(points);
  }, []);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const mouseX = e.clientX;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;

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

    // Draw red crosshair
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;

    const size = 6;
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
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: "auto",
        cursor: "none",
        backgroundColor: "rgba(255,0,0,0.01)",
      }}
    />
  );
};

export default SnapOverlay;
