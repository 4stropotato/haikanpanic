import { StrictMode } from "react";                         // v1.10+ React strict mode enabled
import { createRoot } from "react-dom/client";              // v1.10+ createRoot API from React 18+
import App from "./App";                                    // v1.10+ entry point app component
import "./index.css";                                       // v1.10+ global stylesheet import

createRoot(document.getElementById("root")).render(         // v1.10+ mount app at root div
  <StrictMode>
    <App />
  </StrictMode>
);

