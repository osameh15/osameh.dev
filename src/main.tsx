import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../app/globals.css";
import "../app/light-theme.css";

const root = document.getElementById("root");

if (!root) throw new Error("Portfolio root element was not found.");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
}
