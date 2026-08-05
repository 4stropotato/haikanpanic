// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + SVG icons
// [v1.16] Send-to-Studio handoff
// [v1.18] Bottom action bar
// [v2.00] Full UI redesign: glass top bar, floating dock, bottom sheet.
//         Nothing removed — advanced controls are HIDDEN in the sheet.

import { useContext, useState, useEffect } from "react";
import { WorkspaceContext } from "../workspace/WorkspaceContext";
import { SunIcon, MoonIcon, GridIcon, CrosshairIcon, MagnifierIcon, RotateIcon, GlobeIcon, CheckIcon, SendToStudioIcon, PencilIcon, MoreIcon } from "./Icons";
import { buildStudioHandoff, encodeHandoff } from "../workspace/utils/handoff";

const translations = {
  en: {
    grid: "Grid",
    centerView: "Center view",
    magnifier: "Magnifier",
    auto: "Auto-Locate",
    follow: "Follow",
    center: "Center",
    language: "Language",
    noJoint: "Draw two connected lines first",
    edit: "Edit",
    undo: "Undo",
    studio: "Studio",
    more: "More",
    scale: "Scale: 1 pt =",
    clear: "Clear all",
    clearConfirm: "Delete all lines?",
    theme: "Theme"
  },
  jp: {
    grid: "グリッド",
    centerView: "中央に戻す",
    magnifier: "拡大鏡",
    auto: "自動配置",
    follow: "追従",
    center: "中央",
    language: "言語",
    noJoint: "接続された2本の線を描いてください",
    edit: "編集",
    undo: "戻す",
    studio: "スタジオ",
    more: "その他",
    scale: "縮尺: 1 pt =",
    clear: "全消去",
    clearConfirm: "全ての線を削除しますか？",
    theme: "テーマ"
  }
};

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
    magnifyMode,
    setDarkMode,
    setShowGrid,
    setShowMagnifier,
    setMagnifyMode,
    setZoom,
    setOffset,
    lines,
    setLines,
    mmPerPoint,
    setMmPerPoint,
    editMode,
    setEditMode
  } = useContext(WorkspaceContext);

  const [showSheet, setShowSheet] = useState(false);
  const [lang, setLang] = useState(detectLanguage);

  useEffect(() => {
    localStorage.setItem("haikan-lang", lang);
  }, [lang]);

  const t = translations[lang];

  const cycleMagnifyMode = () => {
    const modes = ["auto", "follow", "center"];
    setMagnifyMode(modes[(modes.indexOf(magnifyMode) + 1) % modes.length]);
  };
  const modeLabels = { auto: t.auto, follow: t.follow, center: t.center };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const sendToStudio = () => {
    const envelope = buildStudioHandoff(lines || []);
    if (!envelope) {
      alert(t.noJoint);
      return;
    }
    window.open(`/studio/?handoff=${encodeHandoff(envelope)}`, "_blank");
  };

  return (
    <>
      <div className="top-bar">
        <span className="brand">ハイカンパニック!</span>
        <span className="scale-badge" onClick={() => setShowSheet(true)}>
          1pt={mmPerPoint}mm
        </span>
      </div>

      {/* v2.00 floating dock: only the actions used constantly while drawing */}
      <div className="dock">
        <button
          className="dock-btn"
          onClick={() => setLines(lines.slice(0, -1))}
          disabled={!lines.length}
        >
          <RotateIcon />
          <span>{t.undo}</span>
        </button>
        <button
          className={"dock-btn" + (editMode ? " glow" : "")}
          onClick={() => setEditMode(!editMode)}
          disabled={!lines.length}
        >
          <PencilIcon />
          <span>{t.edit}</span>
        </button>
        <button className="dock-btn primary" onClick={sendToStudio}>
          <SendToStudioIcon />
          <span>{t.studio}</span>
        </button>
        <button className="dock-btn" onClick={() => setShowSheet(true)}>
          <MoreIcon />
          <span>{t.more}</span>
        </button>
      </div>

      {/* v2.00 bottom sheet: everything else lives here, hidden not deleted */}
      {showSheet && (
        <div className="sheet-backdrop" onClick={() => setShowSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-row">
              <span>{t.scale}</span>
              <input
                type="number"
                min="1"
                value={mmPerPoint}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value > 0) setMmPerPoint(value);
                }}
              />
              <span>mm</span>
            </div>
            <button className="sheet-btn" onClick={() => setDarkMode((d) => !d)}>
              {darkMode ? <SunIcon /> : <MoonIcon />} <span>{t.theme}</span>
            </button>
            <button className="sheet-btn" onClick={() => setShowGrid((g) => !g)}>
              <GridIcon /> <span>{t.grid}</span> {showGrid && <CheckIcon />}
            </button>
            <button className="sheet-btn" onClick={resetView}>
              <CrosshairIcon /> <span>{t.centerView}</span>
            </button>
            <button className="sheet-btn" onClick={() => setShowMagnifier((m) => !m)}>
              <MagnifierIcon /> <span>{t.magnifier}</span> {showMagnifier && <CheckIcon />}
            </button>
            {showMagnifier && (
              <button className="sheet-btn" onClick={cycleMagnifyMode}>
                <RotateIcon /> <span>{modeLabels[magnifyMode]}</span>
              </button>
            )}
            <button className="sheet-btn" onClick={() => setLang((l) => (l === "en" ? "jp" : "en"))}>
              <GlobeIcon /> <span>{t.language}: {lang === "en" ? "EN" : "JP"}</span>
            </button>
            <button
              className="sheet-btn danger"
              onClick={() => {
                if (window.confirm(t.clearConfirm)) {
                  setLines([]);
                  setShowSheet(false);
                }
              }}
              disabled={!lines.length}
            >
              <CrosshairIcon /> <span>{t.clear}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
