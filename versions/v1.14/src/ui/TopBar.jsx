// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.11] Added magnify mode cycle button (auto/follow/center)
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + language toggle in settings

import { useContext, useState, useEffect } from "react";    // v1.14+ added useEffect for lang detection
import { WorkspaceContext } from "../workspace/WorkspaceContext"; // v1.10+ shared state context

// v1.14+ Translations
const translations = {
  en: {
    grid: "Grid",
    centerView: "Center View",
    magnifier: "Magnifier",
    auto: "Auto-Locate",
    follow: "Follow",
    center: "Center",
    language: "Language"
  },
  jp: {
    grid: "グリッド",
    centerView: "中央に戻す",
    magnifier: "拡大鏡",
    auto: "自動配置",
    follow: "追従",
    center: "中央",
    language: "言語"
  }
};

// v1.14+ Detect device language (returns "en" or "jp")
const detectLanguage = () => {
  const stored = localStorage.getItem("haikan-lang");
  if (stored === "en" || stored === "jp") return stored;
  const browserLang = navigator.language || navigator.userLanguage || "en";
  return browserLang.startsWith("ja") ? "jp" : "en";
};

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
  const [lang, setLang] = useState(detectLanguage);          // v1.14+ language state with auto-detect

  // v1.14+ Save language preference
  useEffect(() => {
    localStorage.setItem("haikan-lang", lang);
  }, [lang]);

  const t = translations[lang];                              // v1.14+ current translations

  // v1.14+ Toggle language
  const toggleLanguage = () => {
    setLang(l => l === "en" ? "jp" : "en");
  };

  // v1.11+ cycle through magnify modes
  const cycleMagnifyMode = () => {
    const modes = ["auto", "follow", "center"];
    const currentIndex = modes.indexOf(magnifyMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setMagnifyMode(modes[nextIndex]);
  };

  // v1.14+ display labels for magnify modes (translated)
  const modeLabels = {
    auto: t.auto,
    follow: t.follow,
    center: t.center
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
                {showGrid ? `▦ ${t.grid} ✓` : `▦ ${t.grid}`}
              </button>
              <button onClick={resetView}>
                ⟲ {t.centerView}
              </button>
              <button onClick={() => setShowMagnifier((m) => !m)}>
                {showMagnifier ? `🔍 ${t.magnifier} ✓` : `🔍 ${t.magnifier}`}
              </button>
              {showMagnifier && (
                <button onClick={cycleMagnifyMode}>
                  ↻ {modeLabels[magnifyMode]}
                </button>
              )}
              <button onClick={toggleLanguage}>
                🌐 {t.language}: {lang === "en" ? "EN" : "JP"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

