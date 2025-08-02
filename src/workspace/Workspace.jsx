// [v1.01] Initial layout, theming, and grid toggles
// [v1.02] Touch drawing and snapping logic
// [v1.03] Angle snap to 6 isometric directions
// [v1.04] Tap + hold UX flow for mobile input
// [v1.05] Magnifier toggle and workspace ref for capture
// [v1.07] Real-time magnifier system
// [v1.08] Lens follows snap point
// [v1.09] Pinch-to-zoom and panning logic
// [v1.10] Modularized workspace architecture with context and utility-driven snapping

import { useRef, useState, useEffect } from "react";                         // [v1.01] React hooks
import IsoGrid from "./grid/IsoGrid";                                       // [v1.10] isometric grid module
import DrawLayer from "./draw/DrawLayer";                                   // [v1.02] line drawing layer
import SnapOverlay from "./snap/SnapOverlay";                               // [v1.01] snapping crosshair overlay
import Magnify from "./magnify/Magnify";                                    // [v1.07] real-time magnifier lens
import TopBar from "../ui/TopBar";                                          // [v1.10] top control bar
import { WorkspaceContext } from "./WorkspaceContext";                      // [v1.10] shared state context
import { snapToAllowedAngle, snapToNearestGrid } from "./utils/geometry";   // [v1.10] math utilities
import { zoomMin, zoomMax } from "./utils/constants";                       // [v1.10] zoom range constants
import "./Workspace.css";                                                   // [v1.10] workspace layout styles

export default function Workspace() {
  const workspaceRef = useRef(null);                                        // [v1.05] DOM ref for workspace
  const [darkMode, setDarkMode] = useState(true);                           // [v1.01] dark mode toggle
  const [showGrid, setShowGrid] = useState(true);                           // [v1.01] toggle grid
  const [showMagnifier, setShowMagnifier] = useState(false);               // [v1.05] toggle magnifier
  const [hideCrosshair, setHideCrosshair] = useState(false);               // [v1.05] hide crosshair for screenshot

  const [zoom, setZoom] = useState(1);                                      // [v1.09] current zoom level
  const [offset, setOffset] = useState({ x: 0, y: 0 });                      // [v1.09] pan offset
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });                    // [v1.08] magnifier lens position
  const [lastSnap, setLastSnap] = useState(null);                           // [v1.02] current snap point
  const [startPoint, setStartPoint] = useState(null);                       // [v1.02] starting point for drawing
  const [lines, setLines] = useState([]);                                   // [v1.02] list of line segments
  const [previewLine, setPreviewLine] = useState(null);                     // [v1.02] live preview line
  const [readyToDraw, setReadyToDraw] = useState(false);                    // [v1.02] whether in draw mode

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
    if (lastSnap) setLensPos(lastSnap);                                     // [v1.08] update magnifier position
  }, [lastSnap]);

  useEffect(() => {
    const el = workspaceRef.current;
    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.min(zoomMax, Math.max(zoomMin, z * factor)));     // [v1.09] mouse wheel zoom
    };
    el?.addEventListener("wheel", handleWheel, { passive: false });
    return () => el?.removeEventListener("wheel", handleWheel);
  }, []);

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [t1, t2] = e.touches;
      const mid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (!lastTouch.current) {
        lastTouch.current = { mid, dist, zoom, offset };                    // [v1.09] track initial pinch
        return;
      }
      const dz = dist / lastTouch.current.dist;
      const newZoom = Math.min(zoomMax, Math.max(zoomMin, lastTouch.current.zoom * dz));
      const dx = mid.x - lastTouch.current.mid.x;
      const dy = mid.y - lastTouch.current.mid.y;
      const newOffset = {
        x: lastTouch.current.offset.x + dx,
        y: lastTouch.current.offset.y + dy,
      };
      setZoom(newZoom);
      setOffset(newOffset);
    }
  };

  const handleTouchStart = () => {
    heldEnough.current = false;
    holdTimeout.current = setTimeout(() => {
      heldEnough.current = true;
    }, 150);                                                             // [v1.04] long press delay
  };

  const handleTouchEnd = () => {
    lastTouch.current = null;
    clearTimeout(holdTimeout.current);
    if (!heldEnough.current) return;

    if (!readyToDraw && !startPoint) {
      pendingStart.current = lastSnap;
      confirmTapTimeout.current = setTimeout(() => (pendingStart.current = null), 5000);
    } else if (readyToDraw && startPoint) {
      pendingEnd.current = lastSnap;
      triggerDraw();
    }
  };

  const handleClick = () => {
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
    const snappedStart = snapToNearestGrid(angleSnapped.start, zoom, offset);        // [v1.10] snapped w/ transform
    const snappedEnd = snapToNearestGrid(angleSnapped.end, zoom, offset);
    setLines([...lines, { start: snappedStart, end: snappedEnd }]);
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
    setDarkMode,
    setShowGrid,
    setShowMagnifier,
    setZoom,
    setOffset,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>     {/* [v1.10] global state context */}
      <div className="app">
        <TopBar />
        <div
          className="workspace"
          ref={workspaceRef}
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
          />
          {!hideCrosshair && (
            <SnapOverlay onSnapChange={setLastSnap} zoom={zoom} offset={offset} />
          )}
          {showMagnifier && <Magnify x={lensPos.x} y={lensPos.y} />}
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
