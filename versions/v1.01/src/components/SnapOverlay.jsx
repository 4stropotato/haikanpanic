import { useEffect, useRef, useState } from "react";

const dx = 20;                                  // v1.0 grid spacing (pixels)
const tan30 = Math.tan(Math.PI / 6);            // v1.0 tan(30°) ≈ 0.577 slope

const SnapOverlay = () => {
  const canvasRef = useRef(null);               // v1.0 reference to overlay canvas
  const [intersectionPoints, setIntersectionPoints] = useState([]); // v1.0 store grid snap points

  useEffect(() => {
    const width = window.innerWidth;            // v1.0 get viewport width
    const height = window.innerHeight;          // v1.0 get viewport height
    const centerX = width / 2;                  // v1.0 center X of viewport
    const centerY = height / 2;                 // v1.0 center Y of viewport

    const points = [];
    const cols = Math.ceil(width / dx);         // v1.0 number of horizontal grid cells
    const rows = Math.ceil(height / dx);        // v1.0 number of vertical grid cells

    // v1.0 calculate all intersection points between +30° and -30° slanted lines
    for (let i = -cols; i <= cols; i++) {
      const x1 = i * dx;                        // v1.0 x-position of +30° line

      for (let j = -cols; j <= cols; j++) {
        const x2 = j * dx;                      // v1.0 x-position of -30° line

        /*
          Intersect +30° and -30° lines:
          y = tan30 * (x - x1)
          y = -tan30 * (x - x2)
          Solve for x:
            tan30 * (x - x1) = -tan30 * (x - x2)
            2*tan30*x = tan30*(x2 + x1)
            x = (x1 + x2) / 2
        */
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1);             // v1.0 plug x into +30° equation

        points.push({
          x: centerX + x,                       // v1.0 shift point to screen center
          y: centerY + y
        });
      }
    }

    points.push({ x: centerX, y: centerY });    // v1.0 explicitly add origin point
    setIntersectionPoints(points);              // v1.0 store all snap points
  }, []);

  // v1.0 draw crosshair nearest to mouse pointer
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);         // v1.0 clear previous crosshair

    const mouseX = e.clientX;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;

    let nearest = null;
    let minDist = Infinity;

    // v1.0 find nearest snap point
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

    ctx.save();
    ctx.strokeStyle = "red";                    // v1.0 crosshair color
    ctx.lineWidth = 1.5;                        // v1.0 crosshair thickness

    const size = 6;                             // v1.0 crosshair size
    ctx.beginPath();
    ctx.moveTo(nearest.x - size, nearest.y);
    ctx.lineTo(nearest.x + size, nearest.y);
    ctx.moveTo(nearest.x, nearest.y - size);
    ctx.lineTo(nearest.x, nearest.y + size);
    ctx.stroke();
    ctx.restore();
  };

  // v1.0 clear crosshair when mouse leaves canvas
  const handleMouseLeave = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;         // v1.0 match canvas width to window
      canvas.height = window.innerHeight;       // v1.0 match canvas height to window
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas); // v1.0 adjust on window resize
    return () => window.removeEventListener("resize", resizeCanvas); // v1.0 cleanup listener
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}              // v1.0 track mouse movement
      onMouseLeave={handleMouseLeave}            // v1.0 clear when mouse leaves
      style={{
        position: "absolute",                    // v1.0 overlay positioning
        top: 0,
        left: 0,
        zIndex: 9999,                            // v1.0 overlay above all
        pointerEvents: "auto",                   // v1.0 allow pointer events
        cursor: "none",                          // v1.0 hide system cursor
        backgroundColor: "rgba(255,0,0,0.01)",   // v1.0 transparent background
      }}
    />
  );
};

export default SnapOverlay;
