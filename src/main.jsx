import { trackKeyboardInset } from "./workspace/utils/keyboardInset";
﻿import { StrictMode } from "react";                         // v1.10+ React strict mode enabled
import { createRoot } from "react-dom/client";              // v1.10+ createRoot API from React 18+
import App from "./App";                                    // v1.10+ entry point app component
import "./index.css";                                       // v1.10+ global stylesheet import

createRoot(document.getElementById("root")).render(         // v1.10+ mount app at root div
  <StrictMode>
    <App />
  </StrictMode>
);

trackKeyboardInset();

// A blank 3D view or a dead screen should say why. Uncaught errors surface
// in a bar instead of only in a console nobody can open on a phone.
function showError(message) {
  let bar = document.getElementById("haikan-error-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "haikan-error-bar";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;"
      + "background:rgba(120,20,20,0.95);color:#ffe4e4;font:600 11px ui-monospace,monospace;"
      + "padding:8px 12px;white-space:pre-wrap;max-height:38vh;overflow:auto";
    bar.addEventListener("click", () => bar.remove());
    document.body.appendChild(bar);
  }
  bar.textContent = String(message).slice(0, 600);
}
window.addEventListener("error", (event) => showError(event.message + "\n" + (event.error?.stack ?? "")));
window.addEventListener("unhandledrejection", (event) => showError(`promise: ${event.reason}`));
