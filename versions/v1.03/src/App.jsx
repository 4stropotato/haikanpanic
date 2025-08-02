import { useState, useEffect, useRef } from "react";
import IsoGrid from "./components/IsoGrid";                 // [v1.01] Isometric grid background
import SnapOverlay from "./components/SnapOverlay";         // [v1.01] Snapping crosshair system
import DrawLayer from "./components/DrawLayer";             // [v1.02] Line drawing layer
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(true);           // [v1.0] Dark mode toggle
  const [showGrid, setShowGrid] = useState(true);           // [v1.0] Grid toggle

  const [lastSnap, setLastSnap] = useState(null);           // [v1.02] Current snapped position
  const [startPoint, setStartPoint] = useState(null);       // [v1.02] Start of line
  const [lines, setLines] = useState([]);                   // [v1.02] Stored line segments
  const [previewLine, setPreviewLine] = useState(null);     // [v1.02] Live preview segment
  const [readyToDraw, setReadyToDraw] = useState(false);    // [v1.02] UX: only draw after arm

  const holdTimeout = useRef(null);                         // [v1.02] Touch hold timer
  const heldEnough = useRef(false);                         // [v1.02] Flag: did user hold long enough?

  // [v1.0] Update body attribute when darkMode changes
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // [v1.03] Snap lines to strict 6 directions (90°, -90°, ±30°, ±150°)
  const snapToAllowedAngle = (start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { start, end };                   // [v1.03] Ignore zero-length lines

    const angle = Math.atan2(dy, dx);                       // [v1.03] Calculate actual angle

    const directions = [
      Math.PI / 2,           // [v1.03] ↑ 90°
      -Math.PI / 2,          // [v1.03] ↓ -90°
      Math.PI / 6,           // [v1.03] ↗ 30°
      -Math.PI / 6,          // [v1.03] ↘ -30°
      (5 * Math.PI) / 6,     // [v1.03] ↖ 150°
      -(5 * Math.PI) / 6,    // [v1.03] ↙ -150°
    ];

    let best = directions[0];
    let minDiff = Math.abs(angle - directions[0]);

    for (let i = 1; i < directions.length; i++) {
      const diff = Math.abs(angle - directions[i]);
      if (diff < minDiff) {
        minDiff = diff;                                     // [v1.03] Find closest allowed angle
        best = directions[i];
      }
    }

    return {
      start,
      end: {
        x: start.x + len * Math.cos(best),                  // [v1.03] Adjust endpoint to snapped angle
        y: start.y + len * Math.sin(best),
      },
    };
  };

  // [v1.02] Handles drawing start/end logic
  const triggerDraw = () => {
    if (!lastSnap) return;                                  // [v1.02] Ignore if no snap point

    if (!readyToDraw) {                                     // [v1.02] Start drawing phase
      setStartPoint(lastSnap);                              // [v1.02] Save starting point
      setReadyToDraw(true);                                 // [v1.02] Arm drawing state
    } else {                                                // [v1.02] End drawing phase
      const snapped = snapToAllowedAngle(startPoint, lastSnap); // [v1.03] Snap final line
      setLines([...lines, { start: snapped.start, end: snapped.end }]); // [v1.03] Save snapped line
      setStartPoint(null);                                  // [v1.02] Reset start point
      setPreviewLine(null);                                 // [v1.02] Clear preview
      setReadyToDraw(false);                                // [v1.02] Disarm drawing state
    }
  };

  // [v1.02] Update live preview line on move
  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const snapped = snapToAllowedAngle(startPoint, lastSnap); // [v1.03] Snap live preview
      setPreviewLine({ start: snapped.start, end: snapped.end });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  // [v1.02] Detect touch hold
  const handleTouchStart = () => {
    heldEnough.current = false;                             // [v1.02] Reset hold flag
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;                            // [v1.02] Hold registered
    }, 150);                                                // [v1.02] Hold threshold in ms
  };

  const handleTouchEnd = () => {
    clearTimeout(holdTimeout.current);                      // [v1.02] Cancel hold timer
    if (!heldEnough.current) return;                        // [v1.02] Ignore short tap
    triggerDraw();                                          // [v1.02] Perform draw
  };

  // [v1.02] Fallback for desktop click
  const handleClick = () => {
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      triggerDraw();                                        // [v1.02] Draw on desktop click
    }
  };

  return (
    <div className="app">
      {/* [v1.0] Top bar UI */}
      <div className="top-bar">
        <span className="brand">ハイカンパニック!</span>       {/* [v1.0] App branding */}
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}           {/* [v1.0] Grid toggle */}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light ☀️" : "Dark 🌙"}              {/* [v1.0] Dark mode toggle */}
          </button>
        </div>
      </div>

      {/* [v1.0] Main workspace */}
      <div
        className="workspace"
        onClick={handleClick}                                // [v1.02] Desktop click handler
        onTouchStart={handleTouchStart}                      // [v1.02] Touch hold start
        onTouchEnd={handleTouchEnd}                          // [v1.02] Touch hold end
      >
        <IsoGrid show={showGrid} />                          {/* [v1.01] Renders isometric grid */}
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} /> {/* [v1.03] Drawing layer with snapped angles */}
        <SnapOverlay onSnapChange={setLastSnap} />           {/* [v1.02] Snapping crosshair */}
      </div>
    </div>
  );
}

export default App;
