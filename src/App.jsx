import { useState, useEffect, useRef } from "react";
import IsoGrid from "./components/IsoGrid";              // v1.01+ background isometric grid
import SnapOverlay from "./components/SnapOverlay";      // v1.01+ interactive snapping system
import DrawLayer from "./components/DrawLayer";          // v1.02+ line drawing layer
import Magnify from "./components/Magnify";              // v1.07+ real-time magnifier using live compositing
import "./App.css";

function App() {
  const workspaceRef = useRef(null);                     // v1.05+ reference to workspace element for screenshot capture

  // UI state toggles
  const [darkMode, setDarkMode] = useState(true);        // v1.01+ dark mode toggle
  const [showGrid, setShowGrid] = useState(true);        // v1.01+ toggle grid visibility
  const [showMagnifier, setShowMagnifier] = useState(false); // v1.05+ toggle magnifier mode
  const [hideCrosshair, setHideCrosshair] = useState(false); // v1.05+ control crosshair visibility during snapshot
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });    // v1.05+ magnifier lens position

  // Snapping and drawing state
  const [lastSnap, setLastSnap] = useState(null);        // v1.02+ current live snap (crosshair)
  const [startPoint, setStartPoint] = useState(null);    // v1.02+ confirmed start of line
  const [lines, setLines] = useState([]);                // v1.02+ array of drawn line segments
  const [previewLine, setPreviewLine] = useState(null);  // v1.02+ live preview line while dragging
  const [readyToDraw, setReadyToDraw] = useState(false); // v1.02+ drawing phase active?

  const [zoom, setZoom] = useState(1);                   // v1.09+ zoom level for scaling workspace
  const [offset, setOffset] = useState({ x: 0, y: 0 });   // v1.09+ pan offset for shifting workspace
  const lastTouch = useRef(null);                        // v1.09+ track pinch midpoint and distance

  // Hold + tap tracking
  const holdTimeout = useRef(null);                      // v1.02+ delay before hold registers
  const heldEnough = useRef(false);                      // v1.02+ true if hold was long enough
  const pendingStart = useRef(null);                     // v1.04+ frozen snap (waiting for tap to confirm)
  const confirmTapTimeout = useRef(null);                // v1.04+ timeout to cancel pendingStart
  const pendingEnd = useRef(null);                       // v1.04+ frozen end position (on release)
  const tapCount = useRef(0);                            // v1.04+ double-tap counter

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light"); // v1.01+ update global dark/light mode
  }, [darkMode]);

  useEffect(() => {
    if (lastSnap) {
      setLensPos(lastSnap);                              // v1.08+ update lens position with snap
    }
  }, [lastSnap]);

  useEffect(() => {
    const el = workspaceRef.current;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 0.9;
      setZoom(z => Math.min(4, Math.max(0.25, z * factor))); // v1.09+ mouse wheel zoom
    };
    el?.addEventListener("wheel", handleWheel, { passive: false });
    return () => el?.removeEventListener("wheel", handleWheel);
  }, []);

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const mid = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      };
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (!lastTouch.current) {
        lastTouch.current = { mid, dist, zoom, offset };  // v1.09+ init zoom state
        return;
      }
      const dz = dist / lastTouch.current.dist;
      const newZoom = Math.min(4, Math.max(0.25, lastTouch.current.zoom * dz));
      const dx = mid.x - lastTouch.current.mid.x;
      const dy = mid.y - lastTouch.current.mid.y;
      const newOffset = {
        x: lastTouch.current.offset.x + dx,
        y: lastTouch.current.offset.y + dy,
      };
      setZoom(newZoom);                                   // v1.09+ apply pinch zoom
      setOffset(newOffset);                               // v1.09+ apply pan shift
    }
  };

  const handleTouchEnd = () => {
    lastTouch.current = null;
    clearTimeout(holdTimeout.current);
    if (!heldEnough.current) return;

    if (!readyToDraw && !startPoint) {
      pendingStart.current = lastSnap;
      confirmTapTimeout.current = setTimeout(() => {
        pendingStart.current = null;
      }, 5000);
    } else if (readyToDraw && startPoint) {
      pendingEnd.current = lastSnap;
      triggerDraw();
    }
  };

  const snapToAllowedAngle = (start, end) => {           // v1.03+ snap direction to 6 fixed isometric angles
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { start, end };
    const angle = Math.atan2(dy, dx);
    const directions = [
      Math.PI / 2, -Math.PI / 2,
      Math.PI / 6, -Math.PI / 6,
      (5 * Math.PI) / 6, -(5 * Math.PI) / 6
    ];
    let best = directions[0];
    let minDiff = Math.abs(angle - best);
    for (let i = 1; i < directions.length; i++) {
      const diff = Math.abs(angle - directions[i]);
      if (diff < minDiff) {
        minDiff = diff;
        best = directions[i];
      }
    }
    return {
      start,
      end: {
        x: start.x + len * Math.cos(best),
        y: start.y + len * Math.sin(best),
      },
    };
  };

  const snapToNearestGrid = (point) => {                 // v1.09+ compensate for zoom and pan to ensure snapping stays accurate
    const dx = 20;
    const tan30 = Math.tan(Math.PI / 6);
    const centerX = window.innerWidth / 2 + offset.x;
    const centerY = window.innerHeight / 2 + offset.y;
    const px = (point.x - centerX) / zoom;
    const py = (point.y - centerY) / zoom;

    let minDist = Infinity;
    let nearest = null;

    for (let i = -200; i <= 200; i++) {
      const x1 = i * dx;
      for (let j = -200; j <= 200; j++) {
        const x2 = j * dx;
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1);
        const dist = (px - x) ** 2 + (py - y) ** 2;
        if (dist < minDist) {
          minDist = dist;
          nearest = { x, y };
        }
      }
    }

    return nearest;
  };

  const triggerDraw = () => {                            // v1.04+ finalize the line segment
    if (!startPoint || !pendingEnd.current) return;
    const angleSnapped = snapToAllowedAngle(startPoint, pendingEnd.current);
    const snappedEnd = snapToNearestGrid(angleSnapped.end);
    const snappedStart = snapToNearestGrid(angleSnapped.start);
    const snapped = { start: snappedStart, end: snappedEnd };

    setLines([...lines, snapped]);
    setStartPoint(null);
    setPreviewLine(null);
    setReadyToDraw(false);
    pendingEnd.current = null;
  };

  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const snapped = snapToAllowedAngle(startPoint, lastSnap);
      const snappedStart = snapToNearestGrid(snapped.start);
      const snappedEnd = snapToNearestGrid(snapped.end);
      setPreviewLine({ start: snappedStart, end: snappedEnd }); // v1.04+ update preview line while dragging
    }
  }, [lastSnap, startPoint, readyToDraw]);

  const handleTouchStart = () => {                       // v1.04+ detect long press
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);
  };

  const handleClick = () => {                            // v1.04+ handle tap + double tap
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) return;

    if (!readyToDraw && pendingStart.current) {
      setStartPoint(pendingStart.current);
      setReadyToDraw(true);
      pendingStart.current = null;
      clearTimeout(confirmTapTimeout.current);
      return;
    }

    if (readyToDraw && startPoint) {
      tapCount.current++;
      setTimeout(() => {
        if (tapCount.current === 2) {
          setStartPoint(null);
          setPreviewLine(null);
          setReadyToDraw(false);
          pendingEnd.current = null;
        }
        tapCount.current = 0;
      }, 300);
    }
  };

  return (
    <div className="app">
      <div className="top-bar">
        <span className="brand">ハイカンパニック!</span>     {/* v1.01+ app branding */}
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}          {/* v1.01+ toggle grid button */}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light" : "Dark"}                   {/* v1.01+ toggle theme button */}
          </button>
          <button onClick={() => setShowMagnifier(!showMagnifier)}> {/* v1.05+ toggle magnifier */}
            {showMagnifier ? "Disable Magnify" : "Enable Magnify"}
          </button>
          <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}> {/* v1.09+ center view reset */}
            Center View
          </button>
        </div>
      </div>

      <div
        className="workspace"
        ref={workspaceRef}                                  // v1.05+ reference to workspace element
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}                       // v1.09+ enable 2-finger pan + zoom
        onTouchEnd={handleTouchEnd}
      >
        <IsoGrid show={showGrid} zoom={zoom} offset={offset} />  {/* v1.09+ pass zoom/pan to grid */}
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} zoom={zoom} offset={offset} /> {/* v1.09+ pass zoom/pan to canvas */}
        {!hideCrosshair && <SnapOverlay onSnapChange={setLastSnap} zoom={zoom} offset={offset} />} {/* v1.09+ pass zoom/pan to crosshair */}
        {showMagnifier && (
          <Magnify x={lensPos.x} y={lensPos.y} isDark={darkMode} />   /* v1.08+ pass live theme state to lens */
        )}
      </div>
    </div>
  );
}

export default App;

