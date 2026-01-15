// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.11] Added magnify mode cycle button (auto/follow/center)

import { useContext } from "react";                         // v1.10+ React hook for accessing context
import { WorkspaceContext } from "../workspace/WorkspaceContext"; // v1.10+ shared state context

export default function TopBar() {
  const {
    darkMode,
    showGrid,
    showMagnifier,
    magnifyMode,                                             // v1.11+ magnify mode state
    setDarkMode,
    setShowGrid,
    setShowMagnifier,
    setMagnifyMode,                                          // v1.11+ magnify mode setter
    setZoom,
    setOffset
  } = useContext(WorkspaceContext);                         // v1.10+ destructure values from context

  // v1.11+ cycle through magnify modes
  const cycleMagnifyMode = () => {
    const modes = ["auto", "follow", "center"];
    const currentIndex = modes.indexOf(magnifyMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMagnifyMode(modes[nextIndex]);
  };

  // v1.11+ display labels for magnify modes
  const modeLabels = {
    auto: "Auto-Locate",
    follow: "Follow",
    center: "Center"
  };

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
        {showMagnifier && (                                  /* v1.11+ only show when magnifier is on */
          <button onClick={cycleMagnifyMode}>
            {modeLabels[magnifyMode]}                            {/* v1.11+ cycle through modes */}
          </button>
        )}
        <button onClick={resetView}>Center View</button>    {/* v1.10+ reset zoom and pan */}
      </div>
    </div>
  );
}

