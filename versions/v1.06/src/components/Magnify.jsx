import { useEffect, useRef } from "react";
import "./Magnify.css";

// [v1.05] Magnify displays a circular zoom lens over the snapshot
export default function Magnify({ snapshot, x, y }) {
  const lensRef = useRef(null); // [v1.05] Reference to the canvas lens

  useEffect(() => {
    const lens = lensRef.current;
    lens.width = 120;  // [v1.05] Set canvas width
    lens.height = 120; // [v1.05] Set canvas height

    const ctx = lens.getContext("2d");
    const zoom = 2;    // [v1.05] Magnification factor (2x)

    // [v1.06] Adjusted: no scaling compensation (touch pos already scaled)
    const sx = x - lens.width / (2 * zoom); // [v1.06+] scale fix for touch point
    const sy = y - lens.height / (2 * zoom); // [v1.06+] scale fix for touch point

    ctx.clearRect(0, 0, lens.width, lens.height); // [v1.05] Clear previous frame
    ctx.save();

    // [v1.05] Clip drawing to circular area
    ctx.beginPath();
    ctx.arc(lens.width / 2, lens.height / 2, lens.width / 2, 0, Math.PI * 2);
    ctx.clip();

    // [v1.05] Draw zoomed portion of snapshot into lens
    ctx.drawImage(
      snapshot,               // Source image
      sx, sy,                 // [v1.06+] uses adjusted coords
      lens.width / zoom,      // Source width
      lens.height / zoom,     // Source height
      0, 0,                   // Destination x,y in lens
      lens.width, lens.height // Destination width and height
    );

    ctx.restore(); // [v1.05] Restore to unclipped context
  }, [snapshot, x, y]); // [v1.05] Redraw whenever snapshot or position changes

  return (
    <canvas
      ref={lensRef}
      className="magnifier-lens"
      style={{
        top: `${y / 2 - 180}px`,   // [v1.06+] Adjusted vertical offset (scaled lens pos)
        left: `${x / 2 - 60}px`,   // [v1.06+] Adjusted horizontal offset (scaled lens pos)
      }}
    />
  );
}

