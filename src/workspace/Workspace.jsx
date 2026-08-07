// [v1.01] Initial layout, theming, and grid toggles
// [v1.02] Touch drawing and snapping logic
// [v1.03] Angle snap to 6 isometric directions
// [v1.04] Tap + hold UX flow for mobile input
// [v1.05] Magnifier toggle and workspace ref for capture
// [v1.07] Real-time magnifier system
// [v1.08] Lens follows snap point
// [v1.09] Pinch-to-zoom and panning logic
// [v1.10] Modularized workspace architecture with context and utility-driven snapping
// [v1.11] Magnifier modes (auto/follow/center) and hold state tracking
// [v1.15] Endpoint snapping - snap to existing line endpoints (green elbow indicator)

import { useRef, useState, useEffect, useMemo } from "react";                         // [v1.01] React hooks
import IsoGrid from "./grid/IsoGrid";                                       // [v1.10] isometric grid module
import DrawLayer from "./draw/DrawLayer";                                   // [v1.02] line drawing layer
import SnapOverlay from "./snap/SnapOverlay";                               // [v1.01] snapping crosshair overlay
import Magnify from "./magnify/Magnify";                                    // [v1.07] real-time magnifier lens
import TopBar from "../ui/TopBar";                                          // [v1.10] top control bar
import EditSheet from "../ui/EditSheet";                                    // v2.02 spec editor sheet
import CutList from "../ui/CutList";                                        // v2.07 材料表
import Workshop from "./workshop/Workshop";                                 // v2.02 3D pipes view
import { WorkspaceContext } from "./WorkspaceContext";                      // [v1.10] shared state context
import {
  snapToAllowedAngle, snapToNearestGrid, snapWorkspaceToGrid,
} from "./utils/geometry";                                                  // [v1.10] math utilities
import {
  nodeElevations, jointAngles, projectedNodes, runMetrics,
  ISO_YAW, ISO_PITCH,
  viewDeltas,                                                            // v2.54 drag in the view on screen
} from "./workshop/pipe3d";                                                // v2.16 freeze height on move
import {
  findSegmentAt, setSegmentLength, connectedIndices, overlappingRuns,
} from "./utils/editLength";                                                // v1.19+ tap-to-edit lengths
import { segmentLengthMm, dropDegenerate } from "./utils/lengths";          // v1.19+ current mm for prompt
import { viewport, observeViewport } from "./utils/viewport";               // v1.19+ tap coord conversion
import {
  glPlaneGeometry, sizeFromHandle, insidePlane,
  viewRect, clampHandle, planeAxes, isoCoords, planeVerticalExtent,                                                    // v2.62 reachable grips
} from "./utils/glPlane";                                                   // v2.09 datum plane
import { pipeSpec, material } from "./data/jis";                                      // v2.82 the floor rule
import GlSheet from "../ui/GlSheet";
import LevelSheet from "../ui/LevelSheet";
import AngleSheet from "../ui/AngleSheet";
import { isoDeltaTo3D, horizontalTo2D } from "./utils/handoff"; // v2.53 plan angles
import { loadDatums, saveDatums, makeDatum, datumFor } from "./utils/datums";
import { loadLabelFields, LABEL_HOME } from "./utils/labelFields";                    // v2.51 label contents
import { findJointAt, jointSettingOf } from "./utils/joints";               // v2.10 corner fittings
import JointSheet from "../ui/JointSheet";
import { zoomMin, zoomMax, pointStep } from "./utils/constants";                       // [v1.10] zoom range constants
import "./Workspace.css";                                                   // [v1.10] workspace layout styles

export default function Workspace() {
  const workspaceRef = useRef(null);                                        // [v1.05] DOM ref for workspace
  const [darkMode, setDarkMode] = useState(true);                           // [v1.01] dark mode toggle
  const [showGrid, setShowGrid] = useState(true);                           // [v1.01] toggle grid
  const [showMagnifier, setShowMagnifier] = useState(false);               // [v1.05] toggle magnifier
  const [magnifyMode, setMagnifyMode] = useState("auto");                  // [v1.11] "auto" | "follow" | "center"
  const [hideCrosshair, setHideCrosshair] = useState(false);               // [v1.05] hide crosshair for screenshot

  const [zoom, setZoom] = useState(1);                                      // [v1.09] current zoom level
  const [offset, setOffset] = useState({ x: 0, y: 0 });                      // [v1.09] pan offset
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });                    // [v1.08] magnifier lens position
  const [lastSnap, setLastSnap] = useState(null);                           // [v1.02] current snap point
  const [startPoint, setStartPoint] = useState(
    () => (new URLSearchParams(window.location.search).has("drawing") ? { x: 0, y: 0 } : null),
  );                                                                        // [v1.02] starting point for drawing
  const [lines, setLines] = useState(() => {                                // [v1.17] persisted line segments
    if (new URLSearchParams(window.location.search).has("demo")) {
      // v1.17+ deterministic sample sketch for tests/screenshots
      const s = 11.547;
      const c30 = Math.cos(-Math.PI / 6);
      const s30 = Math.sin(-Math.PI / 6);
      const a = { x: 0, y: 0 };
      const b = { x: 0, y: -10 * s };
      const c = { x: 20 * c30 * s, y: b.y + 20 * s30 * s };
      const d = { x: c.x + 12 * c30 * s, y: c.y + 12 * s30 * s };
      return [
        { start: a, end: b, lengthMm: 620, spec: { a: 100, conn: "BW", flange: "start" } },
        { start: b, end: c, lengthMm: 1500, spec: { a: 100, conn: "BW" } },
        {
          start: c,
          end: d,
          lengthMm: 800,
          spec: { a: 50, conn: "BW", flange: "end", material: "SUS304TP", schedule: "Sch10S" },
          ...(new URLSearchParams(window.location.search).has("slope") ? { elev2Mm: 1400 } : {}),
        },
      ];
    }
    try {
      return dropDegenerate(JSON.parse(localStorage.getItem("haikan-lines-v1")) ?? []);
    } catch {
      return [];
    }
  });
  const [mmPerPoint, setMmPerPoint] = useState(() => {                      // [v1.17] scale: 1 dot step = X mm
    const stored = Number(localStorage.getItem("haikan-scale-mmpp"));
    return Number.isFinite(stored) && stored > 0 ? stored : 100;
  });
  const [previewLine, setPreviewLine] = useState(null);                     // [v1.02] live preview line
  const [readyToDraw, setReadyToDraw] = useState(
    () => new URLSearchParams(window.location.search).has("drawing"),
  );                                                                        // [v1.02] whether in draw mode
  const [isHolding, setIsHolding] = useState(false);                        // [v1.11] track touch hold state for magnifier
  const [editMode, setEditMode] = useState(false);                          // v1.19+ tap segments to edit lengths
  // v3.23 A drawn run carries a spec from the start. It defaulted to none,
  // so a new sketch had pipes with no size at all — and turning the Size
  // label on showed nothing, because there was nothing to show. The sheet
  // already claimed "100A SGP BW" as the default; now the data agrees.
  const [currentSpec, setCurrentSpec] = useState(() => {                    // v2.31 spec for new pipes
    const fallback = {
      a: 100,
      conn: "BW",
      flange: "none",
      material: "SGP",
      schedule: material("SGP").defaultSchedule,
      gap: material("SGP").gap,
    };
    try {
      return JSON.parse(localStorage.getItem("haikan-spec-v1")) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const [showSpecSheet, setShowSpecSheet] = useState(false);
  const [editTarget, setEditTarget] = useState(() => {                      // v2.02 segment being edited
    const seed = new URLSearchParams(window.location.search).get("edit");
    return seed === null ? null : Number(seed);
  });
  const [eraseMode, setEraseMode] = useState(false);                        // v2.08 tap a line to delete it
  const [moveMode, setMoveMode] = useState(() => new URLSearchParams(window.location.search).has("move")); // v2.16 drag runs across the ground
  const [datumSel, setDatumSel] = useState([]);                             // v2.81 picked datums
  const [selectMode, setSelectMode] = useState(false);                      // v2.37 its own tool
  // v2.59 One dock slot holds both view gestures: a phone has no room for
  // eight tools, and pan and zoom are the same job — moving the paper.
  const [viewTool, setViewTool] = useState(null);                           // null | "pan" | "zoom"
  const [selection, setSelection] = useState([]);                           // v2.29 selected line indices
  const [marquee, setMarquee] = useState(null);                             // v2.29 rubber band box
  const [moveReadout, setMoveReadout] = useState(null);                     // v2.32 X / Y / EL while dragging
  const marqueeRef = useRef(null);
  const [past, setPast] = useState([]);                                     // v2.17 undo stack
  const [future, setFuture] = useState([]);                                 // v2.17 redo stack
  const pipeDrag = useRef(null);
  const levelDrag = useRef(null);
  const labelDrag = useRef(null);
  const panDrag = useRef(null);
  const zoomDrag = useRef(null);
  const translate = useRef(null);           // v2.61 projection offset, per viewpoint
  const viewStamp = useRef(null);
  const labelAnchors = useRef([]);          // v2.52 filled by DrawLayer after de-overlap
  const lastLabelTap = useRef({ index: -1, at: 0 });
  const [levelTarget, setLevelTarget] = useState(null);                     // v2.39 EL being typed
  const [angleTarget, setAngleTarget] = useState(null);                     // v2.43 slope being typed
  const [jointTypes, setJointTypes] = useState(() => {                      // v2.10 corner fittings
    const demoJoint = new URLSearchParams(window.location.search).get("joint");
    if (demoJoint) {                                                        // seed for screenshots
      const s2 = 11.547;
      return { [`${(0).toFixed(3)},${(-10 * s2).toFixed(3)}`]: demoJoint };
    }
    try {
      return JSON.parse(localStorage.getItem("haikan-joints-v1")) ?? {};
    } catch {
      return {};
    }
  });
  const [jointTarget, setJointTarget] = useState(() => {                    // ?joint2=1 opens the picker
    if (!new URLSearchParams(window.location.search).has("joint2")) return null;
    const s2 = 11.547;
    const point = { x: 0, y: -12 * s2 };
    return {
      key: `${point.x.toFixed(3)},${point.y.toFixed(3)}`,
      point,
      legs: [{ index: 0, which: 2 }, { index: 1, which: 1 }],
    };
  });
  const [showCutList, setShowCutList] = useState(() => new URLSearchParams(window.location.search).has("cutlist")); // v2.07 材料表 sheet
  const [showGL, setShowGL] = useState(                                     // v2.07 GL/EL in 2D
    () => localStorage.getItem("haikan-show-gl") === "1",                   // v3.03 off until asked for
  );
  const [view, setView] = useState({ yawDeg: ISO_YAW, pitchDeg: ISO_PITCH }); // v2.46 look from elsewhere
  const [orbitMode, setOrbitMode] = useState(false);                        // v2.48 drag to turn
  const orbitDrag = useRef(null);
  const [detail, setDetail] = useState(                                     // v2.33 full / normal / eco
    () => new URLSearchParams(window.location.search).get("detail")
      || localStorage.getItem("haikan-detail") || "normal",
  );
  const [labelFields, setLabelFields] = useState(loadLabelFields);          // v2.51 label contents
  const [labelAvoid, setLabelAvoid] = useState(                             // v2.56 keep labels apart
    () => localStorage.getItem("haikan-label-avoid") !== "0",
  );
  const [labelFlat, setLabelFlat] = useState(                               // v2.57 directional or level
    () => localStorage.getItem("haikan-label-flat") === "1",
  );
  const [elOffsets, setElOffsets] = useState(() => {                        // v2.57 moved EL callouts
    try {
      return JSON.parse(localStorage.getItem("haikan-el-offsets")) ?? {};
    } catch { return {}; }                     // a stale value is not worth a crash
  });
  const [showJointMarks, setShowJointMarks] = useState(                     // v2.26 L/T circles
    () => localStorage.getItem("haikan-joint-marks") === "on",             // v3.03 off until asked for
  );
  const [showGlSheet, setShowGlSheet] = useState(() => new URLSearchParams(window.location.search).has("gl"));
  const [datums, setDatums] = useState(loadDatums);                         // v2.19 GL / FL / TOS list
  const [datumIndex, setDatumIndex] = useState(0);                          // which one the sheet edits
  // v3.02 Surfaces only. Setting out a floor means dragging grips that sit
  // among the pipes, and one missed grab moves a run instead. This locks
  // everything but the datums.
  // v3.12 Surface view. A floor plan crowded with pipe is hard to set out
  // from, and a pipe run is hard to read through three slabs — so either can
  // be taken off the sheet without losing it.
  const [showPipes, setShowPipes] = useState(
    () => localStorage.getItem("haikan-show-pipes") !== "0",
  );
  const [surfaceOnly, setSurfaceOnly] = useState(false);
  // v3.08 Height only. Raising a whole pipeline is a routine change — the
  // run stays where it is on plan and only its level moves — and doing it
  // by dragging risks sliding it sideways at the same time.
  const [heightMode, setHeightMode] = useState(false);
  const [glEditPlane, setGlEditPlane] = useState(false);                    // v2.09 drag handles on
  const planeDrag = useRef(null);
  const [immersive, setImmersive] = useState(false);                        // v2.66 3D with no chrome
  const [showDrop, setShowDrop] = useState(                                 // v2.96 projection to datum
    () => localStorage.getItem("haikan-drop") === "1",                     // v3.03 off until asked for
  );
  const [showDims, setShowDims] = useState(true);                           // v2.64 3D dimension labels
  const [showWorkshop, setShowWorkshop] = useState(() => new URLSearchParams(window.location.search).has("workshop")); // v2.02 3D view toggle (?workshop=1 for tests)
  const [snappedEndpoint, setSnappedEndpoint] = useState(null);             // [v1.15] currently snapped endpoint

  const viewRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });              // v2.12 live view for native listeners
  const holdTimeout = useRef(null);                                         // [v1.04] long press timer
  const heldEnough = useRef(false);                                         // [v1.04] long press flag
  const lastTouch = useRef(null);                                           // [v1.09] pinch zoom tracker
  const pendingStart = useRef(null);                                        // [v1.04] pending start point
  const pendingStartExact = useRef(null);                                   // v2.31 exact endpoint if snapped
  const startExact = useRef(null);
  const pendingEnd = useRef(null);                                          // [v1.04] pending end point
  const confirmTapTimeout = useRef(null);                                   // [v1.04] tap confirmation timer
  const tapCount = useRef(0);                                               // [v1.04] double tap tracker

  useEffect(() => {
    document.body.setAttribute("data-theme", darkMode ? "dark" : "light");  // [v1.01] apply dark/light theme
  }, [darkMode]);

  useEffect(() => {
    observeViewport(workspaceRef.current);                                  // v2.11 size from the element
  }, []);

  useEffect(() => {
    viewRef.current = { zoom, offset };                                     // v2.12 keep the ref current
  }, [zoom, offset]);

  // v2.48 Drags follow the pointer even when it leaves the canvas, so a
  // gesture is never dropped halfway.
  useEffect(() => {
    const onMove = (e) => {
      if (orbitDrag.current) orbitMove(e.clientX, e.clientY);
      else if (panDrag.current) panMove(e.clientX, e.clientY);
      else if (zoomDrag.current) zoomMove(e.clientX, e.clientY);
      else if (labelDrag.current) labelMove(e.clientX, e.clientY);
      else if (levelDrag.current) levelMove(e.clientY);
      else if (pipeDrag.current) pipeMove(e.clientX, e.clientY);
      else if (planeDrag.current) planeMove(e.clientX, e.clientY);
      else if (marqueeRef.current) marqueeMove(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (marqueeRef.current) marqueeEnd();
      orbitDrag.current = null;
      panDrag.current = null;
      zoomDrag.current = null;
      labelDrag.current = null;
      levelDrag.current = null;
      pipeDrag.current = null;
      planeDrag.current = null;
      setMoveReadout(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  useEffect(() => {                                                         // v2.22 Escape abandons the line
    const onKey = (e) => { if (e.key === "Escape") cancelDraw(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (lastSnap) setLensPos(lastSnap);                                     // [v1.08] update magnifier position
  }, [lastSnap]);

  useEffect(() => {
    localStorage.setItem("haikan-lines-v1", JSON.stringify(lines));         // [v1.17] survive refresh/close
  }, [lines]);

  useEffect(() => {
    localStorage.setItem("haikan-scale-mmpp", String(mmPerPoint));          // [v1.17] persist scale
  }, [mmPerPoint]);

  useEffect(() => {
    localStorage.setItem("haikan-label-fields", JSON.stringify(labelFields)); // v2.51 label contents
  }, [labelFields]);

  useEffect(() => {
    localStorage.setItem("haikan-label-avoid", labelAvoid ? "1" : "0");     // v2.56
  }, [labelAvoid]);

  useEffect(() => {
    localStorage.setItem("haikan-label-flat", labelFlat ? "1" : "0");       // v2.57
  }, [labelFlat]);

  useEffect(() => {
    localStorage.setItem("haikan-drop", showDrop ? "1" : "0");              // v2.96
  }, [showDrop]);

  useEffect(() => {
    localStorage.setItem("haikan-show-gl", showGL ? "1" : "0");             // v3.03
  }, [showGL]);

  useEffect(() => {
    localStorage.setItem("haikan-show-pipes", showPipes ? "1" : "0");       // v3.12
  }, [showPipes]);

  useEffect(() => {
    // v3.01 The fitting marks read their setting from storage but nothing
    // ever wrote it, so turning them off lasted until the next reload and
    // looked like a switch that did nothing.
    localStorage.setItem("haikan-joint-marks", showJointMarks ? "on" : "off");
  }, [showJointMarks]);

  useEffect(() => {
    localStorage.setItem("haikan-el-offsets", JSON.stringify(elOffsets));   // v2.57
  }, [elOffsets]);

  // v2.19 Fit a plane to the drawing once, when it is first created. After
  // that it holds its footprint, so drawing or dragging a pipe never moves
  // the ground under the work.
  useEffect(() => {
    if (!lines.length) return;
    const pending = datums.findIndex((d) => !d.fitted);
    if (pending < 0) return;
    const plane = glPlaneGeometry(lines, mmPerPoint, { ...datums[pending], projection, view });
    if (!plane) return;
    const toMm = (half) => Math.max(500, Math.round(((half * 2) / plane.pxPerMm) / 500) * 500);
    setDatums((list) => list.map((d, i) => (i === pending
      ? {
        ...d,
        sizeMm: toMm(plane.halfU),
        sizeVMm: toMm(plane.halfV),
        // pin the centre too, or the plane drifts with the drawing every
        // time a pipe is moved
        center: { x: plane.cx, y: plane.cy },
        fitted: true,
      }
      : d)));
  }, [lines.length, datums, mmPerPoint]);

  useEffect(() => {
    saveDatums(datums);                                                     // v2.19 persist every level
  }, [datums]);

  // v2.12 Zoom about a screen anchor. Without this the view always zoomed
  // toward the centre and whatever you were looking at slid away.
  const zoomAbout = (clientX, clientY, nextZoomRaw) => {
    const { zoom: z0, offset: o0 } = viewRef.current;
    const safeRaw = Number.isFinite(nextZoomRaw) ? nextZoomRaw : z0;
    const nextZoom = Math.min(zoomMax, Math.max(zoomMin, safeRaw));
    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    const wx = (clientX - cx - o0.x) / z0;                                  // point under the anchor
    const wy = (clientY - cy - o0.y) / z0;
    const nextOffset = {
      x: clientX - cx - (wx * nextZoom),
      y: clientY - cy - (wy * nextZoom),
    };
    viewRef.current = { zoom: nextZoom, offset: nextOffset };
    setZoom(nextZoom);
    setOffset(nextOffset);
  };

  useEffect(() => {
    const el = workspaceRef.current;
    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      zoomAbout(e.clientX, e.clientY, viewRef.current.zoom * factor);       // [v1.09] mouse wheel zoom
    };
    el?.addEventListener("wheel", handleWheel, { passive: false });
    return () => el?.removeEventListener("wheel", handleWheel);
  }, []);

  // v2.22 Abandon a line that was started by accident. Double-tap already
  // did this, but nothing on screen said so, so a stray tap left the app
  // waiting for an end point with no obvious way out.
  const cancelDraw = () => {
    setStartPoint(null);
    setPreviewLine(null);
    setReadyToDraw(false);
    pendingStart.current = null;
    pendingStartExact.current = null;
    startExact.current = null;
    pendingEnd.current = null;
    clearTimeout(confirmTapTimeout.current);
  };

  // v2.17 Every edit goes through here so undo restores the whole sketch —
  // drawing, erasing, moving and spec changes alike — instead of only
  // dropping the last line.
  const commitLines = (next) => {
    setPast((stack) => [...stack.slice(-49), lines]);
    setFuture([]);
    setLines(dropDegenerate(next));
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((stack) => [...stack, lines]);
    setLines(past[past.length - 1]);
    setPast((stack) => stack.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((stack) => [...stack, lines]);
    setLines(future[future.length - 1]);
    setFuture((stack) => stack.slice(0, -1));
  };

  // v2.09 workspace-space point from a client coordinate
  const toWorkspace = (clientX, clientY) => ({
    x: (clientX - (viewport.w / 2 + offset.x)) / zoom,
    y: (clientY - (viewport.h / 2 + offset.y)) / zoom,
  });

  // v2.40 The sketch is the input; the model is the truth; the drawing shows
  // the model. Once a run slopes, where it is drawn and where it can be
  // touched both have to come from the solved geometry, not the raw sketch.
  // v2.54 the current viewpoint, as the two conversions a drag needs
  const view3d = useMemo(() => viewDeltas(mmPerPoint, view), [mmPerPoint, view]);

  const projection = useMemo(
    () => {
      // v2.61 One translation per viewpoint, held while the drawing is
      // edited — otherwise moving a run drags every other run with it.
      const stamp = `${view.yawDeg},${view.pitchDeg},${mmPerPoint}`;
      if (viewStamp.current !== stamp) {
        viewStamp.current = stamp;
        translate.current = null;
      }
      const map = projectedNodes(lines, mmPerPoint, { view, translate: translate.current });
      if (!translate.current && map.translate) translate.current = map.translate;
      return map;
    },
    [lines, mmPerPoint, view],
  );
  const homeView = Math.abs(view.yawDeg - ISO_YAW) < 0.5
    && Math.abs(view.pitchDeg - ISO_PITCH) < 0.5;
  const ZOOM_MIN = 0.05;                                                      // v3.28 a whole site
const ZOOM_MAX = 6;

const nodeKey = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  const viewLines = useMemo(() => lines.map((line) => ({
    ...line,
    start: projection.get(nodeKey(line.start)) ?? line.start,
    end: projection.get(nodeKey(line.end)) ?? line.end,
  })), [lines, projection]);

  // v3.22 Where the drawing actually sits, so the turned grid can be built
  // around it instead of around the origin.
  // v3.31 How big the box has to be is a fact about the job, not about the
  // angle you are looking from. Measured in the view it exploded whenever
  // the box axes closed up on each other, so the grid grew without reason.
  const sketchSpan = useMemo(() => {
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
    const take = (pt) => {
      x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y);
      x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y);
    };
    for (const line of lines) { take(line.start); take(line.end); }
    // v3.33 A surface reaches as far as its own footprint and as low as its
    // own foot — both asked for now rather than guessed at from its size.
    for (const datum of datums) {
      if (datum.continuous) continue;
      const reach = Math.max(datum.sizeMm ?? 0, datum.sizeVMm ?? 0) / 2;
      if (reach > 0) {
        const px = (reach * pointStep) / mmPerPoint;
        take({ x: -px, y: -px }); take({ x: px, y: px });
      }
      const { bottomMm, topMm } = planeVerticalExtent(datum);
      const toPx = (mm) => (-mm * pointStep) / mmPerPoint;
      take({ x: 0, y: toPx(bottomMm) });
      take({ x: 0, y: toPx(topMm) });
    }
    // v3.39 Height counted in the world too. Taking it from the projected
    // bounds put the view back into the box's size — and near a level view
    // that extent collapses, so the box shrank as you tilted. Elevations and
    // surface feet are the same numbers from every angle.
    let low = 0;
    let high = 0;
    const els = lines.length ? nodeElevations(lines, mmPerPoint) : new Map();
    for (const el of els.values()) { low = Math.min(low, el); high = Math.max(high, el); }
    for (const datum of datums) {
      const { bottomMm, topMm } = planeVerticalExtent(datum);
      low = Math.min(low, bottomMm);
      high = Math.max(high, topMm);
    }
    const tall = ((high - low) * pointStep) / mmPerPoint;
    if (!Number.isFinite(x1)) return Math.max(pointStep * 8, tall / 2);
    return Math.max(pointStep * 4, (x2 - x1) / 2, (y2 - y1) / 2, tall / 2);
  }, [lines, datums, mmPerPoint]);

  const sketchBounds = useMemo(() => {
    if (!viewLines.length) return null;
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
    const take = (pt) => {
      x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y);
      x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y);
    };
    for (const line of viewLines) { take(line.start); take(line.end); }
    // v3.25 The surfaces are part of the work, so they count towards what
    // the grid has to cover. Measuring the pipes alone left a box a floor
    // could hang out of, and the grid stopped short of the drawing.
    if (showGL) {
      for (const datum of datums) {
        if (datum.continuous) continue;
        const plane = glPlaneGeometry(lines, mmPerPoint, { ...datum, projection, view });
        if (plane) plane.corners.forEach(take);
      }
    }
    return { x1, y1, x2, y2 };
  }, [viewLines, lines, datums, showGL, mmPerPoint, projection, view]);


  // v3.26 Two runs sharing a grid line is a fact about the sketch, not about
  // the view. Read from the projected lines it fired from any turned view —
  // and from straight above it always fires, because a run at EL 0 and one
  // at EL 2000 must overlap when seen from overhead. That is the projection
  // doing its job, not a mistake to warn about.
  const stacked = useMemo(() => overlappingRuns(lines), [lines]);
  const stackedCount = stacked.size;

  const jointInfo = (key) => jointAngles(lines, mmPerPoint, { jointTypes }).get(key);

  const primary = datums[0];
  const patchDatum = (i, patch) => setDatums(
    (list) => list.map((d, index) => (index === i ? { ...d, ...patch } : d)),
  );
  // v2.79 The plane turns with the view, so the hit test has to be handed
  // the same projection and viewpoint the renderer draws with — otherwise
  // you would be grabbing where the plane used to be.
  const planeAt = (i) => glPlaneGeometry(lines, mmPerPoint, { ...datums[i], projection, view });
  const currentPlane = () => planeAt(datumIndex);

  // v2.16 Move tool. A drag translates the whole welded run across the
  // ground plane. Screen movement is read as horizontal motion only, so the
  // run keeps its elevation — height is a number you type, not something a
  // sideways drag should change. The elevation is frozen on the anchor line
  // at grab time, because an unfrozen piece takes its height from where it
  // sits on screen.
  // v2.50 A label can be slid along its run and flipped to either side.
  // v2.58 The hand tool. Drafting in the field is done one-handed — the
  // other hand is on the tape — so sliding the sheet has to be a plain drag,
  // not a two-finger gesture.
  const panGrab = (clientX, clientY) => {
    if (viewTool !== "pan") return false;
    panDrag.current = { x: clientX, y: clientY, offset };
    return true;
  };

  const panMove = (clientX, clientY) => {
    const drag = panDrag.current;
    if (!drag) return false;
    setOffset({
      x: drag.offset.x + (clientX - drag.x),
      y: drag.offset.y + (clientY - drag.y),
    });
    return true;
  };

  // v2.59 Drag up to come closer, down to pull back, and the spot under the
  // finger stays put — you zoom into what you were already looking at.
  // v2.74 Fit the whole drawing on screen, centred so the origin marker and
  // the view turn about the same point the drawing is set out from.
  const fitToView = () => {
    // v2.80 With runs picked out, the gesture moves the PIPES to the middle
    // of the sheet rather than the eye: select all, then bring it home. The
    // shift is nudged onto the lattice so the drawing stays on the grid.
    if (selection.length) {
      let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
      for (const i of selection) {
        const line = lines[i];
        if (!line) continue;
        for (const pt of [line.start, line.end]) {
          x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y);
          x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y);
        }
      }
      if (!Number.isFinite(x1)) return;
      const shift = { x: -(x1 + x2) / 2, y: -(y1 + y2) / 2 };
      const first = lines[selection[0]];
      const ref = { x: first.start.x + shift.x, y: first.start.y + shift.y };
      const snapped = snapWorkspaceToGrid(ref);
      shift.x += snapped.x - ref.x;
      shift.y += snapped.y - ref.y;
      commitLines(lines.map((line, i) => (selection.includes(i) ? {
        ...line,
        start: { x: line.start.x + shift.x, y: line.start.y + shift.y },
        end: { x: line.end.x + shift.x, y: line.end.y + shift.y },
      } : line)));
      setOffset({ x: 0, y: 0 });
      return;
    }

    // v2.75 The origin is the centre of the sheet, so bringing the drawing
    // home means putting the red dot in the middle of the screen and pulling
    // back far enough to see everything around it — not centring the
    // drawing's own bounding box, which would leave the dot off to one side.
    setOffset({ x: 0, y: 0 });
    if (!viewLines.length) { setZoom(1); return; }
    let rx = 0;
    let ry = 0;
    for (const line of viewLines) {
      for (const pt of [line.start, line.end]) {
        rx = Math.max(rx, Math.abs(pt.x));
        ry = Math.max(ry, Math.abs(pt.y));
      }
    }
    // v3.28 Pull back far enough to see a whole job. A quarter scale was
    // barely two rooms; a site plan wants more, and the grid thins itself
    // now so the sheet stays readable however far out you go.
    setZoom(Math.max(ZOOM_MIN, Math.min(3, Math.min(
      (viewport.w * 0.42) / Math.max(rx, 1),
      (viewport.h * 0.30) / Math.max(ry, 1),
    ))));
  };

  const zoomGrab = (clientX, clientY) => {
    if (viewTool !== "zoom") return false;
    zoomDrag.current = { y: clientY, anchorX: clientX, anchorY: clientY, zoom, offset };
    return true;
  };

  const zoomMove = (clientX, clientY) => {
    const drag = zoomDrag.current;
    if (!drag) return false;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, drag.zoom * Math.exp((drag.y - clientY) * 0.006)));
    const applied = next / drag.zoom;
    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    setZoom(next);
    setOffset({
      x: ((drag.anchorX - cx) * (1 - applied)) + (drag.offset.x * applied),
      y: ((drag.anchorY - cy) * (1 - applied)) + (drag.offset.y * applied),
    });
    return true;
  };

  const labelGrab = (clientX, clientY) => {
    if (surfaceOnly) return false;                                         // v3.02 surfaces only
    if (!moveMode || !lines.length) return false;
    const point = toWorkspace(clientX, clientY);
    for (const anchor of labelAnchors.current) {
      if (Math.hypot(point.x - anchor.x, point.y - anchor.y) > 20 / zoom) continue;

      // v2.52 A second tap on a label puts it back where it belongs, which
      // is quicker than dragging it home by eye.
      const now = Date.now();
      const id = anchor.kind === "el" ? anchor.key : anchor.index;
      const tap = lastLabelTap.current;
      if (tap.index === id && now - tap.at < 400) {
        lastLabelTap.current = { index: -1, at: 0 };
        if (anchor.kind === "el") {
          setElOffsets(({ [anchor.key]: gone, ...rest }) => rest);
        } else {
          commitLines(lines.map((line, i) => {
            if (i !== anchor.index) return line;
            const { label, ...rest } = line;
            return rest;
          }));
        }
        return true;
      }
      lastLabelTap.current = { index: id, at: now };

      if (anchor.kind === "el") {
        // an EL callout is annotation, not geometry: moving it is not an
        // edit to the drawing, so it stays out of the undo stack
        labelDrag.current = {
          kind: "el",
          key: anchor.key,
          anchor,
          origin: point,
          place: elOffsets[anchor.key] ?? { along: anchor.homeAlong ?? 0.35, across: -5 },
        };
        return true;
      }

      setPast((stack) => [...stack.slice(-49), lines]);                    // v2.50 one entry per drag
      setFuture([]);
      labelDrag.current = {
        index: anchor.index,
        anchor,
        origin: point,
        place: lines[anchor.index].label ?? LABEL_HOME,
      };
      return true;
    }
    return false;
  };

  const labelMove = (clientX, clientY) => {
    const drag = labelDrag.current;
    if (!drag) return false;
    const point = toWorkspace(clientX, clientY);
    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;
    const { ux, uy, len, flip } = drag.anchor;
    const along = drag.place.along + ((((dx * ux) + (dy * uy)) * flip) / len);
    const across = drag.place.across + (((-dx * uy) + (dy * ux)) * flip * zoom);
    if (drag.kind === "el") {
      // the callout slides down its own leader and out to either side
      const lead = drag.anchor;
      const down = drag.place.along + (((dx * lead.leadX) + (dy * lead.leadY)) / len);
      setElOffsets((map) => ({
        ...map,
        [drag.key]: { along: Math.max(-0.2, Math.min(1.2, down)), across },
      }));
      return true;
    }
    setLines(lines.map((line, i) => (i === drag.index
      ? { ...line, label: { along: Math.max(-0.45, Math.min(0.45, along)), across } }
      : line)));
    return true;
  };

  // v2.38 An endpoint in Move mode is a level handle: dragging it up or
  // down sets that node's elevation, which makes the run slope between two
  // known levels instead of forcing the whole chain to move.
  const levelGrab = (clientX, clientY) => {
    if (surfaceOnly) return false;                                         // v3.02 surfaces only
    if (!moveMode || !lines.length) return false;
    const point = toWorkspace(clientX, clientY);
    const reach = 26 / zoom;
    const els = nodeElevations(lines, mmPerPoint);
    const base = primary?.offsetMm ?? 0;
    for (let i = 0; i < lines.length; i += 1) {
      for (const which of [1, 2]) {
        const sketchNode = which === 1 ? lines[i].start : lines[i].end;
        const key = nodeKey(sketchNode);
        const node = projection.get(key) ?? sketchNode;
        if (Math.hypot(point.x - node.x, point.y - node.y) > reach) continue;
        levelDrag.current = {
          index: i,
          which,
          startY: clientY,
          startEl: (els.get(key) ?? 0) + base,
        };
        return true;
      }
    }
    return false;
  };

  // v2.39 An EL callout sits just under its node; tapping there is how a
  // fitter would reach for the number itself.
  const levelLabelAt = (point) => {
    const els = nodeElevations(lines, mmPerPoint);
    const base = primary?.offsetMm ?? 0;
    const reach = 26 / zoom;
    for (let i = 0; i < lines.length; i += 1) {
      for (const which of [1, 2]) {
        const sketchNode = which === 1 ? lines[i].start : lines[i].end;
        const key = nodeKey(sketchNode);
        const node = projection.get(key) ?? sketchNode;
        const label = { x: node.x - (30 / zoom), y: node.y + (16 / zoom) };
        if (Math.hypot(point.x - label.x, point.y - label.y) > reach) continue;
        const el = (els.get(key) ?? 0) + base;
        if (Math.abs(el) < 1 && which === 1) continue;
        return { index: i, which, el };
      }
    }
    return null;
  };

  const levelMove = (clientY) => {
    const drag = levelDrag.current;
    if (!drag) return false;
    const raw = drag.startEl + ((drag.startY - clientY) / zoom) * view3d.risePerPx;
    const value = Math.round(raw / 10) * 10;
    const ref = datumFor(value, datums);
    setMoveReadout({
      x: null, y: null, el: value, datum: ref.name, rel: Math.round(value - ref.offsetMm),
    });
    setLines(lines.map((line, i) => (i === drag.index
      ? { ...line, [drag.which === 1 ? "elev1Mm" : "elev2Mm"]: value - (primary?.offsetMm ?? 0) }
      : line)));
    return true;
  };

  const pipeGrab = (clientX, clientY) => {
    if (surfaceOnly) return false;                                         // v3.02 surfaces only
    if (!moveMode || !lines.length) return false;
    const point = toWorkspace(clientX, clientY);
    const index = findSegmentAt(point, viewLines, 22 / zoom);
    if (index < 0) return false;
    setPast((stack) => [...stack.slice(-49), lines]);                       // one entry per drag
    setFuture([]);
    // v2.45 One pipe means one pipe. Dragging used to carry everything
    // welded to it, which on a finished sketch is the whole job. Use Select
    // when several runs should travel together.
    const members = selection.includes(index)
      ? new Set(selection)
      : new Set([index]);
    const anchorIndex = Math.min(...members);
    const elevations = nodeElevations(lines, mmPerPoint);
    const anchor = lines[anchorIndex];
    const anchorKey = `${anchor.start.x.toFixed(3)},${anchor.start.y.toFixed(3)}`;
    pipeDrag.current = {
      members,
      anchorIndex,
      elevationMm: anchor.elevationMm ?? (elevations.get(anchorKey) ?? 0),
      origin: point,
      base: lines.map((line) => ({ start: { ...line.start }, end: { ...line.end } })),
      baseLines: lines,
      datums: datumSel,
      datumBase: Object.fromEntries(datumSel.map((i) => {
        const plane = planeAt(i);
        return [i, plane ? { x: plane.cx, y: plane.cy } : null];
      })),
    };
    return true;
  };

  // v2.48 Orbit: tap the turn control, then drag — sideways spins the view,
  // up and down tips it. The same gesture a CAD viewport uses.
  const orbitStart = (clientX, clientY) => {
    // v3.21 The hand and the zoom outrank the orbit. Armed, the orbit took
    // every drag, so the sheet could not be slid once the view was turned.
    if (!orbitMode || viewTool) return false;
    orbitDrag.current = { x: clientX, y: clientY, yaw: view.yawDeg, pitch: view.pitchDeg };
    return true;
  };

  const orbitMove = (clientX, clientY) => {
    const drag = orbitDrag.current;
    if (!drag) return false;
    setView({
      yawDeg: drag.yaw + ((clientX - drag.x) * 0.4),
      // v3.24 No stops. The tilt was clamped because at 90 degrees every
      // vertical run collapses to a dot and the drawing stops making sense —
      // but refusing to go there is worse than going there and saying so.
      // The compass names the viewpoint, so straight down, straight up and
      // upside down are all reachable and all legible.
      pitchDeg: drag.pitch - ((clientY - drag.y) * 0.4),
    });
    return true;
  };

  const marqueeStart = (clientX, clientY) => {
    if (surfaceOnly) return false;                                         // v3.02 surfaces only
    if (!selectMode) return false;
    const point = toWorkspace(clientX, clientY);
    marqueeRef.current = { x0: point.x, y0: point.y, x1: point.x, y1: point.y };
    setMarquee(marqueeRef.current);
    return true;
  };

  const marqueeMove = (clientX, clientY) => {
    if (!marqueeRef.current) return false;
    const point = toWorkspace(clientX, clientY);
    marqueeRef.current = { ...marqueeRef.current, x1: point.x, y1: point.y };
    setMarquee(marqueeRef.current);
    return true;
  };

  const marqueeEnd = () => {
    const box = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    if (!box) return;
    const left = Math.min(box.x0, box.x1);
    const right = Math.max(box.x0, box.x1);
    const top = Math.min(box.y0, box.y1);
    const bottom = Math.max(box.y0, box.y1);
    // v2.78 A tap on empty space clears the selection only while Select is
    // the tool in hand. In Move it must not: the selection was made in order
    // to be moved, and a missed grab would otherwise throw it away.
    if (right - left < 6 / zoom && bottom - top < 6 / zoom) {
      if (selectMode) setSelection([]);
      return;
    }
    const inside = (p) => p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
    // v2.46 A box adds to what is already picked, so a selection can be
    // built up in as many passes as the job needs.
    const caught = viewLines.reduce((acc, line, i) => {
      if (inside(line.start) && inside(line.end)) acc.push(i);
      return acc;
    }, []);
    setSelection((current) => [...new Set([...current, ...caught])]);
  };

  const pipeMove = (clientX, clientY) => {
    const drag = pipeDrag.current;
    if (!drag) return false;
    const point = toWorkspace(clientX, clientY);
    const anchorBase = drag.base[drag.anchorIndex].start;
    // v2.54 The drag happens in the view on screen; the drawing is stored in
    // sketch space. Reading it back through the viewpoint is what keeps a
    // pull to the right going right after the model has been turned.
    const dxScreen = point.x - drag.origin.x;
    const dyScreen = point.y - drag.origin.y;

    // v3.09 Axis lock. Holding Move arms it; the first real movement picks
    // which of the drawing's three directions the drag belongs to — up the
    // screen is height, the other two are the ground axes — and it stays on
    // that one. A pipeline goes up, or along one axis, without wandering.
    if (heightMode) {
      const axes = planeAxes(view);
      if (!drag.lock && Math.hypot(dxScreen, dyScreen) > 6 / zoom) {
        const cast = [
          { name: "up", dir: { x: 0, y: 1 } },
          { name: "u", dir: axes.u },
          { name: "v", dir: axes.v },
        ].map((a) => {
          const len = Math.hypot(a.dir.x, a.dir.y) || 1;
          return { ...a, along: Math.abs(((dxScreen * a.dir.x) + (dyScreen * a.dir.y)) / len) };
        });
        drag.lock = cast.reduce((best, a) => (a.along > best.along ? a : best)).name;
      }
      if (!drag.lock) return true;

      if (drag.lock !== "up") {
        const dir = drag.lock === "u" ? axes.u : axes.v;
        const len = Math.hypot(dir.x, dir.y) || 1;
        const along = ((dxScreen * dir.x) + (dyScreen * dir.y)) / (len * len);
        const anchorBase2 = drag.base[drag.anchorIndex].start;
        const want = { x: anchorBase2.x + (dir.x * along), y: anchorBase2.y + (dir.y * along) };
        const put = snapWorkspaceToGrid(want);
        const sx = put.x - anchorBase2.x;
        const sy = put.y - anchorBase2.y;
        setLines(lines.map((line, i) => {
          if (!drag.members.has(i)) return line;
          const base = drag.base[i];
          return {
            ...line,
            start: { x: base.start.x + sx, y: base.start.y + sy },
            end: { x: base.end.x + sx, y: base.end.y + sy },
          };
        }));
        return true;
      }

      const rise = Math.round((-dyScreen * view3d.risePerPx) / 10) * 10;
      const els = nodeElevations(drag.baseLines ?? lines, mmPerPoint);
      setLines(lines.map((line, i) => {
        if (!drag.members.has(i)) return line;
        const base = drag.base[i];
        const at = (pt) => (els.get(nodeKey(pt)) ?? 0) + rise;
        return { ...line, elev1Mm: at(base.start), elev2Mm: at(base.end) };
      }));
      setMoveReadout({
        x: null, y: null, el: rise, datum: primary?.name ?? "GL", rel: rise,
      });
      return true;
    }
    const world = view3d.screenToWorld(dxScreen, dyScreen);
    const shift = horizontalTo2D(world.x, world.z, mmPerPoint / pointStep);
    const wanted = { x: anchorBase.x + shift.x, y: anchorBase.y + shift.y };
    let snapped = snapWorkspaceToGrid(wanted);                              // stay on the lattice

    // v2.95 Snap to what it lines up with. Two runs can share a plan
    // position and differ only in height — the case you cannot judge by eye
    // because a floor sits between them — so the drag settles onto another
    // node's plan position when it comes close. Both are already on the
    // lattice, so this never fights the grid rule.
    const pxPerMm = 1 / (view3d.risePerPx || 1);
    const els = nodeElevations(lines, mmPerPoint);
    const mineEl = drag.elevationMm ?? 0;
    const reach = 16 / zoom;
    let bestSnap = null;
    // v2.97 Either end of the run in hand can be the one that lines up, so
    // both are offered — otherwise only the start ever snapped and a run
    // dragged by its far end never settled onto anything.
    const anchorLine = drag.base[drag.anchorIndex];
    const ends = [
      { at: snapped, via: { x: 0, y: 0 } },
      {
        at: {
          x: snapped.x + (anchorLine.end.x - anchorLine.start.x),
          y: snapped.y + (anchorLine.end.y - anchorLine.start.y),
        },
        via: {
          x: -(anchorLine.end.x - anchorLine.start.x),
          y: -(anchorLine.end.y - anchorLine.start.y),
        },
      },
    ];
    lines.forEach((line, i) => {
      if (drag.members.has(i)) return;
      for (const node of [line.start, line.end]) {
        const theirEl = els.get(nodeKey(node)) ?? 0;
        const target = { x: node.x, y: node.y + ((theirEl - mineEl) * pxPerMm) };
        for (const end of ends) {
          const d = Math.hypot(target.x - end.at.x, target.y - end.at.y);
          if (d < reach && (!bestSnap || d < bestSnap.d)) {
            bestSnap = { target: { x: target.x + end.via.x, y: target.y + end.via.y }, d };
          }
        }
      }
    });
    if (bestSnap) snapped = bestSnap.target;
    const dx = snapped.x - anchorBase.x;
    const dy = snapped.y - anchorBase.y;
    // v2.32 Where the grabbed run has landed, so two pieces can be told
    // apart when they look identical on an isometric.
    const isoUx = Math.cos(-Math.PI / 6);
    const mmScale = mmPerPoint / pointStep;
    const moved = { x: anchorBase.x + dx, y: anchorBase.y + dy };
    setMoveReadout({
      x: Math.round(((moved.x / (2 * isoUx)) - moved.y) * mmScale),
      y: Math.round(((-moved.x / (2 * isoUx)) - moved.y) * mmScale),
      el: Math.round(drag.elevationMm + (primary?.offsetMm ?? 0)),
      datum: primary?.name ?? "GL",
      count: drag.members.size,
    });

    for (const i of drag.datums ?? []) {
      const base = drag.datumBase[i];
      if (base) patchDatum(i, { center: { x: base.x + dx, y: base.y + dy } });
    }
    setLines(lines.map((line, i) => {
      if (!drag.members.has(i)) return line;
      const base = drag.base[i];
      const moved = {
        ...line,
        start: { x: base.start.x + dx, y: base.start.y + dy },
        end: { x: base.end.x + dx, y: base.end.y + dy },
      };
      if (i === drag.anchorIndex) moved.elevationMm = drag.elevationMm;
      return moved;
    }));
    return true;
  };

  // v2.09 Plane editing: grab a corner or a side to resize, the face to move.
  const planeGrab = (clientX, clientY) => {
    if ((!glEditPlane && !moveMode && !surfaceOnly) || !lines.length) return false;
    const point = toWorkspace(clientX, clientY);
    const grabRadius = 22 / zoom;
    // v2.62 Grips are hit where they are actually drawn — pulled inside the
    // viewport when the plane runs off it. The slack keeps the size from
    // jumping when the grip is not sitting on its true corner.
    const rect = viewRect(viewport.w, viewport.h, zoom, offset);
    const grip = (plane, index, target, axis) => {
      const at = clampHandle(target, plane.cx, plane.cy, rect);
      if (Math.hypot(point.x - at.x, point.y - at.y) >= grabRadius) return false;
      setDatumIndex(index);
      // v2.97 A grip pulls its own side. Sizing from the centre grew both
      // edges at once, so a floor could never be extended in one direction
      // only — the opposite edge is held and the centre follows.
      const local = isoCoords(target, plane.cx, plane.cy, plane.axes);
      planeDrag.current = {
        mode: "resize",
        index,
        axis,
        cx: plane.cx,
        cy: plane.cy,
        axes: plane.axes,
        halfU: plane.halfU,
        halfV: plane.halfV,
        signA: Math.sign(local.a) || 1,
        signB: Math.sign(local.b) || 1,
        slack: { x: target.x - point.x, y: target.y - point.y },
      };
      return true;
    };

    // v2.72 Every datum on the job can be taken hold of, not just whichever
    // one the sheet happens to have selected — FL was uneditable for exactly
    // that reason. The one you grab becomes the one you are editing.
    const order = [datumIndex, ...datums.map((_, i) => i).filter((i) => i !== datumIndex)];
    for (const index of order) {
      if (datums[index]?.continuous) continue;
      const plane = planeAt(index);
      if (!plane) continue;
      for (const corner of plane.corners) if (grip(plane, index, corner, "both")) return true;
      for (const edge of plane.edges) if (grip(plane, index, edge.point, edge.axis)) return true;
      if (Math.hypot(point.x - plane.cx, point.y - plane.cy) < grabRadius) {
        setDatumIndex(index);
        planeDrag.current = {
          mode: "move", index, dx: plane.cx - point.x, dy: plane.cy - point.y,
        };
        return true;
      }
    }
    return false;
  };

  const planeMove = (clientX, clientY) => {
    const drag = planeDrag.current;
    if (!drag) return false;
    const point = toWorkspace(clientX, clientY);
    if (drag.mode === "resize") {
      const at = drag.slack
        ? { x: point.x + drag.slack.x, y: point.y + drag.slack.y }
        : point;
      const here = isoCoords(at, drag.cx, drag.cy, drag.axes);
      const scale = mmPerPoint / pointStep;
      const patch = { fitted: true };
      const shift = { a: 0, b: 0 };
      const pull = (now, sign, half, key) => {
        // the far edge stays where it is; this one goes where the finger is
        const fixed = -sign * half;
        const size = Math.max(Math.abs(now - fixed), pointStep);
        // size is already the full extent here — the old helper doubled a
        // half-extent, which would have made every plane twice as big
        patch[key] = Math.round((size / (pointStep / mmPerPoint)) / 50) * 50;
        return ((now + fixed) / 2);
      };
      if (drag.axis !== "v") shift.a = pull(here.a, drag.signA, drag.halfU, "sizeMm");
      if (drag.axis !== "u") shift.b = pull(here.b, drag.signB, drag.halfV, "sizeVMm");
      const moved = {
        x: drag.cx + (drag.axes.u.x * shift.a) + (drag.axes.v.x * shift.b),
        y: drag.cy + (drag.axes.u.y * shift.a) + (drag.axes.v.y * shift.b),
      };
      const ab = isoCoords(moved, 0, 0, planeAxes(view));
      patchDatum(drag.index ?? datumIndex, {
        ...patch, center: null, centerAB: { a: ab.a, b: ab.b },
      });
      // v2.65 A datum is a floor, and a floor is quoted by its span and its
      // area — the number the job actually needs while you drag.
      const target = datums[drag.index ?? datumIndex];
      const w = patch.sizeMm ?? target?.sizeMm ?? 0;
      const d = patch.sizeVMm ?? target?.sizeVMm ?? 0;
      setMoveReadout({
        plane: target?.name ?? "GL",
        w: Math.round(w),
        d: Math.round(d),
        area: (w / 1000) * (d / 1000),
      });
    } else {
      const centre = { x: point.x + drag.dx, y: point.y + drag.dy };
      // v3.05 Surfaces meet at their edges — a wall stands on the line where
      // the floor ends — so a plane being moved settles onto another's
      // corner when it comes close. Without it you are eyeballing a joint
      // that has an exact answer.
      const me = drag.index ?? datumIndex;
      const mine = planeAt(me);
      if (mine) {
        const reach = 18 / zoom;
        let best = null;
        datums.forEach((_, i) => {
          if (i === me || datums[i].continuous) return;
          const other = planeAt(i);
          if (!other) return;
          for (const a of mine.corners) {
            for (const b of other.corners) {
              const d = Math.hypot((a.x + centre.x - mine.cx) - b.x,
                (a.y + centre.y - mine.cy) - b.y);
              if (d < reach && (!best || d < best.d)) {
                best = { d, dx: b.x - (a.x + centre.x - mine.cx), dy: b.y - (a.y + centre.y - mine.cy) };
              }
            }
          }
        });
        if (best) { centre.x += best.dx; centre.y += best.dy; }
      }
      // stored along the axes so it turns with the drawing
      const ab = isoCoords(centre, 0, 0, planeAxes(view));
      patchDatum(me, { center: null, centerAB: { a: ab.a, b: ab.b } });
      const plane = planeAt(drag.index ?? datumIndex);
      // v2.70 A floor is set out from a datum like anything else on site, so
      // moving it quotes where its centre now stands.
      const isoUx = Math.cos(-Math.PI / 6);
      const mmScale = mmPerPoint / pointStep;
      setMoveReadout({
        plane: datums[drag.index ?? datumIndex]?.name ?? "GL",
        cx: Math.round(((centre.x / (2 * isoUx)) - centre.y) * mmScale),
        cy: Math.round(((-centre.x / (2 * isoUx)) - centre.y) * mmScale),
      });
    }
    return true;
  };

  const handleTouchMove = (e) => {
    if (orbitDrag.current && e.touches.length === 1) {
      e.preventDefault();
      orbitMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (panDrag.current && e.touches.length === 1) {
      e.preventDefault();
      panMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (zoomDrag.current && e.touches.length === 1) {
      e.preventDefault();
      zoomMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (labelDrag.current && e.touches.length === 1) {
      e.preventDefault();
      labelMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (levelDrag.current && e.touches.length === 1) {
      e.preventDefault();
      levelMove(e.touches[0].clientY);
      return;
    }
    if (pipeDrag.current && e.touches.length === 1) {
      e.preventDefault();
      pipeMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (marqueeRef.current && e.touches.length === 1) {
      e.preventDefault();
      marqueeMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (planeDrag.current && e.touches.length === 1) {
      e.preventDefault();
      planeMove(e.touches[0].clientX, e.touches[0].clientY);
      return;
    }
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const mid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (!lastTouch.current) {
        lastTouch.current = { mid, dist, zoom, offset };                    // [v1.09] track initial pinch
        return;
      }
      // v2.12 keep the workspace point that was under the pinch centre
      // pinned to the pinch centre as it moves and scales
      const start = lastTouch.current;
      const ratio = start.dist > 0 ? dist / start.dist : 1;
      const scaled = Number.isFinite(ratio) ? start.zoom * ratio : start.zoom;
      const newZoom = Math.min(zoomMax, Math.max(zoomMin, scaled));
      const cx = viewport.w / 2;
      const cy = viewport.h / 2;
      const wx = (start.mid.x - cx - start.offset.x) / start.zoom;
      const wy = (start.mid.y - cy - start.offset.y) / start.zoom;
      const newOffset = {
        x: mid.x - cx - (wx * newZoom),
        y: mid.y - cy - (wy * newZoom),
      };
      viewRef.current = { zoom: newZoom, offset: newOffset };
      setZoom(newZoom);
      setOffset(newOffset);
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && orbitStart(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.48 turning the view
    }
    if (e.touches.length === 1 && panGrab(e.touches[0].clientX, e.touches[0].clientY)) return;
    if (e.touches.length === 1 && zoomGrab(e.touches[0].clientX, e.touches[0].clientY)) return;
    if (e.touches.length === 1 && labelGrab(e.touches[0].clientX, e.touches[0].clientY)) return;
    if (e.touches.length === 1 && levelGrab(e.touches[0].clientX, e.touches[0].clientY)) {
      setPast((stack) => [...stack.slice(-49), lines]);                    // v2.38 one entry per drag
      setFuture([]);
      return;
    }
    if (e.touches.length === 1 && pipeGrab(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.16 dragging a run
    }
    if (e.touches.length === 1 && planeGrab(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.09 dragging the datum
    }
    if (e.touches.length === 1 && marqueeStart(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.29 rubber band
    }
    heldEnough.current = false;
    setIsHolding(true);                                                    // [v1.11] magnifier moves to top
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);                                                             // [v1.04] long press delay
  };

  const handleTouchEnd = () => {
    if (orbitDrag.current) { orbitDrag.current = null; return; }
    if (panDrag.current) { panDrag.current = null; return; }
    if (zoomDrag.current) { zoomDrag.current = null; return; }
    if (labelDrag.current) { labelDrag.current = null; return; }
    if (levelDrag.current) { levelDrag.current = null; setMoveReadout(null); return; }
    if (pipeDrag.current) { pipeDrag.current = null; setMoveReadout(null); return; }
    if (planeDrag.current) { planeDrag.current = null; setMoveReadout(null); return; }
    if (marqueeRef.current) { marqueeEnd(); return; }
    lastTouch.current = null;
    clearTimeout(holdTimeout.current);
    setIsHolding(false);                                                   // [v1.11] magnifier returns to crosshair
    if (!heldEnough.current) return;

    if (!readyToDraw && !startPoint) {
      // v2.31 Editing a length moves an endpoint off the lattice, so a new
      // run started "there" would snap to the nearest grid point instead and
      // silently fail to connect. Remember the exact endpoint when one is
      // under the finger.
      pendingStart.current = lastSnap;
      pendingStartExact.current = snappedEndpoint?.workspacePoint ?? null;
      confirmTapTimeout.current = setTimeout(() => (pendingStart.current = null), 5000);
    } else if (readyToDraw && startPoint) {
      pendingEnd.current = lastSnap;
      triggerDraw();
    }
  };

  const handleClick = (e) => {
    // v3.21 A turned view used to be read-only, because the drawing did not
    // sit on its grid there and nothing could be aimed at. It does now, and
    // every hit test already runs against the projected lines — so editing,
    // erasing and selecting work from any angle. Drawing is converted back
    // through the viewpoint below.
    if (moveMode) return;                                                  // v2.16 drags, not taps
    if (viewTool) return;                                                  // v2.58 the hand slides, never draws
    if (surfaceOnly) return;                                               // v3.02 surfaces only
    // v2.37 Select mode: a tap adds or removes one run from the selection.
    if (selectMode) {
      const point = {
        x: (e.clientX - (viewport.w / 2 + offset.x)) / zoom,
        y: (e.clientY - (viewport.h / 2 + offset.y)) / zoom,
      };
      const index = findSegmentAt(point, viewLines, 24 / zoom);
      if (index >= 0) {
        setSelection((current) => (current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index]));
        return;
      }
      // v2.81 A floor is part of the job too: tapping inside a datum picks
      // it, so GL and FL travel with the runs when the drawing is moved.
      for (let i = datums.length - 1; i >= 0; i -= 1) {
        if (datums[i].continuous) continue;
        const plane = planeAt(i);
        if (!plane || !insidePlane(point, plane)) continue;
        setDatumSel((current) => (current.includes(i)
          ? current.filter((k) => k !== i)
          : [...current, i]));
        return;
      }
      return;
    }

    // v2.08 Erase mode: a tap removes the nearest segment. The GL plane and
    // every derived number recompute from what is left.
    if (eraseMode) {
      const point = {
        x: (e.clientX - (viewport.w / 2 + offset.x)) / zoom,
        y: (e.clientY - (viewport.h / 2 + offset.y)) / zoom,
      };
      const index = findSegmentAt(point, viewLines, 24 / zoom);
      if (index >= 0) { commitLines(lines.filter((_, i) => i !== index)); return; }
      // v3.04 A surface is part of the drawing, so the eraser takes it too.
      // The last one stays: a job with no datum has nothing to measure from.
      if (datums.length > 1) {
        for (let i = datums.length - 1; i >= 0; i -= 1) {
          if (datums[i].continuous) continue;
          const plane = planeAt(i);
          if (!plane || !insidePlane(point, plane)) continue;
          setDatums(datums.filter((_, k) => k !== i));
          setDatumIndex((k) => Math.max(0, Math.min(k, datums.length - 2)));
          return;
        }
      }
      return;
    }

    // v1.19+ Edit mode: a tap selects the nearest segment and asks for its
    // true length in mm; the chain moves to match. Draw taps are suspended.
    if (editMode) {
      const point = {
        x: (e.clientX - (viewport.w / 2 + offset.x)) / zoom,
        y: (e.clientY - (viewport.h / 2 + offset.y)) / zoom,
      };
      // v2.43 a run's own label carries its angles; tapping there opens the
      // rise and the plan turn rather than the pipe spec
      const metrics = runMetrics(lines, mmPerPoint, { jointTypes });
      // v2.54 A label may have been dragged well clear of its run, so it is
      // looked for on its own before anything is tested against the pipe.
      const spot = labelAnchors.current
        .find((a) => a.index >= 0 && Math.hypot(point.x - a.x, point.y - a.y) < 30 / zoom);
      if (spot) {
        setAngleTarget({ index: spot.index, metric: metrics.get(spot.index) });
        return;
      }
      // v2.39 the height callout is editable where it is written
      const level = levelLabelAt(point);
      if (level) { setLevelTarget(level); return; }

      // a corner is a fitting decision; the run behind it is a pipe spec
      const joint = findJointAt(point, viewLines, 18 / zoom);       // v2.20 corners stay reachable
      if (joint) { setJointTarget(joint); return; }
      const index = findSegmentAt(point, viewLines, 24 / zoom);
      if (index >= 0) { setEditTarget(index); return; }                     // v2.02 open spec sheet
      // nothing drawn under the tap: whichever datum covers this spot owns it
      if (showGL) {
        for (let i = datums.length - 1; i >= 0; i -= 1) {
          if (datums[i].continuous) continue;
          const plane = planeAt(i);
          if (plane && insidePlane(point, plane)) {
            setDatumIndex(i);
            setShowGlSheet(true);
            return;
          }
        }
      }
      return;
    }
    // v3.21 Drawing still wants the home view. Editing only has to hit what
    // is already on screen, but a new run has to be created on the lattice —
    // and the snap chain (allowed angle, then nearest grid) still works in
    // screen terms. Routing that through the viewpoint is the next step;
    // until then a new line is placed where its geometry is unambiguous.
    if (!homeView) return;
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) return;

    if (!readyToDraw && pendingStart.current) {
      startExact.current = pendingStartExact.current;
      setStartPoint(pendingStart.current);
      setReadyToDraw(true);
      pendingStart.current = null;
      clearTimeout(confirmTapTimeout.current);
    } else if (readyToDraw && startPoint) {
      tapCount.current++;
      setTimeout(() => {
        if (tapCount.current === 2) cancelDraw();                          // v2.22 same path
        tapCount.current = 0;
      }, 300);                                                         // [v1.04] double-tap cancel
    }
  };

  const triggerDraw = () => {
    if (!startPoint || !pendingEnd.current) return;
    const angleSnapped = snapToAllowedAngle(startPoint, pendingEnd.current);         // [v1.03] lock direction
    // v1.15+ Use snapped endpoint if available, otherwise snap to grid
    const snappedStart = startExact.current
      ?? snapToNearestGrid(angleSnapped.start, zoom, offset);
    const snappedEnd = snappedEndpoint || snapToNearestGrid(angleSnapped.end, zoom, offset);
    const drawnPx = Math.hypot(snappedEnd.x - snappedStart.x, snappedEnd.y - snappedStart.y);
    if (drawnPx < pointStep * 0.5) { cancelDraw(); return; }                // v2.24 no 0mm pipes
    // v2.31 A new run takes the current spec. Asking for it after every
    // single line made chaining a run unbearable; the spec is a setting you
    // change when it changes, not a question per pipe.
    commitLines([...lines, {
      start: snappedStart,
      end: snappedEnd,
      ...(currentSpec ? { spec: { ...currentSpec } } : {}),
    }]);
    setStartPoint(null);
    setPreviewLine(null);
    setReadyToDraw(false);
    pendingEnd.current = null;
  };

  useEffect(() => {
    if (startPoint && lastSnap && readyToDraw) {
      const angleSnapped = snapToAllowedAngle(startPoint, lastSnap);
      const snappedStart = snapToNearestGrid(angleSnapped.start, zoom, offset);      // [v1.10] real-time preview
      const snappedEnd = snapToNearestGrid(angleSnapped.end, zoom, offset);
      setPreviewLine({ start: snappedStart, end: snappedEnd });
    }
  }, [lastSnap, startPoint, readyToDraw]);

  const contextValue = {
    darkMode,
    showGrid,
    showMagnifier,
    magnifyMode,                                                           // [v1.11] magnify mode state
    setDarkMode,
    setShowGrid,
    setShowMagnifier,
    setMagnifyMode,                                                        // [v1.11] magnify mode setter
    setZoom,
    setOffset,
    lines,                                                                 // [v1.16] drawn segments for Studio handoff
    setLines,                                                              // [v1.17] clear/undo from TopBar
    mmPerPoint,                                                            // [v1.17] scale setting
    setMmPerPoint,
    editMode,                                                              // v1.19+ edit-length mode
    setEditMode,
    eraseMode,                                                             // v2.08 erase mode
    setEraseMode,
    moveMode,                                                              // v2.16 move mode
    setMoveMode,
    viewTool,                                                              // v2.59 pan / zoom
    setViewTool,
    fitToView,                                                             // v2.74 double-tap Move
    selectAll: () => {
      setSelection(lines.map((_, i) => i));
      setDatumSel(datums.map((_, i) => i).filter((i) => !datums[i].continuous));
    },
    // v3.07 the runs on their own, when the surfaces should stay where they are
    selectRuns: () => {
      setSelection(lines.map((_, i) => i));
      setDatumSel([]);
    },
    selectMode,                                                            // v2.37 selection tool
    // v2.76 A selection outlives the tool that made it: you pick the runs,
    // then switch to Move to carry them. Clearing it on the way out meant
    // Move only ever took one pipe. Only tapping Select again empties it.
    setSelectMode,
    currentSpec,                                                           // v2.31 spec for new pipes
    setShowSpecSheet,
    selection,                                                             // v2.29 marquee selection
    clearSelection: () => { setSelection([]); setDatumSel([]); },
    // v3.34 Clearing means clearing. The surfaces are part of the drawing —
    // a floor set out for one job is wrong for the next — so they go with
    // the runs, back to a single GL to measure from.
    clearAll: () => {
      commitLines([]);
      setDatums([makeDatum("GL")]);
      setDatumIndex(0);
      setSelection([]);
      setDatumSel([]);
      setElOffsets({});
      setJointTypes({});
    },
    drawing: Boolean(startPoint && readyToDraw),                            // v2.22 line in progress
    cancelDraw,
    undo,                                                                  // v2.17 history
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    showWorkshop,                                                          // v2.02 open 3D view
    setShowWorkshop,
    immersive,                                                             // v2.66 chrome-free 3D
    setImmersive,
    showDrop,                                                              // v2.96 projection to datum
    setShowDrop,
    showDims,                                                              // v2.64 3D dimension labels
    setShowDims,
    setShowCutList,                                                        // v2.07 材料表
    showGL,
    setShowGL,
    view,                                                                  // v2.46 viewpoint
    setView,
    homeView,
    orbitMode,                                                             // v2.48 drag to turn
    setOrbitMode,
    labelFields,                                                           // v2.51 label contents
    setLabelFields,
    labelAvoid,                                                            // v2.56 keep labels apart
    setLabelAvoid,
    labelFlat,                                                             // v2.57 label orientation
    setLabelFlat,
    showJointMarks,                                                        // v2.26 fitting circles
    setShowJointMarks,
    detail,                                                                // v2.33 display detail
    setDetail,
    datums,
    glEditPlane,
    setGlEditPlane,
    setShowGlSheet,
    showPipes,                                                             // v3.12 surface view
    setShowPipes,
    surfaceOnly,                                                           // v3.02 lock everything but datums
    setSurfaceOnly,
    heightMode,                                                            // v3.08 lift only
    setHeightMode,
    resetDatum: () => setDatums(                                            // refit the primary
      (list) => list.map((d, i) => (i === 0 ? { ...d, fitted: false, sizeMm: 0, sizeVMm: 0, center: null } : d)),
    ),
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>     {/* [v1.10] global state context */}
      <div className="app">
        <TopBar />
        <div
          className="workspace"
          ref={workspaceRef}
          onMouseDown={(e) => orbitStart(e.clientX, e.clientY)
            || panGrab(e.clientX, e.clientY)
            || zoomGrab(e.clientX, e.clientY)
            || labelGrab(e.clientX, e.clientY)
            || levelGrab(e.clientX, e.clientY)
            || pipeGrab(e.clientX, e.clientY)
            || planeGrab(e.clientX, e.clientY)
            || marqueeStart(e.clientX, e.clientY)}
          onMouseMove={(e) => {
            if (orbitDrag.current) orbitMove(e.clientX, e.clientY);
            else if (panDrag.current) panMove(e.clientX, e.clientY);
            else if (zoomDrag.current) zoomMove(e.clientX, e.clientY);
            else if (labelDrag.current) labelMove(e.clientX, e.clientY);
      else if (levelDrag.current) levelMove(e.clientY);
            else if (pipeDrag.current) pipeMove(e.clientX, e.clientY);
            else if (planeDrag.current) planeMove(e.clientX, e.clientY);
            else if (marqueeRef.current) marqueeMove(e.clientX, e.clientY);
          }}
          onMouseUp={() => {
            orbitDrag.current = null;
            panDrag.current = null;
            zoomDrag.current = null;
      zoomDrag.current = null;
            labelDrag.current = null;
            levelDrag.current = null;
            pipeDrag.current = null;
            setMoveReadout(null);
            planeDrag.current = null;
            if (marqueeRef.current) marqueeEnd();
          }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <IsoGrid show={showGrid} zoom={zoom} offset={offset} view={view} bounds={sketchBounds} span={sketchSpan} />
          <DrawLayer
            lines={viewLines}
            projection={projection}
            preview={previewLine}
            isDark={darkMode}
            zoom={zoom}
            offset={offset}
            mmPerPoint={mmPerPoint}
            showGL={showGL}
            datums={datums}
            // v2.62 Grips show whenever the plane can be taken hold of, not
            // only while its sheet is open — an invisible control is no
            // control, which is why the plane never seemed resizable.
            activeDatum={showGlSheet || moveMode || glEditPlane || surfaceOnly ? datumIndex : -1}
            gripAll={moveMode || glEditPlane || surfaceOnly}
            showDrop={showDrop}
            showPipes={showPipes}
            view={view}
            glEditPlane={glEditPlane || moveMode}
            selectMode={selectMode}
            moveMode={moveMode}
            jointTypes={jointTypes}
            showJointMarks={showJointMarks}
            stacked={stacked}
            labelFields={labelFields}
            labelAvoid={labelAvoid}
            labelFlat={labelFlat}
            elOffsets={elOffsets}
            onLabelLayout={(list) => { labelAnchors.current = list; }}
            selection={selection}
            datumSel={datumSel}
            marquee={marquee}
          />
          {/* v2.68 The sketch's crosshair and lens have no business over the
              3D model: they drew on top of it and ate the drags the camera
              needed. Not rendered at all in Workshop — a z-index race is not
              worth running twice. */}
          {!hideCrosshair && !showWorkshop && (
            <SnapOverlay
              onSnapChange={setLastSnap}
              onEndpointSnap={setSnappedEndpoint}
              zoom={zoom}
              offset={offset}
              lines={lines}
            />
          )}
          {showMagnifier && !showWorkshop && <Magnify x={lensPos.x} y={lensPos.y} isHolding={isHolding} mode={magnifyMode} />}
        </div>
        {editTarget != null && lines[editTarget] && (
          <EditSheet
            line={lines[editTarget]}
            mmPerPoint={mmPerPoint}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            ends={(() => {
              const els = nodeElevations(lines, mmPerPoint);
              const key = (p2) => `${p2.x.toFixed(3)},${p2.y.toFixed(3)}`;
              const base = primary?.offsetMm ?? 0;
              return {
                start: (els.get(key(lines[editTarget].start)) ?? 0) + base,
                end: (els.get(key(lines[editTarget].end)) ?? 0) + base,
              };
            })()}
            datumName={primary?.name ?? "GL"}
            onClose={() => setEditTarget(null)}
            onApply={({ mm, a, conn, flange, material, schedule, gap, tone }) => {
              const next = setSegmentLength(lines, editTarget, mm, mmPerPoint);
              next[editTarget] = {
                ...next[editTarget],
                tone,                                                      // v2.83 mark-up colour
                spec: { a, conn, flange, material, schedule, gap },
              };
              commitLines(next);
              setCurrentSpec({ a, conn, flange, material, schedule, gap });
              setEditTarget(null);
            }}
          />
        )}
        {stackedCount > 0 && (
          <div className="stack-warn">
            ⚠ {stackedCount} runs share a grid line — move one across
          </div>
        )}
        {moveReadout?.plane && (
          <div className="move-readout">
            <strong>{moveReadout.plane}</strong>
            {moveReadout.w != null ? (
              <>
                {" "}{moveReadout.w} × {moveReadout.d} mm
                <span> · {moveReadout.area >= 1
                  ? `${moveReadout.area.toFixed(2)} m²`
                  : `${Math.round(moveReadout.area * 1e6).toLocaleString()} mm²`}</span>
              </>
            ) : (
              <span> X {moveReadout.cx} · Y {moveReadout.cy}</span>
            )}
          </div>
        )}
        {moveReadout && !moveReadout.plane && (
          <div className="move-readout">
            {moveReadout.x != null && `X ${moveReadout.x} · Y ${moveReadout.y} · `}
            {moveReadout.rel != null
              ? `${moveReadout.datum} ${moveReadout.rel >= 0 ? "+" : ""}${moveReadout.rel}`
              : `EL ${moveReadout.el >= 0 ? "+" : ""}${moveReadout.el}`}
            {moveReadout.rel == null && <span> {moveReadout.datum}</span>}
            {moveReadout.count > 1 && <span> · {moveReadout.count} runs</span>}
          </div>
        )}
        {angleTarget && (
          <AngleSheet
            horizontalMm={lines[angleTarget.index]?.lengthMm
              ?? segmentLengthMm(lines[angleTarget.index], mmPerPoint)}
            trueLengthMm={angleTarget.metric.trueLengthMm}
            slopeDeg={angleTarget.metric.slopeDeg}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setAngleTarget(null)}
            onApply={({ horizontalMm, riseMm, planTurnDeg }) => {
              if (!(horizontalMm > 0)) { setAngleTarget(null); return; }
              const els = nodeElevations(lines, mmPerPoint);
              const target = lines[angleTarget.index];
              const startEl = els.get(nodeKey(target.start)) ?? 0;
              let next = lines.map((line, i) => (i === angleTarget.index
                ? { ...line, lengthMm: horizontalMm, elev2Mm: startEl + riseMm }
                : line));

              // v2.53 A turn in plan moves the far end off the six drawn
              // directions. Whatever hangs off that end travels with it, or
              // the swing would tear the run apart at the joint.
              const d = isoDeltaTo3D(target.end.x - target.start.x, target.end.y - target.start.y);
              if (planTurnDeg && Math.abs(d[2]) < 0.9) {
                const th = (planTurnDeg * Math.PI) / 180;
                const cos = Math.cos(th);
                const sin = Math.sin(th);
                const wx = d[0];
                const wz = -d[1];
                const p = horizontalTo2D(
                  ((wx * cos) - (wz * sin)) * horizontalMm,
                  ((wx * sin) + (wz * cos)) * horizontalMm,
                  mmPerPoint / pointStep,
                );
                const newEnd = { x: target.start.x + p.x, y: target.start.y + p.y };
                const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.001;
                next = next.map((line) => {
                  const out = { ...line };
                  if (same(out.start, target.end)) out.start = newEnd;
                  if (same(out.end, target.end)) out.end = newEnd;
                  return out;
                });
              }
              commitLines(next);
              setAngleTarget(null);
            }}
          />
        )}
        {levelTarget && (
          <LevelSheet
            value={levelTarget.el}
            odMm={pipeSpec(lines[levelTarget.index]?.spec?.a ?? 0)?.od ?? 0}
            datums={datums}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setLevelTarget(null)}
            onApply={(mm) => {
              commitLines(lines.map((line, i) => (i === levelTarget.index
                ? {
                  ...line,
                  [levelTarget.which === 1 ? "elev1Mm" : "elev2Mm"]: mm - (primary?.offsetMm ?? 0),
                }
                : line)));
              setLevelTarget(null);
            }}
          />
        )}
        {showGlSheet && (
          <GlSheet
            datums={datums}
            index={datumIndex}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onSelect={setDatumIndex}
            onClose={() => setShowGlSheet(false)}
            onChange={(patch) => patchDatum(datumIndex, patch)}
            onRefit={() => patchDatum(datumIndex, { fitted: false, sizeMm: 0, sizeVMm: 0, center: null })}
            onAdd={() => {
              const next = makeDatum("FL", (datums[datums.length - 1]?.offsetMm ?? 0) + 1000);
              setDatums([...datums, next]);
              setDatumIndex(datums.length);
            }}
            onMakePrimary={() => {
              // the primary datum is the one EL is measured from
              const chosen = datums[datumIndex];
              setDatums([chosen, ...datums.filter((_, i) => i !== datumIndex)]);
              setDatumIndex(0);
            }}
            onRemove={() => {
              if (datums.length < 2) return;
              setDatums(datums.filter((_, i) => i !== datumIndex));
              setDatumIndex(0);
            }}
          />
        )}
        {jointTarget && (
          <JointSheet
            nominalA={lines[jointTarget.legs[0].index]?.spec?.a ?? 100}
            setting={jointSettingOf(jointTarget, lines, jointTypes)}
            deflectionDeg={jointInfo(jointTarget.key)?.deflectionDeg ?? 90}
            rollDeg={jointInfo(jointTarget.key)?.rollDeg ?? 0}
            gapMm={lines[jointTarget.legs[0].index]?.spec?.gap ?? 2}
            flanged={jointTarget.legs.some((leg) => {
              const f = lines[leg.index]?.spec?.flange ?? "none";
              return leg.which === 1 ? f === "start" || f === "both" : f === "end" || f === "both";
            })}
            onFlangedChange={(on) => {
              // one leg carries the setting; the model derives the mating
              // flange from it, so a corner is never half flanged
              const next = lines.map((line, i) => {
                const leg = jointTarget.legs.find((l) => l.index === i);
                if (!leg) return line;
                const current = line.spec?.flange ?? "none";
                const has = leg.which === 1
                  ? current === "start" || current === "both"
                  : current === "end" || current === "both";
                if (on === has) return line;
                let flange;
                if (on) {
                  flange = leg.which === 1
                    ? (current === "end" ? "both" : "start")
                    : (current === "start" ? "both" : "end");
                } else {
                  flange = current === "both"
                    ? (leg.which === 1 ? "end" : "start")
                    : "none";
                }
                return { ...line, spec: { ...(line.spec ?? {}), flange } };
              });
              commitLines(next);
            }}
            hasReducer={(() => {
              const sizes = jointTarget.legs.map((leg) => lines[leg.index]?.spec?.a ?? 100);
              return new Set(sizes).size > 1;
            })()}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setJointTarget(null)}
            onChange={(next) => setJointTypes({ ...jointTypes, [jointTarget.key]: next })}
            onReset={() => {
              const rest = { ...jointTypes };
              delete rest[jointTarget.key];
              setJointTypes(rest);
            }}
          />
        )}
        {showSpecSheet && (
          <EditSheet
            line={{ spec: currentSpec ?? {} }}
            mmPerPoint={mmPerPoint}
            hideLength
            title={localStorage.getItem("haikan-lang") === "jp" ? "次の配管の仕様" : "Spec for new pipes"}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setShowSpecSheet(false)}
            onApply={({ a, conn, flange, material, schedule, gap }) => {
              setCurrentSpec({ a, conn, flange, material, schedule, gap });
              setShowSpecSheet(false);
            }}
          />
        )}
        {showCutList && (
          <CutList
            lines={lines}
            mmPerPoint={mmPerPoint}
            jointTypes={jointTypes}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setShowCutList(false)}
          />
        )}
        {showWorkshop && (
          <Workshop
            lines={lines}
            mmPerPoint={mmPerPoint}
            glOffsetMm={primary?.offsetMm ?? 0}
            jointTypes={jointTypes}
            detail={detail}
            labelFlat={labelFlat}
            showDims={showDims}
            showPipes={showPipes}
            immersive={immersive}
            onToggleDims={() => setShowDims((d) => !d)}
            onToggleImmersive={() => setImmersive((v) => !v)}
            onEditSegment={setEditTarget}
            onClose={() => { setShowWorkshop(false); setImmersive(false); }}
          />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
