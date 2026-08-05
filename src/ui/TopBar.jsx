// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.11] Added magnify mode cycle button (auto/follow/center)
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + language toggle in settings
// [v1.14] Replaced emojis with clean SVG icons

import { useContext, useState, useEffect } from "react";    // v1.14+ added useEffect for lang detection
import { WorkspaceContext } from "../workspace/WorkspaceContext"; // v1.10+ shared state context
import { SunIcon, MoonIcon, SettingsIcon, GridIcon, CrosshairIcon, MagnifierIcon, RotateIcon, GlobeIcon, CheckIcon, SendToStudioIcon } from "./Icons"; // v1.14+ SVG icons
import { buildStudioHandoff, encodeHandoff } from "../workspace/utils/handoff"; // v1.16+ Studio handoff

// v1.14+ Translations
const translations = {
  en: {
    grid: "Grid",
    centerView: "Center View",
    magnifier: "Magnifier",
    auto: "Auto-Locate",
    follow: "Follow",
    center: "Center",
    language: "Language",
    toStudio: "Send joint to Studio",
    noJoint: "Draw two connected lines first"
  },
  jp: {
    grid: "グリッド",
    centerView: "中央に戻す",
    magnifier: "拡大鏡",
    auto: "自動配置",
    follow: "追従",
    center: "中央",
    language: "言語",
    toStudio: "スタジオへ送る",
    noJoint: "接続された2本の線を描いてください"
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
    setOffset,
    lines                                                    // v1.16+ drawn segments for handoff
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

  // v1.16+ Build handoff from the latest joint and open Studio with it.
  // Same-origin path: works when draw and studio are served from one host.
  const sendToStudio = () => {
    const envelope = buildStudioHandoff(lines || []);
    if (!envelope) {
      alert(t.noJoint);
      return;
    }
    window.open(`/studio/?handoff=${encodeHandoff(envelope)}`, "_blank");
  };

  return (
    <div className="top-bar">                               {/* v1.10+ header bar layout */}
      <span className="brand">ハイカンパニック!</span>         {/* v1.10+ app title */}

      <div className="controls">                            {/* v1.13+ simplified controls */}
        {/* v1.16+ Send latest joint to Studio */}
        <button onClick={sendToStudio} title={t.toStudio}>
          <SendToStudioIcon />
        </button>

        {/* v1.14+ Theme toggle with SVG icons */}
        <button onClick={() => setDarkMode((d) => !d)}>
          {darkMode ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* v1.14+ Settings dropdown with SVG icons */}
        <div className="settings-dropdown">
          <button onClick={() => setShowSettings((s) => !s)}>
            <SettingsIcon />
          </button>
          {showSettings && (
            <div className="dropdown-menu">
              <button onClick={() => setShowGrid((g) => !g)}>
                <GridIcon /> <span>{t.grid}</span> {showGrid && <CheckIcon />}
              </button>
              <button onClick={resetView}>
                <CrosshairIcon /> <span>{t.centerView}</span>
              </button>
              <button onClick={() => setShowMagnifier((m) => !m)}>
                <MagnifierIcon /> <span>{t.magnifier}</span> {showMagnifier && <CheckIcon />}
              </button>
              {showMagnifier && (
                <button onClick={cycleMagnifyMode}>
                  <RotateIcon /> <span>{modeLabels[magnifyMode]}</span>
                </button>
              )}
              <button onClick={toggleLanguage}>
                <GlobeIcon /> <span>{t.language}: {lang === "en" ? "EN" : "JP"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

