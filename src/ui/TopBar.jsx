// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + SVG icons
// [v1.16] Send-to-Studio handoff
// [v1.18] Bottom action bar
// [v2.00] Full UI redesign: glass top bar, floating dock, bottom sheet.
//         Nothing removed — advanced controls are HIDDEN in the sheet.

import { useContext, useState, useEffect } from "react";
import { WorkspaceContext } from "../workspace/WorkspaceContext";
import { SunIcon, MoonIcon, GridIcon, CrosshairIcon, MagnifierIcon, RotateIcon, GlobeIcon, CheckIcon, SendToStudioIcon, PencilIcon, MoreIcon, CubeIcon, ListIcon, EraserIcon, MoveIcon, RedoIcon, PencilDrawIcon } from "./Icons";
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
    draw: "Draw",
    specFor: "Spec for new pipes",
    edit: "Edit",
    erase: "Erase",
    move: "Move",
    undo: "Undo",
    redo: "Redo",
    cancelDraw: "Cancel line",
    done: "Done",
    studio: "Studio",
    workshop: "Workshop",
    cutList: "Cut list",
    glRef: "GL plane",
    glEdit: "Datums (GL / FL)",
    glDrag: "Drag handles",
    jointMarks: "Fitting marks (L / T)",
    detail: "Detail",
    detailFull: "Full",
    detailNormal: "Normal",
    detailEco: "Eco",
    detailNote: "Eco drops 3D labels and lightens the model.",
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
    draw: "作図",
    specFor: "次の配管の仕様",
    edit: "編集",
    erase: "消去",
    move: "移動",
    undo: "戻す",
    redo: "やり直し",
    cancelDraw: "作図を中止",
    done: "完了",
    studio: "スタジオ",
    workshop: "作業場",
    cutList: "材料表",
    glRef: "GL 面",
    glEdit: "基準面 (GL / FL)",
    glDrag: "ハンドルで調整",
    jointMarks: "継手記号 (L / T)",
    detail: "表示量",
    detailFull: "詳細",
    detailNormal: "標準",
    detailEco: "軽量",
    detailNote: "軽量は3Dの表記を省き、モデルを軽くします。",
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
    drawing,
    cancelDraw,
    undo,
    redo,
    canUndo,
    canRedo,
    setShowWorkshop,
    setShowCutList,
    showGL,
    setShowGL,
    showJointMarks,
    setShowJointMarks,
    detail,
    setDetail,
    glEditPlane,
    setGlEditPlane,
    setShowGlSheet,
    currentSpec,
    setShowSpecSheet
  } = useContext(WorkspaceContext);

  const [showSheet, setShowSheet] = useState(() => new URLSearchParams(window.location.search).has("more"));
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
        <div className="top-actions">
          <button className="top-btn" onClick={undo} disabled={!canUndo} aria-label={t.undo}>
            <RotateIcon />
          </button>
          <button className="top-btn" onClick={redo} disabled={!canRedo} aria-label={t.redo}>
            <RedoIcon />
          </button>
          <button
            className={"top-btn" + (showGrid ? " on" : "")}
            onClick={() => setShowGrid((g) => !g)}
            aria-label={t.grid}
          >
            <GridIcon />
          </button>
          <button
            className="top-btn"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={t.theme}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* v2.25 Workshop lives on its own, off the crowded dock */}
      <button
        className="workshop-fab"
        onClick={() => setShowWorkshop(true)}
        disabled={!lines.length}
      >
        <CubeIcon />
        <span>{t.workshop}</span>
      </button>

      {drawing && (
        <button className="draw-cancel" onClick={cancelDraw}>
          ✕ {t.cancelDraw}
        </button>
      )}

      {/* v2.00 floating dock: only the actions used constantly while drawing */}
      <div className="dock">
        <button
          className={"dock-btn" + (!editMode && !eraseMode && !moveMode ? " glow" : "")}
          onClick={() => { setEditMode(false); setEraseMode(false); setMoveMode(false); }}
        >
          <PencilDrawIcon />
          <span>{t.draw}</span>
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
        <button className="dock-btn" onClick={() => setShowSheet(true)}>
          <MoreIcon />
          <span>{t.more}</span>
        </button>
      </div>

      {/* v2.00 bottom sheet: everything else lives here, hidden not deleted */}
      {showSheet && (
        <div className="sheet-backdrop" onClick={() => setShowSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-scroll">
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
              onClick={() => { setShowSheet(false); setShowSpecSheet(true); }}
            >
              <PencilIcon />
              <span>{t.specFor}</span>
              <span className="sheet-value">
                {currentSpec
                  ? `${currentSpec.a}A ${currentSpec.material === "SGP" ? "SGP" : currentSpec.material} ${currentSpec.conn}`
                  : "100A SGP BW"}
              </span>
            </button>
            <button
              className="sheet-btn"
              onClick={() => { setShowSheet(false); setShowCutList(true); }}
              disabled={!lines.length}
            >
              <ListIcon /> <span>{t.cutList}</span>
            </button>
            <div className="sheet-row">
              <span>{t.detail}</span>
              <div className="seg-group">
                {[["full", t.detailFull], ["normal", t.detailNormal], ["eco", t.detailEco]].map(
                  ([value, label]) => (
                    <button
                      key={value}
                      className={"seg-btn" + (detail === value ? " on" : "")}
                      onClick={() => setDetail(value)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="sheet-hint">{t.detailNote}</div>
            <button className="sheet-btn" onClick={() => setShowJointMarks(!showJointMarks)}>
              <PencilIcon /> <span>{t.jointMarks}</span> {showJointMarks && <CheckIcon />}
            </button>
            <button className="sheet-btn" onClick={() => setShowGL(!showGL)}>
              <GridIcon /> <span>{t.glRef}</span> {showGL && <CheckIcon />}
            </button>
            <button
              className="sheet-btn"
              onClick={() => { setShowSheet(false); setShowGlSheet(true); }}
            >
              <PencilIcon /> <span>{t.glEdit}</span>
            </button>
            <button className="sheet-btn" onClick={sendToStudio}>
              <SendToStudioIcon /> <span>{t.studio}</span>
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

            <div className="sheet-actions">
              <button className="sheet-action solid" onClick={() => setShowSheet(false)}>
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
