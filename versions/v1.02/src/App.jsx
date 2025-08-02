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

  // [v1.02] Handles drawing start/end
  const triggerDraw = () => {
    if (!lastSnap) return;                                  // [v1.02] Ignore if no snap yet

    if (!readyToDraw) {                                     // [v1.02] Start drawing phase
      setStartPoint(lastSnap);                              // [v1.02] Save starting point
      setReadyToDraw(true);                                 // [v1.02] Arm drawing state
    } else {                                                // [v1.02] End drawing phase
      setLines([...lines, { start: startPoint, end: lastSnap }]); // [v1.02] Save line
      setStartPoint(null);                                  // [v1.02] Reset start
      setPreviewLine(null);                                 // [v1.02] Clear preview
      setReadyToDraw(false);                                // [v1.02] Disarm drawing
    }
  };

  // [v1.02] Updates live preview line while moving
  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      setPreviewLine({ start: startPoint, end: lastSnap }); // [v1.02] Live preview segment
    }
  }, [lastSnap, startPoint, readyToDraw]);

  // [v1.02] Detect hold (touch only)
  const handleTouchStart = () => {
    heldEnough.current = false;                             // [v1.02] Reset hold flag
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;                            // [v1.02] Hold registered
    }, 150);                                                // [v1.02] Hold threshold ms
  };

  const handleTouchEnd = () => {
    clearTimeout(holdTimeout.current);                      // [v1.02] Cancel hold timer
    if (!heldEnough.current) return;                        // [v1.02] Ignore short tap
    triggerDraw();                                          // [v1.02] Perform draw
  };

  // [v1.02] Desktop click fallback
  const handleClick = () => {
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      triggerDraw();                                        // [v1.02] Draw on desktop
    }
  };

  return (
    <div className="app">
      {/* [v1.0] Top bar UI */}
      <div className="top-bar">
        <span className="brand">ハイカンパニック</span>       {/* [v1.0] App branding */}
        <div className="controls">
          {/* [v1.0] Toggle grid visibility */}
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          {/* [v1.0] Toggle dark/light mode */}
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light ☀️" : "Dark 🌙"}
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
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} /> {/* [v1.02] Drawing layer */}
        <SnapOverlay onSnapChange={setLastSnap} />           {/* [v1.02] Snapping crosshair */}
      </div>
    </div>
  );
}

export default App;
