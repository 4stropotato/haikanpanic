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

import { useRef, useState, useEffect } from "react";                         // [v1.01] React hooks
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
import { nodeElevations } from "./workshop/pipe3d";                         // v2.16 freeze height on move
import {
  findSegmentAt, setSegmentLength, connectedIndices,
} from "./utils/editLength";                                                // v1.19+ tap-to-edit lengths
import { segmentLengthMm } from "./utils/lengths";                          // v1.19+ current mm for prompt
import { viewport, observeViewport } from "./utils/viewport";               // v1.19+ tap coord conversion
import {
  glPlaneGeometry, sizeFromHandle, insidePlane,
} from "./utils/glPlane";                                                   // v2.09 datum plane
import GlSheet from "../ui/GlSheet";
import { findJointAt, jointTypeOf } from "./utils/joints";                  // v2.10 corner fittings
import JointSheet from "../ui/JointSheet";
import { zoomMin, zoomMax } from "./utils/constants";                       // [v1.10] zoom range constants
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
  const [startPoint, setStartPoint] = useState(null);                       // [v1.02] starting point for drawing
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
        { start: c, end: d, lengthMm: 800, spec: { a: 50, conn: "BW", flange: "end" } },
      ];
    }
    try {
      return JSON.parse(localStorage.getItem("haikan-lines-v1")) ?? [];
    } catch {
      return [];
    }
  });
  const [mmPerPoint, setMmPerPoint] = useState(() => {                      // [v1.17] scale: 1 dot step = X mm
    const stored = Number(localStorage.getItem("haikan-scale-mmpp"));
    return Number.isFinite(stored) && stored > 0 ? stored : 100;
  });
  const [previewLine, setPreviewLine] = useState(null);                     // [v1.02] live preview line
  const [readyToDraw, setReadyToDraw] = useState(false);                    // [v1.02] whether in draw mode
  const [isHolding, setIsHolding] = useState(false);                        // [v1.11] track touch hold state for magnifier
  const [editMode, setEditMode] = useState(false);                          // v1.19+ tap segments to edit lengths
  const [editTarget, setEditTarget] = useState(() => {                      // v2.02 segment being edited
    const seed = new URLSearchParams(window.location.search).get("edit");
    return seed === null ? null : Number(seed);
  });
  const [eraseMode, setEraseMode] = useState(false);                        // v2.08 tap a line to delete it
  const [moveMode, setMoveMode] = useState(false);                          // v2.16 drag runs across the ground
  const [past, setPast] = useState([]);                                     // v2.17 undo stack
  const [future, setFuture] = useState([]);                                 // v2.17 redo stack
  const pipeDrag = useRef(null);
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
  const [jointTarget, setJointTarget] = useState(null);
  const [showCutList, setShowCutList] = useState(() => new URLSearchParams(window.location.search).has("cutlist")); // v2.07 材料表 sheet
  const [showGL, setShowGL] = useState(true);                               // v2.07 GL/EL in 2D
  const [glContinuous, setGlContinuous] = useState(                         // v2.08 plane mode
    () => localStorage.getItem("haikan-gl-mode") === "continuous",
  );
  const [glSizeMm, setGlSizeMm] = useState(() => {                          // v2.08 0 = auto fit
    const stored = Number(localStorage.getItem("haikan-gl-size"));
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  });
  const [glOffsetMm, setGlOffsetMm] = useState(() => {                      // v2.09 datum height
    const stored = Number(localStorage.getItem("haikan-gl-offset"));
    return Number.isFinite(stored) ? stored : 0;
  });
  const [glSizeVMm, setGlSizeVMm] = useState(() => {                        // v2.13 depth, 0 = auto
    const stored = Number(localStorage.getItem("haikan-gl-sizev"));
    return Number.isFinite(stored) && stored >= 0 ? stored : 0;
  });
  const [glName, setGlName] = useState(() => localStorage.getItem("haikan-gl-name") || "GL");
  const [showGlSheet, setShowGlSheet] = useState(() => new URLSearchParams(window.location.search).has("gl")); // v2.13 datum editor
  const [glCenter, setGlCenter] = useState(null);                           // v2.09 dragged centre
  const [glEditPlane, setGlEditPlane] = useState(false);                    // v2.09 drag handles on
  const planeDrag = useRef(null);
  const [showWorkshop, setShowWorkshop] = useState(() => new URLSearchParams(window.location.search).has("workshop")); // v2.02 3D view toggle (?workshop=1 for tests)
  const [snappedEndpoint, setSnappedEndpoint] = useState(null);             // [v1.15] currently snapped endpoint

  const viewRef = useRef({ zoom: 1, offset: { x: 0, y: 0 } });              // v2.12 live view for native listeners
  const holdTimeout = useRef(null);                                         // [v1.04] long press timer
  const heldEnough = useRef(false);                                         // [v1.04] long press flag
  const lastTouch = useRef(null);                                           // [v1.09] pinch zoom tracker
  const pendingStart = useRef(null);                                        // [v1.04] pending start point
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

  useEffect(() => {
    if (lastSnap) setLensPos(lastSnap);                                     // [v1.08] update magnifier position
  }, [lastSnap]);

  useEffect(() => {
    localStorage.setItem("haikan-lines-v1", JSON.stringify(lines));         // [v1.17] survive refresh/close
  }, [lines]);

  useEffect(() => {
    localStorage.setItem("haikan-scale-mmpp", String(mmPerPoint));          // [v1.17] persist scale
  }, [mmPerPoint]);

  // v2.17 Freeze the auto-fit the first time there is something to fit, so
  // drawing or dragging a pipe never moves the ground under the drawing.
  useEffect(() => {
    if (!lines.length || glSizeMm > 0 || showGlSheet) return;               // not while editing
    const plane = glPlaneGeometry(lines, mmPerPoint, { offsetMm: glOffsetMm });
    if (!plane) return;
    const toMm = (half) => Math.round(((half * 2) / plane.pxPerMm) / 500) * 500;
    setGlSizeMm(Math.max(500, toMm(plane.halfU)));
    setGlSizeVMm(Math.max(500, toMm(plane.halfV)));
  }, [lines.length, glSizeMm, mmPerPoint, glOffsetMm]);

  useEffect(() => {
    localStorage.setItem("haikan-gl-mode", glContinuous ? "continuous" : "area");
    localStorage.setItem("haikan-gl-size", String(glSizeMm));               // v2.08 persist datum
    localStorage.setItem("haikan-gl-offset", String(glOffsetMm));
    localStorage.setItem("haikan-gl-sizev", String(glSizeVMm));
    localStorage.setItem("haikan-gl-name", glName);
  }, [glContinuous, glSizeMm, glOffsetMm, glSizeVMm, glName]);

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

  // v2.17 Every edit goes through here so undo restores the whole sketch —
  // drawing, erasing, moving and spec changes alike — instead of only
  // dropping the last line.
  const commitLines = (next) => {
    setPast((stack) => [...stack.slice(-49), lines]);
    setFuture([]);
    setLines(next);
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

  const currentPlane = () => glPlaneGeometry(lines, mmPerPoint, {
    sizeMm: glSizeMm, sizeVMm: glSizeVMm, offsetMm: glOffsetMm, center: glCenter,
  });

  // v2.16 Move tool. A drag translates the whole welded run across the
  // ground plane. Screen movement is read as horizontal motion only, so the
  // run keeps its elevation — height is a number you type, not something a
  // sideways drag should change. The elevation is frozen on the anchor line
  // at grab time, because an unfrozen piece takes its height from where it
  // sits on screen.
  const pipeGrab = (clientX, clientY) => {
    if (!moveMode || !lines.length) return false;
    const point = toWorkspace(clientX, clientY);
    const index = findSegmentAt(point, lines, 26 / zoom);
    if (index < 0) return false;
    setPast((stack) => [...stack.slice(-49), lines]);                       // one entry per drag
    setFuture([]);
    const members = connectedIndices(lines, index);
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
    };
    return true;
  };

  const pipeMove = (clientX, clientY) => {
    const drag = pipeDrag.current;
    if (!drag) return false;
    const point = toWorkspace(clientX, clientY);
    const anchorBase = drag.base[drag.anchorIndex].start;
    const wanted = {
      x: anchorBase.x + (point.x - drag.origin.x),
      y: anchorBase.y + (point.y - drag.origin.y),
    };
    const snapped = snapWorkspaceToGrid(wanted);                            // stay on the lattice
    const dx = snapped.x - anchorBase.x;
    const dy = snapped.y - anchorBase.y;
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
    if ((!glEditPlane && !moveMode) || glContinuous || !lines.length) return false;
    const plane = currentPlane();
    if (!plane) return false;
    const point = toWorkspace(clientX, clientY);
    const grabRadius = 20 / zoom;
    for (const corner of plane.corners) {
      if (Math.hypot(point.x - corner.x, point.y - corner.y) < grabRadius) {
        planeDrag.current = { mode: "resize", axis: "both", cx: plane.cx, cy: plane.cy };
        return true;
      }
    }
    for (const edge of plane.edges) {
      if (Math.hypot(point.x - edge.point.x, point.y - edge.point.y) < grabRadius) {
        planeDrag.current = { mode: "resize", axis: edge.axis, cx: plane.cx, cy: plane.cy };
        return true;
      }
    }
    planeDrag.current = {
      mode: "move",
      dx: plane.cx - point.x,
      dy: plane.cy - point.y,
    };
    return true;
  };

  const planeMove = (clientX, clientY) => {
    const drag = planeDrag.current;
    if (!drag) return false;
    const point = toWorkspace(clientX, clientY);
    if (drag.mode === "resize") {
      const size = sizeFromHandle(point, drag.cx, drag.cy, mmPerPoint, drag.axis);
      if (size.u != null) setGlSizeMm(size.u);
      if (size.v != null) setGlSizeVMm(size.v);
    } else {
      setGlCenter({ x: point.x + drag.dx, y: point.y + drag.dy });
    }
    return true;
  };

  const handleTouchMove = (e) => {
    if (pipeDrag.current && e.touches.length === 1) {
      e.preventDefault();
      pipeMove(e.touches[0].clientX, e.touches[0].clientY);
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
    if (e.touches.length === 1 && pipeGrab(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.16 dragging a run
    }
    if (e.touches.length === 1 && planeGrab(e.touches[0].clientX, e.touches[0].clientY)) {
      return;                                                              // v2.09 dragging the datum
    }
    heldEnough.current = false;
    setIsHolding(true);                                                    // [v1.11] magnifier moves to top
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);                                                             // [v1.04] long press delay
  };

  const handleTouchEnd = () => {
    if (pipeDrag.current) { pipeDrag.current = null; return; }
    if (planeDrag.current) { planeDrag.current = null; return; }
    lastTouch.current = null;
    clearTimeout(holdTimeout.current);
    setIsHolding(false);                                                   // [v1.11] magnifier returns to crosshair
    if (!heldEnough.current) return;

    if (!readyToDraw && !startPoint) {
      pendingStart.current = lastSnap;
      confirmTapTimeout.current = setTimeout(() => (pendingStart.current = null), 5000);
    } else if (readyToDraw && startPoint) {
      pendingEnd.current = lastSnap;
      triggerDraw();
    }
  };

  const handleClick = (e) => {
    if (moveMode) return;                                                  // v2.16 drags, not taps
    // v2.08 Erase mode: a tap removes the nearest segment. The GL plane and
    // every derived number recompute from what is left.
    if (eraseMode) {
      const point = {
        x: (e.clientX - (viewport.w / 2 + offset.x)) / zoom,
        y: (e.clientY - (viewport.h / 2 + offset.y)) / zoom,
      };
      const index = findSegmentAt(point, lines, 24 / zoom);
      if (index >= 0) commitLines(lines.filter((_, i) => i !== index));
      return;
    }

    // v1.19+ Edit mode: a tap selects the nearest segment and asks for its
    // true length in mm; the chain moves to match. Draw taps are suspended.
    if (editMode) {
      const point = {
        x: (e.clientX - (viewport.w / 2 + offset.x)) / zoom,
        y: (e.clientY - (viewport.h / 2 + offset.y)) / zoom,
      };
      // a corner is a fitting decision; the run behind it is a pipe spec
      const joint = findJointAt(point, lines, 14 / zoom);       // v2.17 tighter, so short runs stay tappable
      if (joint) { setJointTarget(joint); return; }
      const index = findSegmentAt(point, lines, 24 / zoom);
      if (index >= 0) { setEditTarget(index); return; }                     // v2.02 open spec sheet
      // nothing drawn under the tap: the datum owns the rest of the plane
      const plane = showGL && !glContinuous ? currentPlane() : null;
      if (plane && insidePlane(point, plane)) setShowGlSheet(true);
      return;
    }
    if (!("ontouchstart" in window || navigator.maxTouchPoints > 0)) return;

    if (!readyToDraw && pendingStart.current) {
      setStartPoint(pendingStart.current);
      setReadyToDraw(true);
      pendingStart.current = null;
      clearTimeout(confirmTapTimeout.current);
    } else if (readyToDraw && startPoint) {
      tapCount.current++;
      setTimeout(() => {
        if (tapCount.current === 2) {
          setStartPoint(null);
          setPreviewLine(null);
          setReadyToDraw(false);
          pendingEnd.current = null;
        }
        tapCount.current = 0;
      }, 300);                                                         // [v1.04] double-tap cancel
    }
  };

  const triggerDraw = () => {
    if (!startPoint || !pendingEnd.current) return;
    const angleSnapped = snapToAllowedAngle(startPoint, pendingEnd.current);         // [v1.03] lock direction
    // v1.15+ Use snapped endpoint if available, otherwise snap to grid
    const snappedStart = snapToNearestGrid(angleSnapped.start, zoom, offset);
    const snappedEnd = snappedEndpoint || snapToNearestGrid(angleSnapped.end, zoom, offset);
    commitLines([...lines, { start: snappedStart, end: snappedEnd }]);
    setStartPoint(null);
    setPreviewLine(null);
    setReadyToDraw(false);
    pendingEnd.current = null;
    setEditTarget(lines.length);            // v2.03 spec sheet opens after every draw:
                                            // sketch gesture -> type true length/size/joint
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
    undo,                                                                  // v2.17 history
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setShowWorkshop,                                                       // v2.02 open 3D view
    setShowCutList,                                                        // v2.07 材料表
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
    setShowGlSheet,
    resetGlPlane: () => { setGlCenter(null); setGlSizeMm(0); setGlOffsetMm(0); },
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>     {/* [v1.10] global state context */}
      <div className="app">
        <TopBar />
        <div
          className="workspace"
          ref={workspaceRef}
          onMouseDown={(e) => pipeGrab(e.clientX, e.clientY) || planeGrab(e.clientX, e.clientY)}
          onMouseMove={(e) => {
            if (pipeDrag.current) pipeMove(e.clientX, e.clientY);
            else if (planeDrag.current) planeMove(e.clientX, e.clientY);
          }}
          onMouseUp={() => { pipeDrag.current = null; planeDrag.current = null; }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <IsoGrid show={showGrid} zoom={zoom} offset={offset} />
          <DrawLayer
            lines={lines}
            preview={previewLine}
            isDark={darkMode}
            zoom={zoom}
            offset={offset}
            mmPerPoint={mmPerPoint}
            showGL={showGL}
            glContinuous={glContinuous}
            glSizeMm={glSizeMm}
            glOffsetMm={glOffsetMm}
            glCenter={glCenter}
            glEditPlane={glEditPlane || moveMode}
            jointTypes={jointTypes}
            glSizeVMm={glSizeVMm}
            glName={glName}
          />
          {!hideCrosshair && (
            <SnapOverlay
              onSnapChange={setLastSnap}
              onEndpointSnap={setSnappedEndpoint}
              zoom={zoom}
              offset={offset}
              lines={lines}
            />
          )}
          {showMagnifier && <Magnify x={lensPos.x} y={lensPos.y} isHolding={isHolding} mode={magnifyMode} />}
        </div>
        {editTarget != null && lines[editTarget] && (
          <EditSheet
            line={lines[editTarget]}
            mmPerPoint={mmPerPoint}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setEditTarget(null)}
            onApply={({ mm, a, conn, flange, material, schedule, gap }) => {
              const next = setSegmentLength(lines, editTarget, mm, mmPerPoint);
              next[editTarget] = {
                ...next[editTarget],
                spec: { a, conn, flange, material, schedule, gap },
              };
              commitLines(next);
              setEditTarget(null);
            }}
          />
        )}
        {showGlSheet && (
          <GlSheet
            value={{
              name: glName, offsetMm: glOffsetMm, sizeMm: glSizeMm,
              sizeVMm: glSizeVMm, continuous: glContinuous,
            }}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setShowGlSheet(false)}
            onReset={() => { setGlSizeMm(0); setGlSizeVMm(0); setGlCenter(null); }}
            onChange={(patch) => {
              // live: each control lands immediately, nothing waits on Apply
              if (patch.name !== undefined) setGlName(patch.name);
              if (patch.offsetMm !== undefined) setGlOffsetMm(patch.offsetMm);
              if (patch.sizeMm !== undefined) setGlSizeMm(patch.sizeMm);
              if (patch.sizeVMm !== undefined) setGlSizeVMm(patch.sizeVMm);
              if (patch.continuous !== undefined) setGlContinuous(patch.continuous);
            }}
          />
        )}
        {jointTarget && (
          <JointSheet
            nominalA={lines[jointTarget.legs[0].index]?.spec?.a ?? 100}
            current={jointTypeOf(jointTarget, lines, jointTypes)}
            lang={localStorage.getItem("haikan-lang") === "jp" ? "jp" : "en"}
            onClose={() => setJointTarget(null)}
            onPick={(type) => {
              setJointTypes({ ...jointTypes, [jointTarget.key]: type });
              setJointTarget(null);
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
            glOffsetMm={glOffsetMm}
            jointTypes={jointTypes}
            onEditSegment={setEditTarget}
            onClose={() => setShowWorkshop(false)}
          />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
