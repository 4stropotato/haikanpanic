// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + SVG icons
// [v1.16] Send-to-Studio handoff
// [v1.18] Bottom action bar
// [v2.00] Full UI redesign: glass top bar, floating dock, bottom sheet.
//         Nothing removed — advanced controls are HIDDEN in the sheet.

import { useContext, useState, useEffect } from "react";
import { WorkspaceContext } from "../workspace/WorkspaceContext";
import { SunIcon, MoonIcon, GridIcon, CrosshairIcon, MagnifierIcon, RotateIcon, GlobeIcon, CheckIcon, SendToStudioIcon, PencilIcon, MoreIcon, CubeIcon, ListIcon, EraserIcon, MoveIcon } from "./Icons";
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
    erase: "Erase",
    move: "Move",
    undo: "Undo",
    studio: "Studio",
    workshop: "Workshop",
    cutList: "Cut list",
    glRef: "GL plane",
    glArea: "Area",
    glCont: "Continuous",
    glSize: "Plane size",
    glAuto: "auto",
    glHeight: "Datum height",
    glDrag: "Drag handles",
    glReset: "Reset plane",
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
    erase: "消去",
    move: "移動",
    undo: "戻す",
    studio: "スタジオ",
    workshop: "作業場",
    cutList: "材料表",
    glRef: "GL 面",
    glArea: "範囲",
    glCont: "連続",
    glSize: "面のサイズ",
    glAuto: "自動",
    glHeight: "基準面の高さ",
    glDrag: "ハンドルで調整",
    glReset: "面をリセット",
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
    setEditMode,
    eraseMode,
    setEraseMode,
    moveMode,
    setMoveMode,
    setShowWorkshop,
    setShowCutList,
    showGL,
    setShowGL,
    glContinuous,
    setGlContinuous,
    glSizeMm,
    setGlSizeMm,
    glOffsetMm,
    setGlOffsetMm,
    glEditPlane,
    setGlEditPlane,
    resetGlPlane,
    setShowGlSheet
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
          onClick={() => { setEditMode(!editMode); setEraseMode(false); setMoveMode(false); }}
          disabled={!lines.length}
        >
          <PencilIcon />
          <span>{t.edit}</span>
        </button>
        <button
          className={"dock-btn" + (eraseMode ? " danger-glow" : "")}
          onClick={() => { setEraseMode(!eraseMode); setEditMode(false); setMoveMode(false); }}
          disabled={!lines.length}
        >
          <EraserIcon />
          <span>{t.erase}</span>
        </button>
        <button
          className={"dock-btn" + (moveMode ? " glow" : "")}
          onClick={() => { setMoveMode(!moveMode); setEditMode(false); setEraseMode(false); }}
          disabled={!lines.length}
        >
          <MoveIcon />
          <span>{t.move}</span>
        </button>
        <button
          className="dock-btn primary"
          onClick={() => setShowWorkshop(true)}
          disabled={!lines.length}
        >
          <CubeIcon />
          <span>{t.workshop}</span>
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
            <button
              className="sheet-btn"
              onClick={() => { setShowSheet(false); setShowCutList(true); }}
              disabled={!lines.length}
            >
              <ListIcon /> <span>{t.cutList}</span>
            </button>
            <button className="sheet-btn" onClick={() => setShowGL(!showGL)}>
              <GridIcon /> <span>{t.glRef}</span> {showGL && <CheckIcon />}
            </button>
            {showGL && (
              <>
                <div className="sheet-row">
                  <div className="seg-group">
                    <button
                      className={"seg-btn" + (glContinuous ? "" : " on")}
                      onClick={() => setGlContinuous(false)}
                    >
                      {t.glArea}
                    </button>
                    <button
                      className={"seg-btn" + (glContinuous ? " on" : "")}
                      onClick={() => setGlContinuous(true)}
                    >
                      {t.glCont}
                    </button>
                  </div>
                </div>
                {!glContinuous && (
                  <>
                    <div className="sheet-row">
                      <span>{t.glSize}</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        placeholder={t.glAuto}
                        value={glSizeMm || ""}
                        onChange={(e) => setGlSizeMm(Math.max(0, Number(e.target.value) || 0))}
                      />
                      <span>mm</span>
                    </div>
                    <button
                      className="sheet-btn"
                      onClick={() => { setShowSheet(false); setShowGlSheet(true); }}
                    >
                      <PencilIcon /> <span>{t.glHeight}</span>
                    </button>
                    <button
                      className="sheet-btn"
                      onClick={() => { setGlEditPlane(!glEditPlane); setShowSheet(false); }}
                    >
                      <CrosshairIcon /> <span>{t.glDrag}</span> {glEditPlane && <CheckIcon />}
                    </button>
                    <button className="sheet-btn" onClick={resetGlPlane}>
                      <RotateIcon /> <span>{t.glReset}</span>
                    </button>
                  </>
                )}
              </>
            )}
            <button className="sheet-btn" onClick={sendToStudio}>
              <SendToStudioIcon /> <span>{t.studio}</span>
            </button>
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
