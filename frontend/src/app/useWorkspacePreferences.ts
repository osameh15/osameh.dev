import { useEffect, useState } from "react";
import { codeProfiles, fontOptions, type CodeLanguage, type FontPreference, type ThemePreference } from "./workspacePreferences";

/**
 * Persisted workspace preferences: theme, interface font, and the code language
 * the sample surfaces render in.
 *
 * Each preference is projected onto a root data attribute so CSS owns the
 * result, and restored from localStorage on first mount. Theme additionally
 * tracks the operating system while it is set to "system", which is why it
 * cannot be a plain write-through value.
 *
 * A stored value is only accepted when it is still a value this build knows
 * about, so removing a font or language cannot leave a reader on a broken
 * preference.
 */
export function useWorkspacePreferences() {
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [font, setFont] = useState<FontPreference>("inter");
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>("typescript");

  useEffect(() => {
    const savedTheme = localStorage.getItem("portfolio-theme") as ThemePreference | null;
    const savedFont = localStorage.getItem("portfolio-font") as FontPreference | null;
    const savedLanguage = localStorage.getItem("portfolio-language") as CodeLanguage | null;
    if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) setTheme(savedTheme);
    if (savedFont && fontOptions.some(option => option.id === savedFont)) setFont(savedFont);
    if (savedLanguage && codeProfiles[savedLanguage]) setCodeLanguage(savedLanguage);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.themePreference = theme;
    };
    applyTheme();
    localStorage.setItem("portfolio-theme", theme);
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("portfolio-font", font);
  }, [font]);

  useEffect(() => {
    localStorage.setItem("portfolio-language", codeLanguage);
  }, [codeLanguage]);

  return { theme, setTheme, font, setFont, codeLanguage, setCodeLanguage };
}
