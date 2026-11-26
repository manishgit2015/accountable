// Light and dark mode (spec 3.10, R91-R93, ADR-018). The choice lives in this browser's localStorage, and
// is shown as data-theme="dark" on <html> (no attribute means light). frontend/index.html has an inline
// copy of readTheme + applyTheme that runs before the first paint: keep the two in step.

export type Theme = "light" | "dark";

export const THEME_KEY = "accountable.theme";

/**
 * This browser's localStorage, read here rather than as a default parameter: when the browser blocks site
 * data, reading the property itself throws, and a default parameter would throw outside the caller's try.
 */
function browserStorage(): Storage | undefined {
  return globalThis.localStorage;
}

/** The saved mode: dark only if exactly "dark" is saved, light otherwise, or if storage can't be read (R91, R93). */
export function readTheme(storage?: Pick<Storage, "getItem">): Theme {
  try {
    return (storage ?? browserStorage())?.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Save the mode. A storage that can't be written is ignored: the mode still applies for this visit (R93). */
export function saveTheme(theme: Theme, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? browserStorage())?.setItem(THEME_KEY, theme);
  } catch {
    // Blocked or full storage: nothing to do, and nothing to log (R7, R93).
  }
}

/** Show the mode: data-theme="dark" on <html>, or no attribute for light (R92). */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
}

/** The mode on screen now, as the inline script or the toggle last set it. */
export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  return root.dataset.theme === "dark" ? "dark" : "light";
}
