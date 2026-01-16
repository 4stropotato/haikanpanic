// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.11] Added magnify mode cycle button (auto/follow/center)
// [v1.13] Simplified: theme toggle + settings dropdown only

import { useContext, useState } from "react";               // v1.13+ added useState for dropdown
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

  const [showSettings, setShowSettings] = useState(false);   // v1.13+ settings dropdown state

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

      <div className="controls">                            {/* v1.13+ simplified controls */}
        {/* v1.13+ Theme toggle - always visible */}
        <button onClick={() => setDarkMode((d) => !d)}>
          {darkMode ? "☀" : "🌙"}
        </button>

        {/* v1.13+ Settings dropdown */}
        <div className="settings-dropdown">
          <button onClick={() => setShowSettings((s) => !s)}>
            ⚙
          </button>
          {showSettings && (
            <div className="dropdown-menu">
              <button onClick={() => setShowGrid((g) => !g)}>
                {showGrid ? "▦ Grid ✓" : "▦ Grid"}
              </button>
              <button onClick={resetView}>
                ⟲ Center View
              </button>
              <button onClick={() => setShowMagnifier((m) => !m)}>
                {showMagnifier ? "🔍 Magnifier ✓" : "🔍 Magnifier"}
              </button>
              {showMagnifier && (
                <button onClick={cycleMagnifyMode}>
                  ↻ {modeLabels[magnifyMode]}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

