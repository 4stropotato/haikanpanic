// v2.13 Keep bottom sheets above the on-screen keyboard.
//
// A `position: fixed` sheet sits at the bottom of the LAYOUT viewport, which
// on a phone is underneath the keyboard — the Apply/Cancel buttons end up
// hidden and the sheet looks frozen. visualViewport tells us how much of the
// screen the keyboard is covering; we publish it as --kb and the sheet lifts.
export function trackKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty("--kb", `${Math.round(inset)}px`);
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
}
