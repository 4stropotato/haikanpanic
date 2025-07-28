import { useState, useEffect, useRef } from "react";
import IsoGrid from "./components/IsoGrid";
import SnapOverlay from "./components/SnapOverlay";
import DrawLayer from "./components/DrawLayer";
import Magnify from "./components/Magnify";
import "./App.css";

function App() {
  const workspaceRef = useRef(null);

  const [darkMode, setDarkMode] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [hideCrosshair, setHideCrosshair] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });

  const [lastSnap, setLastSnap] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [lines, setLines] = useState([]);
  const [previewLine, setPreviewLine] = useState(null);
  const [readyToDraw, setReadyToDraw] = useState(false);

  const holdTimeout = useRef(null);
  const heldEnough = useRef(false);
  const pendingStart = useRef(null);
  const confirmTapTimeout = useRef(null);
  const pendingEnd = useRef(null);
  const tapCount = useRef(0);

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (lastSnap) {
      setLensPos(lastSnap);
    }
  }, [lastSnap]);

  const snapToAllowedAngle = (start, end) => {
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

  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const snapped = snapToAllowedAngle(startPoint, lastSnap);
      const snappedStart = snapToNearestGrid(snapped.start);
      const snappedEnd = snapToNearestGrid(snapped.end);
      setPreviewLine({ start: snappedStart, end: snappedEnd });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  const handleTouchStart = () => {
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);
  };

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
        <span className="brand">ハイカンパニック!</span>
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light" : "Dark"}
          </button>
          <button onClick={() => setShowMagnifier(!showMagnifier)}>
            {showMagnifier ? "Disable Magnify" : "Enable Magnify"}
          </button>
        </div>
      </div>

      <div
        className="workspace"
        ref={workspaceRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <IsoGrid show={showGrid} />
        <DrawLayer lines={lines} preview={previewLine} isDark={darkMode} />
        {!hideCrosshair && <SnapOverlay onSnapChange={setLastSnap} />}
        {showMagnifier && <Magnify x={lensPos.x} y={lensPos.y} />}
      </div>
    </div>
  );
}

export default App;