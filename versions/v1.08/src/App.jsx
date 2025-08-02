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

  // Hold + tap tracking
  const holdTimeout = useRef(null);                      // v1.02+ delay before hold registers
  const heldEnough = useRef(false);                      // v1.02+ true if hold was long enough
  const pendingStart = useRef(null);                     // v1.04+ frozen snap (waiting for tap to confirm)
  const confirmTapTimeout = useRef(null);                // v1.04+ timeout to cancel pendingStart
  const pendingEnd = useRef(null);                       // v1.04+ frozen end position (on release)
  const tapCount = useRef(0);                            // v1.04+ double-tap counter

  // v1.01+ update global dark/light mode
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // v1.08+ update lens position with snap
  useEffect(() => {
    if (lastSnap) {
      setLensPos(lastSnap);
    }
  }, [lastSnap]);

  // v1.03+ snap direction to 6 fixed isometric angles
  const snapToAllowedAngle = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { start, end };

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

  // v1.03+ Snap to nearest grid point
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

  // v1.04+ Finalize the line segment
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

  // v1.04+ Update preview line while dragging
  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const snapped = snapToAllowedAngle(startPoint, lastSnap);
      const snappedStart = snapToNearestGrid(snapped.start);
      const snappedEnd = snapToNearestGrid(snapped.end);
      setPreviewLine({ start: snappedStart, end: snappedEnd });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  // v1.04+ Detect long press
  const handleTouchStart = () => {
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);
  };

  // v1.04+ Handle hold release
  const handleTouchEnd = () => {
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

  // v1.04+ Handle tap + double tap
  const handleClick = () => {
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
        </div>
      </div>

      <div
        className="workspace"
        ref={workspaceRef} // v1.05+ reference to workspace element for screenshot capture
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <IsoGrid show={showGrid} />
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} />
        {!hideCrosshair && <SnapOverlay onSnapChange={setLastSnap} />}
        {showMagnifier && (
          <Magnify x={lensPos.x} y={lensPos.y} isDark={darkMode} />   // v1.08+ pass live theme state to lens
        )}
      </div>
    </div>
  );
}

export default App;

