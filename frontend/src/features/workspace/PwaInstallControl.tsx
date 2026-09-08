// Extracted from the v5.2 AdvancedUI module during the v5.3.0 architecture
// refactor. Behavior is unchanged; only ownership moved.

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { notify } from "../../lib/toast";
import { trackEvent } from "../../lib/analytics";

export function PwaInstallControl() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const before = (event: Event) => { event.preventDefault(); setPrompt(event); };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      trackEvent("pwa_installed");
      notify("Portfolio app installed successfully.", "success");
    };
    const install = async () => {
      if (!prompt) {
        notify("Install is not available in this browser right now. You can still add the site from your browser menu.", "info", 4200);
        return;
      }
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === "accepted") {
          trackEvent("pwa_install_accept");
          notify("Install accepted. The app will be available from your device launcher.", "success");
        } else {
          notify("Install dismissed.", "info");
        }
      } catch {
        notify("The browser could not open the install prompt.", "error");
      } finally {
        setPrompt(null);
      }
    };
    window.addEventListener("beforeinstallprompt", before as EventListener);
    window.addEventListener("appinstalled", appInstalled);
    window.addEventListener("portfolio:install", install);
    return () => { window.removeEventListener("beforeinstallprompt", before as EventListener); window.removeEventListener("appinstalled", appInstalled); window.removeEventListener("portfolio:install", install); };
  }, [prompt]);
  if (installed || !prompt) return null;
  return <button type="button" className="pwa-install" aria-label="Install app" onClick={() => window.dispatchEvent(new Event("portfolio:install"))}><Download size={14} aria-hidden="true" /> <span>Install app</span></button>;
}
