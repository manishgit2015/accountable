// Light, dark and system mode (spec 3.10, R90-R96, ADR-018). The choice lives in this browser's localStorage
// as "light", "dark" or "system", and the mode in use is shown as data-theme="dark" on <html> (no attribute
// means light). With System, the mode follows the device's prefers-color-scheme, and its changes (R96).
// frontend/index.html has an inline copy of readChoice + modeFor + applyMode that runs before the first
// paint: keep the two in step.

export type ThemeChoice = "light" | "dark" | "system";
export type Mode = "light" | "dark";

export const THEME_KEY = "accountable.theme";
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * This browser's localStorage, read here rather than as a default parameter: when the browser blocks site
 * data, reading the property itself throws, and a default parameter would throw outside the caller's try.
 */
function browserStorage(): Storage | undefined {
  return globalThis.localStorage;
}

/** The saved choice: one of the three, or Light for anything else, or if storage can't be read (R91, R93). */
export function readChoice(storage?: Pick<Storage, "getItem">): ThemeChoice {
  try {
    const saved = (storage ?? browserStorage())?.getItem(THEME_KEY);
    return saved === "dark" || saved === "system" ? saved : "light";
  } catch {
    return "light";
  }
}

/** Save the choice. A storage that can't be written is ignored: the mode still applies for this visit (R93). */
export function saveChoice(choice: ThemeChoice, storage?: Pick<Storage, "setItem">): void {
  try {
    (storage ?? browserStorage())?.setItem(THEME_KEY, choice);
  } catch {
    // Blocked or full storage: nothing to do, and nothing to log (R7, R93).
  }
}

/** The device's dark mode setting, or nothing when the browser can't say (System is then light, R96). */
function darkQuery(win: Pick<Window, "matchMedia"> | undefined = globalThis.window): MediaQueryList | null {
  try {
    return win?.matchMedia?.(DARK_QUERY) ?? null;
  } catch {
    return null;
  }
}

/** The mode a choice shows: System follows the device (R96). */
export function modeFor(choice: ThemeChoice, query: MediaQueryList | null = darkQuery()): Mode {
  if (choice === "system") return query?.matches ? "dark" : "light";
  return choice;
}

/** Show the mode: data-theme="dark" on <html>, or no attribute for light (R92). */
export function applyMode(mode: Mode, root: HTMLElement = document.documentElement): void {
  if (mode === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
}

/** The mode on screen now. */
export function currentMode(root: HTMLElement = document.documentElement): Mode {
  return root.dataset.theme === "dark" ? "dark" : "light";
}

// --- The app's theme: the choice, and following the device while System is chosen ---------------------

let choice: ThemeChoice = "light";
const listeners = new Set<() => void>();

/** The choice in use this visit (what's saved, or what was chosen if saving failed). */
export function currentChoice(): ThemeChoice {
  return choice;
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Start the theme for this visit: read the saved choice, show its mode, and from then on follow the device
 * whenever System is chosen. Only <html> changes, so the page, its scroll position and its forms are kept.
 * Returns a function that stops following the device.
 */
export function startTheme(
  storage?: Pick<Storage, "getItem">,
  query: MediaQueryList | null = darkQuery(),
  root: HTMLElement = document.documentElement,
): () => void {
  choice = readChoice(storage);
  applyMode(modeFor(choice, query), root);
  const follow = () => {
    if (choice === "system") applyMode(modeFor("system", query), root);
  };
  query?.addEventListener?.("change", follow);
  return () => query?.removeEventListener?.("change", follow);
}

/** Choose a theme: show it at once, then save it (R90, R92). Shown first, so it applies even if saving fails. */
export function chooseTheme(
  next: ThemeChoice,
  storage?: Pick<Storage, "setItem">,
  query: MediaQueryList | null = darkQuery(),
  root: HTMLElement = document.documentElement,
): void {
  choice = next;
  applyMode(modeFor(next, query), root);
  listeners.forEach((listener) => listener());
  saveChoice(next, storage);
}
