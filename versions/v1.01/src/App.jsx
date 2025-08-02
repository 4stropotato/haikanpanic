import { useState, useEffect } from "react";
import IsoGrid from "./components/IsoGrid";               // [v1.01] Added IsoGrid background grid
import SnapOverlay from "./components/SnapOverlay";       // [v1.01] Added SnapOverlay for snapping crosshair
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(true);         // [v1.0] Dark mode toggle state
  const [showGrid, setShowGrid] = useState(true);         // [v1.0] Grid visibility toggle state

  // [v1.0] Update body attribute when darkMode changes
  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="app">
      {/* [v1.0] Top bar UI */}
      <div className="top-bar">
        <span className="brand">shinjiのhaikanCAD</span> {/* [v1.0] App branding */}
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
      <div className="workspace">
        <IsoGrid show={showGrid} />                        {/* [v1.01] Renders isometric grid */}
        <SnapOverlay />                                    {/* [v1.01] Renders snapping crosshair */}
        {/* [v1.0] Placeholder for future drawing canvas or tools */}
      </div>
    </div>
  );
}

export default App;
