import { useEffect, useRef } from "react";
import "./Magnify.css";

// v1.08+ Magnify lens fully synced with Retina-scaled canvas layers
export default function Magnify({ x, y }) {
  const lensRef = useRef(null); // v1.07+ reference to magnifier canvas

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const canvases = Array.from(document.querySelectorAll("canvas"));
    const gridCanvas = canvases.find(c => c.style.zIndex === "0");
    const drawCanvas = canvases.find(c => c.style.zIndex === "6");
    const crosshairCanvas = canvases.find(c => c.style.zIndex === "999");

    if (!gridCanvas || !drawCanvas) return;

    const ctx = lens.getContext("2d");
    const zoom = 1;
    const lensSize = 120;

    lens.width = lensSize;
    lens.height = lensSize;

    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.save();

    ctx.beginPath();
    ctx.arc(lensSize / 2, lensSize / 2, lensSize / 2, 0, Math.PI * 2);
    ctx.clip();

    const cx = x * dpr;
    const cy = y * dpr;
    const srcSize = lensSize / zoom;
    const sx = cx - srcSize / 2;
    const sy = cy - srcSize / 2;

    const safeSx = Math.max(0, Math.min(sx, gridCanvas.width - srcSize));
    const safeSy = Math.max(0, Math.min(sy, gridCanvas.height - srcSize));

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
      );
    });

    ctx.restore();

    // 🔴 Draw smaller red crosshair at center (12px arms)
    ctx.save();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1.5;

    const mid = lensSize / 2;
    const arm = 12; // 6px per side = 12px total length

    ctx.beginPath();
    ctx.moveTo(mid - arm, mid);
    ctx.lineTo(mid + arm, mid);
    ctx.moveTo(mid, mid - arm);
    ctx.lineTo(mid, mid + arm);
    ctx.stroke();

    ctx.restore();

  }, [x, y]);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const updateBackground = () => {
      const bg = getComputedStyle(document.body).getPropertyValue("--bg") || "transparent";
      lens.style.backgroundColor = bg.trim();
    };

    updateBackground();

    const observer = new MutationObserver(updateBackground);
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={lensRef}
      className="magnifier-lens"
      style={{
        position: "absolute",
        top: `${y - 60 - 100}px`,
        left: `${x - 60 - 3}px`,
        pointerEvents: "none",
        zIndex: 999,
        borderRadius: "50%"
      }}
    />
  );
}
