import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FeaturePreferencesProvider } from "../features/portfolio/PortfolioFeatures";
import "../styles/globals.css";
import "../styles/light-theme.css";
import "../styles/features-v5.css";

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
