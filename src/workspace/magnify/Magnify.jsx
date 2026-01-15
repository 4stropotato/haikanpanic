// [v1.07] Initial implementation of canvas-based magnifier
// [v1.08] Retina scaling and multi-layer compositing
// [v1.09] Verified live sync with zoomable workspace
// [v1.10] Throttled rendering, animation frame batching, last-pos tracking
// [v1.11] Three positioning modes: auto (idle=crosshair, hold=above), follow (always above), center (always at crosshair)

import { useEffect, useRef } from "react";                          // [v1.07] React hook for rendering
import "./Magnify.css";                                             // [v1.07] lens styles

export default function Magnify({ x, y, isHolding, mode }) {        // [v1.11] mode: "auto" | "follow" | "center"
  const lensRef = useRef(null);                                     // [v1.07] reference to canvas lens
  const animationRef = useRef(null);                                // [v1.10] animation frame tracker
  const lastPos = useRef({ x, y });                                 // [v1.10] track last snapped position

  useEffect(() => {
    lastPos.current = { x, y };                                     // [v1.10] update target position

    if (animationRef.current) return;                               // [v1.10] throttle to 1 frame per update

    const render = () => {
      const lens = lensRef.current;
      if (!lens) return;

      const ctx = lens.getContext("2d");                            // [v1.07] get drawing context
      const canvases = Array.from(document.querySelectorAll("canvas")); // [v1.07] collect all canvases
      const gridCanvas = canvases.find(c => c.style.zIndex === "0");    // [v1.08] identify grid layer
      const drawCanvas = canvases.find(c => c.style.zIndex === "6");    // [v1.08] identify draw layer
      const crosshairCanvas = canvases.find(c => c.style.zIndex === "999"); // [v1.08] crosshair layer

      if (!gridCanvas || !drawCanvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;                     // [v1.08] retina scale
      const lensSize = 120;                                        // [v1.08] diameter of lens
      const zoom = 1;                                              // [v1.08] magnification factor
      const cx = lastPos.current.x * dpr;                          // [v1.08] target center X
      const cy = lastPos.current.y * dpr;                          // [v1.08] target center Y
      const srcSize = lensSize / zoom;
      const sx = Math.max(0, Math.min(cx - srcSize / 2, gridCanvas.width - srcSize)); // [v1.07] clamp X
      const sy = Math.max(0, Math.min(cy - srcSize / 2, gridCanvas.height - srcSize)); // [v1.07] clamp Y

      lens.width = lensSize;
      lens.height = lensSize;

      ctx.clearRect(0, 0, lensSize, lensSize);                     // [v1.07] clear previous frame
      ctx.save();
      ctx.beginPath();
      ctx.arc(lensSize / 2, lensSize / 2, lensSize / 2, 0, Math.PI * 2); // [v1.07] circular clip
      ctx.clip();

      [gridCanvas, drawCanvas, crosshairCanvas].forEach((canvas) => {
        if (!canvas) return;
        ctx.drawImage(canvas, sx, sy, srcSize, srcSize, 0, 0, lensSize, lensSize); // [v1.07] composite layers
      });

      ctx.restore();

      // [v1.08] draw red internal crosshair in magnifier
      ctx.save();
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1.5;
      const mid = lensSize / 2;
      const arm = 12;
      ctx.beginPath();
      ctx.moveTo(mid - arm, mid);
      ctx.lineTo(mid + arm, mid);
      ctx.moveTo(mid, mid - arm);
      ctx.lineTo(mid, mid + arm);
      ctx.stroke();
      ctx.restore();

      animationRef.current = null;                                 // [v1.10] clear after render
    };

    animationRef.current = requestAnimationFrame(render);          // [v1.10] schedule redraw

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);                // [v1.10] cleanup frame
        animationRef.current = null;
      }
    };
  }, [x, y]);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const updateBackground = () => {
      const bg = getComputedStyle(document.body).getPropertyValue("--bg") || "transparent";
      lens.style.backgroundColor = bg.trim();                      // [v1.07] sync lens bg with theme
    };

    updateBackground();

    const observer = new MutationObserver(updateBackground);       // [v1.07] observe theme changes
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();                            // [v1.07] cleanup observer
  }, []);

  // [v1.11] Calculate position based on mode and holding state
  const lensSize = 120;
  const aboveFinger = { top: `${y - lensSize / 2 - 100}px`, left: `${x - lensSize / 2}px`, transform: "none" }; // [v1.11] above finger
  const atCrosshair = { top: `${y - lensSize / 2}px`, left: `${x - lensSize / 2}px`, transform: "none" };       // [v1.11] at exact crosshair

  // [v1.11] mode logic: auto | follow | center
  let topPosition;
  if (mode === "center") {
    topPosition = atCrosshair;                                     // [v1.11] always at crosshair (never moves above)
  } else if (mode === "follow") {
    topPosition = aboveFinger;                                     // [v1.11] always above finger (v1.10 style)
  } else {
    topPosition = isHolding ? aboveFinger : atCrosshair;           // [v1.11] auto: idle=crosshair, hold=above
  }

  return (
    <canvas
      ref={lensRef}                                                 // [v1.07] bind canvas to ref
      className="magnifier-lens"                                    // [v1.07] styled circle lens
      style={{
        position: "absolute",                                       // [v1.07] position above snap
        top: topPosition.top,                                       // [v1.11] dynamic top position
        left: topPosition.left,                                     // [v1.11] dynamic left position
        transform: topPosition.transform,                           // [v1.11] for centering when at top
        pointerEvents: "none",                                      // [v1.07] allow touch-through
        zIndex: 999,                                                // [v1.08] draw on top of all layers
        borderRadius: "50%"                                         // [v1.07] circular mask
      }}
    />
  );
}
