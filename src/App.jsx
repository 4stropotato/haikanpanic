import { useState, useEffect, useRef } from "react";
import IsoGrid from "./components/IsoGrid";
import SnapOverlay from "./components/SnapOverlay";
import DrawLayer from "./components/DrawLayer"; // v1.02+ line drawing layer
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  const [lastSnap, setLastSnap] = useState(null);           // v1.02+ current snapped position
  const [startPoint, setStartPoint] = useState(null);       // v1.02+ start of line
  const [lines, setLines] = useState([]);                   // v1.02+ stored line segments
  const [previewLine, setPreviewLine] = useState(null);     // v1.02+ live preview segment
  const [readyToDraw, setReadyToDraw] = useState(false);    // v1.02+ UX: only draw after arm

  // v1.02+ hold detection for touch
  const holdTimeout = useRef(null);
  const heldEnough = useRef(false);

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // v1.02+ draw line logic
  const triggerDraw = () => {
    if (!lastSnap) return;

    if (!readyToDraw) {
      setStartPoint(lastSnap);
      setReadyToDraw(true);
    } else {
      setLines([...lines, { start: startPoint, end: lastSnap }]);
      setStartPoint(null);
      setPreviewLine(null);
      setReadyToDraw(false);
    }
  };

  // v1.02+ preview line update
  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      setPreviewLine({ start: startPoint, end: lastSnap });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  // v1.02+ strict hold logic (touch only)
  const handleTouchStart = () => {
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150); // hold threshold (ms)
  };

  const handleTouchEnd = () => {
    clearTimeout(holdTimeout.current);
    if (!heldEnough.current) return; // treat as a tap — ignore

    triggerDraw();
  };

  // Desktop click remains simple
  const handleClick = () => {
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
      triggerDraw(); // desktop only
    }
  };

  return (
    <div className="app">
      <div className="top-bar">
        <span className="brand">ハイカンパニック</span>
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light ☀️" : "Dark 🌙"}
          </button>
        </div>
      </div>

      <div
        className="workspace"
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <IsoGrid show={showGrid} />
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} /> {/* v1.02+ */}
        <SnapOverlay onSnapChange={setLastSnap} /> {/* v1.02+ */}
      </div>
    </div>
  );
}

export default App;
