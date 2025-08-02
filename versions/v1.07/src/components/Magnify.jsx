import { useEffect, useRef } from "react";
import "./Magnify.css";

// v1.07+ Magnify lens uses real-time compositing from live canvases
export default function Magnify({ x, y }) {
  const lensRef = useRef(null); // v1.07+ reference to magnifier canvas

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const canvases = document.querySelectorAll("canvas"); // v1.07+ collect live canvases
    const [gridCanvas, drawCanvas, crosshairCanvas] = canvases;
    if (!gridCanvas || !drawCanvas) return;

    const ctx = lens.getContext("2d");
    const zoom = 2;                   // v1.07+ zoom factor
    const lensSize = 120;            // v1.07+ diameter of lens in pixels

    lens.width = lensSize;
    lens.height = lensSize;

    ctx.clearRect(0, 0, lensSize, lensSize);
    ctx.save();

    ctx.beginPath();
    ctx.arc(lensSize / 2, lensSize / 2, lensSize / 2, 0, Math.PI * 2); // v1.07+ circular clip
    ctx.clip();

    const cx = x;
    const cy = y;
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
  }, [x, y]); // v1.07+ redraw on position change

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const observer = new MutationObserver(() => {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg') || 'transparent';
      lens.style.backgroundColor = bg.trim();             // v1.07+ match lens bg to theme
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

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

