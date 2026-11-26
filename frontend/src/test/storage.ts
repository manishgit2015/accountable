// Make the browser's localStorage unavailable the way real browsers do (R93), for theme tests.
const realStorage = window.localStorage;

/**
 * Make reading `window.localStorage` itself throw, as Chrome does when site data is blocked ("Failed to read
 * the 'localStorage' property from 'Window'"), or make it missing. Undo it with restoreLocalStorage().
 */
export function blockLocalStorage(mode: "throws" | "missing" = "throws"): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => {
      if (mode === "missing") return undefined;
      throw new DOMException("Failed to read the 'localStorage' property from 'Window'", "SecurityError");
    },
  });
}

/** Put the real localStorage back. Call it first in afterEach, before anything that uses storage. */
export function restoreLocalStorage(): void {
  Object.defineProperty(window, "localStorage", { configurable: true, value: realStorage });
}
