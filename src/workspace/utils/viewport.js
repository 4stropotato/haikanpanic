// v1.18+ Single source of truth for workspace size. The old code read
// window.innerWidth once per render with no resize handling, which left a
// dead band on phones (browser chrome show/hide, pinch, rotation). All
// canvas layers and snap math must share these values so their centers agree.
import { useSyncExternalStore } from "react";

export const viewport = {
  w: typeof window !== "undefined" ? window.innerWidth : 0,
  h: typeof window !== "undefined" ? window.innerHeight : 0,
};

const listeners = new Set();
let stamp = 0;

function measure() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  if (w !== viewport.w || h !== viewport.h) {
    viewport.w = w;
    viewport.h = h;
    stamp += 1;
    for (const fn of listeners) fn();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", measure);
  window.visualViewport?.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);
}

export function useViewport() {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => stamp,
  );
  return viewport;
}
