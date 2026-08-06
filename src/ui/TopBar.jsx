// [v1.10] Initial TopBar with grid, theme, magnifier toggles
// [v1.13] Simplified: theme toggle + settings dropdown only
// [v1.14] Auto-detect language (EN/JP) + SVG icons
// [v1.16] Send-to-Studio handoff
// [v1.18] Bottom action bar
// [v2.00] Full UI redesign: glass top bar, floating dock, bottom sheet.
//         Nothing removed — advanced controls are HIDDEN in the sheet.

import { useContext, useState, useEffect, useRef } from "react";
import { WorkspaceContext } from "../workspace/WorkspaceContext";
import { HandIcon, ZoomIcon, ExpandIcon, ShrinkIcon } from "./Icons";                              // v2.58 one-handed drafting
import { LABEL_FIELDS, LABEL_TEXT } from "../workspace/utils/labelFields"; // v2.51
import { ISO_YAW, ISO_PITCH } from "../workspace/workshop/pipe3d";        // v2.55 the home tilt
import { SunIcon, MoonIcon, GridIcon, CrosshairIcon, MagnifierIcon, RotateIcon, GlobeIcon, CheckIcon, SendToStudioIcon, PencilIcon, MoreIcon, CubeIcon, ListIcon, EraserIcon, MoveIcon, RedoIcon, PencilDrawIcon, SelectIcon, TurnLeftIcon, TurnRightIcon, OrbitIcon, CompassIcon } from "./Icons";
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
    select: "Select",
    viewOrbit: "Orbit — drag to turn",
    viewLeft: "Turn left",
    viewTurn: "Turn a quarter",
    viewRight: "Turn right",
    viewBelow: "From below",
    viewHome: "Home view",
    viewing: "Viewing — tap to return",
    move: "Move",
    undo: "Undo",
    redo: "Redo",
    cancelDraw: "Cancel line",
    done: "Done",
    studio: "Studio",
    workshop: "Workshop",
    dims: "3D dimensions",
    drop: "Drop to floor",
    full: "Full screen",
    exitFull: "Show controls",
    exitWorkshop: "Close 3D",
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
    gDrawing: "Drawing",
    gLabels: "Labels",
    gView: "View",
    gDatums: "Datums",
    gApp: "App",
    hand: "Hand",
    zoomTool: "Zoom",
    labels: "Run labels",
    labelNote: "Tap a label with Move to slide it; double-tap to send it home.",
    labelAvoid: "Keep labels apart",
    labelStyle: "Label angle",
    labelAlong: "Along the line",
    labelLevel: "Horizontal",
    labelStyleNote: "Horizontal is the traditional reading; along the line keeps a busy sketch clear.",
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
    select: "選択",
    viewOrbit: "自由回転 — ドラッグ",
    viewLeft: "左に回す",
    viewTurn: "90度回す",
    viewRight: "右に回す",
    viewBelow: "下から見る",
    viewHome: "標準視点",
    viewing: "閲覧中 — タップで戻る",
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
    gDrawing: "図面",
    gLabels: "ラベル",
    gView: "表示",
    gDatums: "基準面",
    gApp: "アプリ",
    hand: "移動",
    zoomTool: "拡大",
    labels: "配管ラベル",
    labelNote: "移動ツールでラベルをドラッグ、ダブルタップで元の位置へ。",
    labelAvoid: "ラベルの重なりを避ける",
    labelStyle: "ラベルの向き",
    labelAlong: "線に沿う",
    labelLevel: "水平",
    labelStyleNote: "水平が従来の読み方。線に沿わせると図面が混みません。",
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
    viewTool, setViewTool, fitToView, selectAll, clearSelection,
    selectMode,
    setSelectMode,
    drawing,
    cancelDraw,
    undo,
    redo,
    canUndo,
    canRedo,
    showWorkshop, setShowWorkshop,
    showDims, setShowDims, showDrop, setShowDrop,
    immersive, setImmersive,
    setShowCutList,
    showGL,
    setShowGL,
    showJointMarks,
    setShowJointMarks,
    view,
    setView,
    homeView,
    orbitMode,
    setOrbitMode,
    detail,
    setDetail,
    glEditPlane,
    setGlEditPlane,
    setShowGlSheet,
    currentSpec,
    setShowSpecSheet,
    labelFields, setLabelFields, labelAvoid, setLabelAvoid, labelFlat, setLabelFlat,
  } = useContext(WorkspaceContext);

  const [showSheet, setShowSheet] = useState(() => new URLSearchParams(window.location.search).has("more"));
  const [lang, setLang] = useState(detectLanguage);
  // v2.74 A second tap on a tool asks it to do its whole job at once:
  // Select takes everything, Move brings the drawing back to the middle.
  const lastDock = useRef({ name: "", at: 0 });
  const doubleTap = (name, action) => {
    const now = Date.now();
    if (lastDock.current.name === name && now - lastDock.current.at < 400) {
      lastDock.current = { name: "", at: 0 };
      action();
      return true;
    }
    lastDock.current = { name, at: now };
    return false;
  };

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
        <span className="brand">
          ハイカンパニック!
        </span>
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

      {/* v2.47 View controls sit with Workshop, under the top bar, the way
          a CAD viewport keeps its orbit buttons together.
          v2.66 They are for the sketch only: in 3D the model turns under
          your finger, so buttons for it would be a second way to do one
          thing. */}
      <div className="view-tools">
        <button
          className={"view-btn" + (orbitMode ? " on" : "")}
          onClick={() => setOrbitMode(!orbitMode)}
          aria-label={t.viewOrbit}
        >
          <OrbitIcon />
        </button>
        {/* v2.87 One turn button, and it says where you are standing. Two
            identical curved arrows told you nothing about the view; a
            compass that points the way the model faces, with the angle
            written under it, does. Free orbit is the button beside it. */}
        <button
          className="view-btn"
          onClick={() => setView((v) => ({ ...v, yawDeg: v.yawDeg + 90 }))}
          aria-label={t.viewTurn}
        >
          <CompassIcon deg={view.yawDeg - 45} />
          <span className="view-tag">{Math.round(((view.yawDeg % 360) + 360) % 360)}°</span>
        </button>
        {/* v2.55 No plan button. An isometric already shows what rises and
            what drops, so a top or bottom view is a different drawing, not a
            viewpoint of this one — straight down it collapses a standpipe to
            a dot. Turning the model is the whole of what this needs. */}
      </div>

      {/* v2.25 Workshop lives on its own, off the crowded dock.
          v2.66 Once you are inside it, the same corner offers the two things
          that still make sense there: all the glass, or the way out. */}
      <button
        className="workshop-fab"
        onClick={() => setShowWorkshop(true)}
        disabled={!lines.length}
      >
        <CubeIcon />
        <span>{t.workshop}</span>
      </button>

      {!homeView && (
        <button className="view-badge" onClick={() => { setView({ yawDeg: 45, pitchDeg: 35.264 }); setOrbitMode(false); }}>
          {t.viewing}
        </button>
      )}

      {drawing && (
        <button className="draw-cancel" onClick={cancelDraw}>
          ✕ {t.cancelDraw}
        </button>
      )}

      {/* v2.00 floating dock: only the actions used constantly while drawing */}
      <div className="dock">
        <button
          className={"dock-btn" + (!editMode && !eraseMode && !moveMode && !selectMode && !viewTool ? " glow" : "")}
          onClick={() => { setEditMode(false); setEraseMode(false); setMoveMode(false); setSelectMode(false); setViewTool(null); }}
        >
          <PencilDrawIcon />
          <span>{t.draw}</span>
        </button>
        <button
          className={"dock-btn" + (editMode ? " glow" : "")}
          onClick={() => { setEditMode(!editMode); setViewTool(null); setEraseMode(false); setMoveMode(false); setSelectMode(false); }}
          disabled={!lines.length}
        >
          <PencilIcon />
          <span>{t.edit}</span>
        </button>
        <button
          className={"dock-btn" + (eraseMode ? " danger-glow" : "")}
          onClick={() => { setEraseMode(!eraseMode); setViewTool(null); setEditMode(false); setMoveMode(false); setSelectMode(false); }}
          disabled={!lines.length}
        >
          <EraserIcon />
          <span>{t.erase}</span>
        </button>
        <button
          className={"dock-btn" + (selectMode ? " glow" : "")}
          onClick={() => {
            if (doubleTap("select", selectAll)) return;
            if (selectMode) clearSelection();          // v2.76 second tap empties it
            setSelectMode(!selectMode); setViewTool(null);
            setEditMode(false);
            setEraseMode(false);
            setMoveMode(false);
          }}
          disabled={!lines.length}
        >
          <SelectIcon />
          <span>{t.select}</span>
        </button>
        <button
          className={"dock-btn" + (moveMode ? " glow" : "")}
          onClick={() => {
            if (doubleTap("move", fitToView)) return;
            setMoveMode(!moveMode); setViewTool(null);
            setEditMode(false); setEraseMode(false); setSelectMode(false);
          }}
          disabled={!lines.length}
        >
          <MoveIcon />
          <span>{t.move}</span>
        </button>
        {/* v2.59 Hand and Zoom share one slot: tap to slide the sheet, tap
            again to scale it, tap once more to put the tool down. */}
        <button
          className={"dock-btn" + (viewTool ? " glow" : "")}
          onClick={() => {
            setViewTool(viewTool === "pan" ? "zoom" : (viewTool === "zoom" ? null : "pan"));
            setEditMode(false); setEraseMode(false); setMoveMode(false); setSelectMode(false);
          }}
        >
          {viewTool === "zoom" ? <ZoomIcon /> : <HandIcon />}
          <span>{viewTool === "zoom" ? t.zoomTool : t.hand}</span>
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
            <div className="sheet-group">{t.gDrawing}</div>
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
            <button
              className="sheet-btn"
              onClick={() => setView({ yawDeg: ISO_YAW, pitchDeg: ISO_PITCH })}
              disabled={homeView}
            >
              <CrosshairIcon /> <span>{t.viewHome}</span>
            </button>
            <div className="sheet-group">{t.gLabels}</div>
            {/* v2.51 A label says only what this job needs it to say. */}
            <div className="sheet-row">
              <span>{t.labels}</span>
              <div className="seg-group wrap">
                {LABEL_FIELDS.map((field) => (
                  <button
                    key={field}
                    className={"seg-btn" + (labelFields[field] ? " on" : "")}
                    onClick={() => setLabelFields((f) => ({ ...f, [field]: !f[field] }))}
                  >
                    {LABEL_TEXT[lang === "jp" ? "jp" : "en"][field]}
                  </button>
                ))}
              </div>
            </div>
            <div className="sheet-row">
              <span>{t.labelStyle}</span>
              <div className="seg-group">
                <button
                  className={"seg-btn" + (labelFlat ? "" : " on")}
                  onClick={() => setLabelFlat(false)}
                >
                  {t.labelAlong}
                </button>
                <button
                  className={"seg-btn" + (labelFlat ? " on" : "")}
                  onClick={() => setLabelFlat(true)}
                >
                  {t.labelLevel}
                </button>
              </div>
            </div>
            <div className="sheet-hint">{t.labelStyleNote}</div>
            <div className="sheet-hint">{t.labelNote}</div>
            <button className="sheet-btn" onClick={() => setLabelAvoid(!labelAvoid)}>
              <PencilIcon /> <span>{t.labelAvoid}</span> {labelAvoid && <CheckIcon />}
            </button>
            <div className="sheet-group">{t.gView}</div>
            <button className="sheet-btn" onClick={() => setShowDrop(!showDrop)}>
              <GridIcon /> <span>{t.drop}</span> {showDrop && <CheckIcon />}
            </button>
            <button className="sheet-btn" onClick={() => setShowJointMarks(!showJointMarks)}>
              <PencilIcon /> <span>{t.jointMarks}</span> {showJointMarks && <CheckIcon />}
            </button>
            <button className="sheet-btn" onClick={() => setShowGL(!showGL)}>
              <GridIcon /> <span>{t.glRef}</span> {showGL && <CheckIcon />}
            </button>
            <div className="sheet-group">{t.gDatums}</div>
            <button
              className="sheet-btn"
              onClick={() => { setShowSheet(false); setShowGlSheet(true); }}
            >
              <PencilIcon /> <span>{t.glEdit}</span>
            </button>
            <div className="sheet-group">{t.gApp}</div>
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
