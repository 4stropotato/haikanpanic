import { useState, useEffect } from "react";
import IsoGrid from "./components/IsoGrid";
import SnapOverlay from "./components/SnapOverlay";
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="app">
      <div className="top-bar">
        <span className="brand">shinjiのhaikanCAD</span>
        <div className="controls">
          <button onClick={() => setShowGrid(!showGrid)}>
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "Light ☀️" : "Dark 🌙"}
          </button>
        </div>
      </div>

      <div className="workspace">
        <IsoGrid show={showGrid} />
        <SnapOverlay />
        {/* Drawing canvas or tools go here in the future */}
      </div>
    </div>
  );
}

export default App;
