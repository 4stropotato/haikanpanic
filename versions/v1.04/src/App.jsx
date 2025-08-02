import { useState, useEffect, useRef } from "react";
import IsoGrid from "./components/IsoGrid";              // v1.01+ background isometric grid
import SnapOverlay from "./components/SnapOverlay";      // v1.01+ interactive snapping system
import DrawLayer from "./components/DrawLayer";          // v1.02+ line drawing layer
import "./App.css";

function App() {
  // v1.01+ UI state toggles
  const [darkMode, setDarkMode] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // v1.02+ snapping and drawing state
  const [lastSnap, setLastSnap] = useState(null);        // current live snap (crosshair)
  const [startPoint, setStartPoint] = useState(null);    // confirmed start of line
  const [lines, setLines] = useState([]);                // array of drawn line segments
  const [previewLine, setPreviewLine] = useState(null);  // live preview line while dragging
  const [readyToDraw, setReadyToDraw] = useState(false); // are we in drawing phase?

  // v1.02+ hold + tap tracking
  const holdTimeout = useRef(null);                      // delay before hold registers
  const heldEnough = useRef(false);                      // true if hold was long enough

  // v1.04+ logic flow control
  const pendingStart = useRef(null);                     // frozen snap (waiting for tap to confirm)
  const confirmTapTimeout = useRef(null);                // timeout to cancel pendingStart
  const pendingEnd = useRef(null);                       // frozen end position (on release)
  const tapCount = useRef(0);                            // double-tap counter

  // v1.01+ update global dark/light mode
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // v1.03+ snap direction to 6 fixed isometric angles
  const snapToAllowedAngle = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { start, end }; // no movement

    const angle = Math.atan2(dy, dx);
    const directions = [
      Math.PI / 2, -Math.PI / 2,            // ↑ ↓
      Math.PI / 6, -Math.PI / 6,            // ↗ ↘
      (5 * Math.PI) / 6, -(5 * Math.PI) / 6 // ↖ ↙
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

  // v1.04+ snap to actual nearest grid point
  const snapToNearestGrid = (point) => {
    const dx = 20;
    const tan30 = Math.tan(Math.PI / 6);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    let minDist = Infinity;
    let nearest = null;

    for (let i = -200; i <= 200; i++) {
      const x1 = i * dx;
      for (let j = -200; j <= 200; j++) {
        const x2 = j * dx;
        const x = (x1 + x2) / 2;
        const y = tan30 * (x - x1);
        const px = centerX + x;
        const py = centerY + y;
        const dist = (px - point.x) ** 2 + (py - point.y) ** 2;

        if (dist < minDist) {
          minDist = dist;
          nearest = { x: px, y: py };
        }
      }
    }

    return nearest;
  };

  // v1.04+ finalize the line segment
  const triggerDraw = () => {
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

  // v1.02+ update preview line while dragging
  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const snapped = snapToAllowedAngle(startPoint, lastSnap);
      const snappedStart = snapToNearestGrid(snapped.start);
      const snappedEnd = snapToNearestGrid(snapped.end);
      setPreviewLine({ start: snappedStart, end: snappedEnd });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  // v1.02+ detect long press
  const handleTouchStart = () => {
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150); // hold threshold
  };

  // v1.02+ handle hold release
  const handleTouchEnd = () => {
    clearTimeout(holdTimeout.current);
    if (!heldEnough.current) return;

    // v1.04+ case 1: hold → release → wait for tap
    if (!readyToDraw && !startPoint) {
      pendingStart.current = lastSnap;
      confirmTapTimeout.current = setTimeout(() => {
        pendingStart.current = null;
      }, 5000);
    }

    // v1.04+ case 2: finish drawing
    else if (readyToDraw && startPoint) {
      pendingEnd.current = lastSnap;
      triggerDraw();
    }
  };

  // v1.04+ handle tap + double tap
  const handleClick = () => {
    // ignore desktop click
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) return;

    // case 1: tap to confirm start
    if (!readyToDraw && pendingStart.current) {
      setStartPoint(pendingStart.current);
      setReadyToDraw(true);
      pendingStart.current = null;
      clearTimeout(confirmTapTimeout.current);
      return;
    }

    // case 2: double tap to cancel
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
      }, 300); // double tap timeout
    }
  };

  return (
    <div className="app">
      {/* v1.01+ UI toggle bar */}
      <div className="top-bar">
        <span className="brand">ハイカンパニック!</span>
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      {/* v1.01+ main canvas area */}
      <div
        className="workspace"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <IsoGrid show={showGrid} />
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} />
        <SnapOverlay onSnapChange={setLastSnap} />
      </div>
    </div>
  );
}

export default App;
