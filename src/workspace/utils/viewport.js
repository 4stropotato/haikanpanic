// v2.11 Single source of truth for workspace size.
//
// This measures the WORKSPACE ELEMENT, not the window. `visualViewport`
// collapses while the on-screen keyboard is open, which used to shrink every
// canvas to a sliver and leave the rest of the screen black. The element is
// laid out by CSS and stays the right size no matter what the keyboard does.
import { useSyncExternalStore } from "react";

export const viewport = {
  w: typeof window !== "undefined" ? window.innerWidth : 0,
  h: typeof window !== "undefined" ? window.innerHeight : 0,
};

const listeners = new Set();
let stamp = 0;

function publish(w, h) {
  // a zero measurement means the element is detached mid-layout; keep the
  // last good size rather than collapsing the canvases
  if (w < 1 || h < 1) return;
  if (w === viewport.w && h === viewport.h) return;
  viewport.w = w;
  viewport.h = h;
  stamp += 1;
  for (const fn of listeners) fn();
}

let observed = null;
let observer = null;

// Called by the workspace once it has a DOM node.
export function observeViewport(element) {
  if (!element || observed === element) return;
  observer?.disconnect();
  observed = element;
  observer = new ResizeObserver(() => {
    publish(element.clientWidth, element.clientHeight);
  });
  observer.observe(element);
  publish(element.clientWidth, element.clientHeight);
}

if (typeof window !== "undefined") {
  const fallback = () => {
    if (observed) publish(observed.clientWidth, observed.clientHeight);
    else publish(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("orientationchange", () => setTimeout(fallback, 120));
  window.addEventListener("resize", fallback);
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
