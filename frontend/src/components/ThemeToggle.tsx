import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { applyTheme, currentTheme, saveTheme, type Theme } from "../lib/theme";
import { Button } from "./Button";

/**
 * The light and dark mode toggle in the top bar (spec 3.9 Components, R90). It starts from what's on
 * <html> already (index.html's inline script applied the saved choice), and a click shows and saves the
 * other mode. Only <html> changes, so the page, its scroll position and any open form are kept.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    // Show it first, so the button and the page always agree, even if saving fails (R93).
    applyTheme(next);
    setTheme(next);
    saveTheme(next);
  }

  return (
    <Button className="theme-toggle" aria-label="Dark mode" aria-pressed={dark} onClick={toggle}>
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </Button>
  );
}
