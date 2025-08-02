import { useContext } from "react";                         // v1.10+ React hook for accessing context
import { WorkspaceContext } from "../workspace/WorkspaceContext"; // v1.10+ shared state context

export default function TopBar() {
  const {
    darkMode,
    showGrid,
    showMagnifier,
    setDarkMode,
    setShowGrid,
    setShowMagnifier,
    setZoom,
    setOffset
  } = useContext(WorkspaceContext);                         // v1.10+ destructure values from context

  const resetView = () => {
    setZoom(1);                                             // v1.10+ reset zoom to default
    setOffset({ x: 0, y: 0 });                              // v1.10+ reset offset to center
  };

  return (
    <div className="top-bar">                               {/* v1.10+ header bar layout */}
      <span className="brand">ハイカンパニック!</span>         {/* v1.10+ app title */}
      <div className="controls">                            {/* v1.10+ container for buttons */}
        <button onClick={() => setShowGrid((g) => !g)}>
          {showGrid ? "Hide Grid" : "Show Grid"}            {/* v1.10+ toggle grid */}
        </button>
        <button onClick={() => setDarkMode((d) => !d)}>
          {darkMode ? "Light" : "Dark"}                     {/* v1.10+ toggle theme */}
        </button>
        <button onClick={() => setShowMagnifier((m) => !m)}>
          {showMagnifier ? "Disable Magnify" : "Enable Magnify"} {/* v1.10+ toggle magnifier */}
        </button>
        <button onClick={resetView}>Center View</button>    {/* v1.10+ reset zoom and pan */}
      </div>
    </div>
  );
}

