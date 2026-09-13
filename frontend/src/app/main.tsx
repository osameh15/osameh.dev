import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FeaturePreferencesProvider } from "../features/portfolio/PortfolioFeatures";
import "../styles/globals.css";
import "../styles/light-theme.css";
import "../styles/features-v5.css";
// Last: the Phantom accessibility corrections must not be overridden by a
// feature stylesheet that happens to load after them.
import "../styles/a11y-phantom.css";

// Captured before registration: a page that was already controlled and then
// sees a new controller has been updated, not installed for the first time.
const hadControllerAtStartup = typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;

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

  // Announce a newer build, once, and only when one controller replaces
  // another. On a first visit `controller` is null until the worker installs,
  // and that transition is an installation rather than an update - telling a
  // first-time visitor to reload would be noise. Event-driven, so there is no
  // polling and no forced refresh.
  let announced = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (announced || !hadControllerAtStartup) return;
    announced = true;
    window.dispatchEvent(new CustomEvent("portfolio:build-updated"));
  });
}
