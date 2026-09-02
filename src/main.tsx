import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FeaturePreferencesProvider } from "./PortfolioFeatures";
import "../app/globals.css";
import "../app/light-theme.css";
import "../app/features-v5.css";

const root = document.getElementById("root");

if (!root) throw new Error("Portfolio root element was not found.");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <FeaturePreferencesProvider>
      <App />
    </FeaturePreferencesProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
}
