import { useEffect, useRef } from "react";
import "./Magnify.css";

export default function Magnify({ x, y }) {
  const lensRef = useRef(null);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const canvases = document.querySelectorAll("canvas");
    const [gridCanvas, drawCanvas, crosshairCanvas] = canvases;
    if (!gridCanvas || !drawCanvas) return;

    const ctx = lens.getContext("2d");
    const zoom = 2;
    const lensSize = 120;

    lens.width = lensSize;
    lens.height = lensSize;

    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.save();

    ctx.beginPath();
    ctx.arc(lensSize / 2, lensSize / 2, lensSize / 2, 0, Math.PI * 2);
    ctx.clip();

    const cx = x;
    const cy = y;
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
  }, [x, y]);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const observer = new MutationObserver(() => {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg') || 'transparent';
      lens.style.backgroundColor = bg.trim();
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={lensRef}
      className="magnifier-lens"
      style={{
        position: "absolute",
        top: `${y - 60 - 100}px`,
        left: `${x - 60 -3}px`,
        pointerEvents: "none",
        zIndex: 999,
        borderRadius: "50%"
      }}
    />
  );
}
