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
import { LABEL_FIELDS, LABEL_TEXT, LABEL_PRESETS, PRESET_TEXT, presetOf } from "../workspace/utils/labelFields"; // v2.51
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
    surfaces: "Edit surfaces only",
    duplicate: "Duplicate selection",
    axisUp: "Rise",
    axisTurn: "Turn",
    axisLen: "Length",
    axisFree: "Free",
    pipes: "Show pipes",
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
    preset: "Preset",
    labelStyle: "Label angle",
    labelAlong: "Along the line",
    labelLevel: "Horizontal",
    labelStyleNote: "Horizontal is the traditional reading; along the line keeps a busy sketch clear.",
    scale: "Scale: 1 pt =",
    step: "Setting-out step",
    clear: "Clear all",
    clearConfirm: "Delete all lines?",
    keepIt: "Keep",
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
    preset: "プリセット",
    labelStyle: "ラベルの向き",
    labelAlong: "線に沿う",
    labelLevel: "水平",
    labelStyleNote: "水平が従来の読み方。線に沿わせると図面が混みません。",
    scale: "縮尺: 1 pt =",
    step: "作図ステップ",
    clear: "全消去",
    clearConfirm: "全ての線を削除しますか？",
    keepIt: "残す",
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
    stepMm,
    setStepMm,
    setMmPerPoint,
    editMode,
    setEditMode,
    eraseMode,
    setEraseMode,
    moveMode,
    setMoveMode,
    viewTool, setViewTool, fitToView, selectAll, selectRuns, clearSelection, clearAll, duplicate,
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
    surfaceOnly, setSurfaceOnly, heightMode, setHeightMode, showPipes, setShowPipes,
    lockAxis, setLockAxis,
    currentSpec,
    setShowSpecSheet,
    labelFields, setLabelFields, labelAvoid, setLabelAvoid, labelFlat, setLabelFlat,
  } = useContext(WorkspaceContext);

  const clearHold = useRef(null);
  const holdFrom = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [showSheet, setShowSheet] = useState(() => new URLSearchParams(window.location.search).has("more"));
  const [lang, setLang] = useState(detectLanguage);
  // v2.74 A second tap on a tool asks it to do its whole job at once:
  // Select takes everything, Move brings the drawing back to the middle.
  // v3.07 Taps in quick succession widen the reach: two takes the runs,
  // three takes the surfaces with them.
  const lastDock = useRef({ name: "", at: 0, count: 0 });
  const holdTimer = useRef(null);
  const multiTap = (name, actions) => {
    const now = Date.now();
    const run = lastDock.current.name === name && now - lastDock.current.at < 450;
    const count = run ? lastDock.current.count + 1 : 1;
    lastDock.current = { name, at: now, count };
    const action = actions[count];
    if (action) { action(); return true; }
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
          {/* v4.09 The build, where it can be read without opening anything.
              Which version is on screen decided whether a bug report was about
              the code or about a tab that had not reloaded, and guessing that
              cost days. */}
          <span className="brand-build">{__BUILD__}</span>
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
          {/* v3.24 With the orbit unclamped the tilt matters as much as the
              bearing: straight down is a plan, straight up is a soffit, and
              past the vertical you are reading the drawing from behind. */}
          <span className="view-tag">
            {/* v3.44 Where the camera stands, in the terms a fitter reads:
                the bearing it is looking along and how far above or below the
                work it sits. Turned far enough it is easy to lose which way
                is which, and a number settles it. */}
            {(() => {
              const bearing = Math.round(((view.yawDeg % 360) + 360) % 360);
              const p = ((view.pitchDeg % 360) + 360) % 360;
              const tilt = p > 180 ? p - 360 : p;
              if (tilt > 85 && tilt < 95) return "TOP";
              if (tilt < -85 && tilt > -95) return "BTM";
              const updown = tilt >= 0 ? "↑" : "↓";
              return `${bearing}° ${updown}${Math.abs(Math.round(tilt))}°`;
            })()}
          </span>
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

      {/* v3.45 Hold Move and the three directions of the drawing appear, so
          the axis is picked and visible rather than guessed from the first
          twitch of the finger. */}
      {heightMode && (
        <div className="axis-lock">
          {[
            ["up", "↕", t.axisUp],
            ["turn", "⤿", t.axisTurn],
            ["len", "⟷", t.axisLen],
            ["free", "✥", t.axisFree],
          ].map(([key, glyph, label]) => (
            <button
              key={key}
              className={"axis-btn" + (lockAxis === key ? " on" : "")}
              onClick={() => setLockAxis(lockAxis === key ? null : key)}
            >
              <span className="axis-glyph">{glyph}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
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
        {/* v4.30 Hold Erase to clear the sheet. Erasing one run and clearing
            the lot are the same intent at different sizes, so they share a key
            — and because the big one has nothing behind it, it asks first. A
            hold is deliberate in a way a tap is not, which is what matters on
            a phone in a pocket. */}
        <button
          className={"dock-btn" + (eraseMode ? " danger-glow" : "")}
          // FIXED v4.31 — "hindi gumagana yung erase button di napipindot"
          // CAUSE: the hold grabbed the pointer with setPointerCapture and
          //   never gave it back, so the tap that follows was never delivered
          //   and the button went dead. The capture bought nothing: a timer
          //   started on press and cleared on release is the whole gesture.
          // GUARD: do not capture a pointer you are not going to track.
          // FIXED v4.35 — "hindi gumagana yung hold ng erase"
          // CAUSE: the hold was cancelled before it could finish. A finger
          //   never rests still, so pointerleave fired on the smallest wobble,
          //   and iOS raises pointercancel the moment it decides the press
          //   might be a scroll. Between them the timer almost never survived
          //   650ms.
          // A hold tolerates a wobble — it is cancelled by real movement, and
          //   the button refuses the browser's gestures so there is nothing for
          //   it to take the press away for.
          // GUARD: on a touchscreen, treat leaving and cancelling as noise;
          //   measure the finger instead.
          onPointerDown={(e) => {
            holdFrom.current = { x: e.clientX, y: e.clientY };
            clearHold.current = setTimeout(() => {
              clearHold.current = null;
              if (!lines.length) return;
              if (navigator.vibrate) navigator.vibrate(20);
              setConfirmClear(true);
            }, 650);
          }}
          onPointerMove={(e) => {
            const from = holdFrom.current;
            if (!clearHold.current || !from) return;
            if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 16) {
              clearTimeout(clearHold.current); clearHold.current = null;
            }
          }}
          onPointerUp={() => { if (clearHold.current) { clearTimeout(clearHold.current); clearHold.current = null; } }}
          onClick={() => {
            if (confirmClear) return;                 // the hold already spoke
            setEraseMode(!eraseMode); setViewTool(null); setEditMode(false);
            setMoveMode(false); setSelectMode(false);
          }}
          disabled={!lines.length}
        >
          <EraserIcon />
          <span>{t.erase}</span>
        </button>
        <button
          className={"dock-btn" + (selectMode ? " glow" : "")}
          onClick={() => {
            if (multiTap("select", { 2: selectRuns, 3: selectAll })) return;
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
          className={"dock-btn" + (moveMode ? (heightMode ? " danger-glow" : " glow") : "")}
          onPointerDown={() => {
            // v3.08 hold Move to lift: the drag then changes height alone
            holdTimer.current = setTimeout(() => {
              setHeightMode(true);
              setMoveMode(true);
              setEditMode(false); setEraseMode(false); setSelectMode(false);
            }, 500);
          }}
          onPointerUp={() => clearTimeout(holdTimer.current)}
          onPointerLeave={() => clearTimeout(holdTimer.current)}
          onClick={() => {
            if (heightMode) { setHeightMode(false); setLockAxis(null); return; }
            if (multiTap("move", { 2: fitToView })) return;
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
      {/* v4.30 Clearing the sheet is the one action with nothing behind it, so
          it is the one that asks. */}
      {confirmClear && (
        <div className="modal on" onClick={(e) => { if (e.target === e.currentTarget) setConfirmClear(false); }}>
          <div className="sheet">
            <h2>{t.clear}</h2>
            <div className="hint">{t.clearConfirm}</div>
            <div className="btnrow" style={{ marginTop: "14px" }}>
              <button id="cancelBtn" onClick={() => setConfirmClear(false)}>{t.keepIt}</button>
              <button
                id="delBtn"
                style={{ flex: 1 }}
                onClick={() => { clearAll(); setConfirmClear(false); }}
              >
                {t.clear}
              </button>
            </div>
          </div>
        </div>
      )}
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
            {/* v4.29 How fine a point can be set out, apart from the grid that
                is drawn. The lattice stays the lattice; this is the step. */}
            <div className="sheet-row">
              <span>{t.step}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={stepMm}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isFinite(value) && value > 0) setStepMm(value);
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
              <span>{t.preset}</span>
              <div className="seg-group">
                {Object.keys(LABEL_PRESETS).map((name) => (
                  <button
                    key={name}
                    className={"seg-btn" + (presetOf(labelFields) === name ? " on" : "")}
                    onClick={() => setLabelFields({ ...LABEL_PRESETS[name] })}
                  >
                    {PRESET_TEXT[lang === "jp" ? "jp" : "en"][name]}
                  </button>
                ))}
              </div>
            </div>

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
            <button className="sheet-btn" onClick={() => setShowPipes(!showPipes)}>
              <PencilDrawIcon /> <span>{t.pipes}</span> {showPipes && <CheckIcon />}
            </button>
            <button className="sheet-btn" onClick={() => setShowGL(!showGL)}>
              <GridIcon /> <span>{t.glRef}</span> {showGL && <CheckIcon />}
            </button>
            <div className="sheet-group">{t.gDatums}</div>
            <button className="sheet-btn" onClick={() => { duplicate(); setShowSheet(false); }}>
              <SelectIcon /> <span>{t.duplicate}</span>
            </button>
            <button className="sheet-btn" onClick={() => setSurfaceOnly(!surfaceOnly)}>
              <GridIcon /> <span>{t.surfaces}</span> {surfaceOnly && <CheckIcon />}
            </button>
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
                  clearAll();
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
            {/* v3.98 Which build is actually on screen. A stale bundle looks
                exactly like a bug, and a screenshot could not tell them apart. */}
            <div className="sheet-row" style={{ opacity: 0.55, fontSize: ".72rem" }}>
              <span>build</span>
              <span>{__BUILD__}</span>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
