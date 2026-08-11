// Reload when a new build is published.
//
// The server already sends the page itself no-store, so a reload always picks
// up the current bundle. The trouble was needing to know to reload at all: a
// tab left open keeps running the JS it started with, so fix after fix was
// reported as "walang nagbago" while the phone quietly ran an old build. Days
// went into chasing bugs that were already fixed.
//
// So the page checks for itself. It asks the server which bundle the current
// page references and reloads if that is not the one running. The sketch lives
// in localStorage, so a reload costs nothing.
const CURRENT = (() => {
  const el = document.querySelector('script[src*="assets/index-"]');
  const src = el?.getAttribute("src") ?? "";
  return src.split("/").pop() ?? "";
})();

async function publishedBuild() {
  const res = await fetch(`${location.pathname}?_=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  return html.match(/assets\/(index-[^"']+\.js)/)?.[1] ?? null;
}

async function check() {
  if (!CURRENT || document.hidden) return;
  try {
    const latest = await publishedBuild();
    // only act on a real answer, and never reload in a loop
    if (latest && latest !== CURRENT) location.reload();
  } catch { /* offline, or the server is down — try again later */ }
}

export function watchForNewBuild(everyMs = 30000) {
  if (!CURRENT) return;                      // dev server, nothing to compare
  setInterval(check, everyMs);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
}
