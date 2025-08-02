import { useEffect, useRef } from "react";
import "./Magnify.css";

// v1.08+ Magnify lens fully synced with Retina-scaled canvas layers
export default function Magnify({ x, y }) {
  const lensRef = useRef(null); // v1.07+ reference to magnifier canvas

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const canvases = Array.from(document.querySelectorAll("canvas")); // v1.07+ collect live canvases
    const gridCanvas = canvases.find(c => c.style.zIndex === "0");     // v1.08+ target grid layer
    const drawCanvas = canvases.find(c => c.style.zIndex === "6");     // v1.08+ target draw layer
    const crosshairCanvas = canvases.find(c => c.style.zIndex === "999"); // v1.08+ optional overlay layer

    if (!gridCanvas || !drawCanvas) return;

    const ctx = lens.getContext("2d");
    const zoom = 1;                       // v1.08+ 1:1 magnification
    const lensSize = 120;                // v1.08+ lens diameter

    lens.width = lensSize;
    lens.height = lensSize;

    const dpr = window.devicePixelRatio || 1; // v1.08+ support HiDPI scaling

    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.save();

    ctx.beginPath();
    ctx.arc(lensSize / 2, lensSize / 2, lensSize / 2, 0, Math.PI * 2); // v1.07+ circular clip
    ctx.clip();

    const cx = x * dpr; // v1.08+ scale input coords
    const cy = y * dpr;
    const srcSize = lensSize / zoom;
    const sx = cx - srcSize / 2;
    const sy = cy - srcSize / 2;

    const safeSx = Math.max(0, Math.min(sx, gridCanvas.width - srcSize));   // v1.07+ clamp horizontal
    const safeSy = Math.max(0, Math.min(sy, gridCanvas.height - srcSize));  // v1.07+ clamp vertical

    [gridCanvas, drawCanvas, crosshairCanvas].forEach((canvas) => {
      if (!canvas) return;
      ctx.drawImage(
        canvas,
        safeSx,
        safeSy,
        srcSize,
        srcSize,
        0,
        0,
        lensSize,
        lensSize
      ); // v1.07+ composite each canvas into lens
    });

    ctx.restore();

    // v1.08+ draw red center crosshair
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;

    const mid = lensSize / 2;
    const arm = 12; // 12px full length (6px each side)

    ctx.beginPath();
    ctx.moveTo(mid - arm, mid);
    ctx.lineTo(mid + arm, mid);
    ctx.moveTo(mid, mid - arm);
    ctx.lineTo(mid, mid + arm);
    ctx.stroke();

    ctx.restore();
  }, [x, y]); // v1.07+ redraw on position change

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const updateBackground = () => {
      const bg = getComputedStyle(document.body).getPropertyValue("--bg") || "transparent";
      lens.style.backgroundColor = bg.trim();             // v1.07+ match lens bg to theme
    };

    updateBackground();

    const observer = new MutationObserver(updateBackground);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();                   // v1.07+ cleanup observer
  }, []);

  return (
    <canvas
      ref={lensRef}
      className="magnifier-lens"
      style={{
        position: "absolute",
        top: `${y - 60 - 100}px`,                          // v1.07+ offset to float above snap
        left: `${x - 60 - 3}px`,                           // v1.07+ horizontal fine-tune
        pointerEvents: "none",                             // v1.07+ ignore pointer
        zIndex: 999,
        borderRadius: "50%"                                // v1.07+ circular canvas
      }}
    />
  );
}

