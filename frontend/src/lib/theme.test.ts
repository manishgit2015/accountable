// V-F11: Light, Dark and System (R90-R93, R96), with storage that works, throws, or can't be read at all.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyMode,
  chooseTheme,
  currentChoice,
  currentMode,
  modeFor,
  readChoice,
  saveChoice,
  startTheme,
  subscribeTheme,
  THEME_KEY,
} from "./theme";

/** A device's prefers-color-scheme: dark, which a test can flip like the device's setting. */
function device(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  return {
    query: query as unknown as MediaQueryList,
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
}

function storageWith(saved: string | null) {
  const items = new Map<string, string>(saved === null ? [] : [[THEME_KEY, saved]]);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
  };
}

const throwing = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

describe("the saved choice (R91, R92, R93)", () => {
  it("R91 is Light by default, and for anything but the three choices", () => {
    expect(readChoice(storageWith(null))).toBe("light");
    for (const value of ["DARK", "blue", "", " system"]) expect(readChoice(storageWith(value))).toBe("light");
  });

  it("R92 reads light, dark and system", () => {
    expect(readChoice(storageWith("light"))).toBe("light");
    expect(readChoice(storageWith("dark"))).toBe("dark");
    expect(readChoice(storageWith("system"))).toBe("system");
  });

  it("R93 is Light, with nothing thrown, when storage can't be read", () => {
    const errors = vi.spyOn(console, "error");
    expect(readChoice(throwing)).toBe("light");
    saveChoice("dark", throwing);
    expect(errors).not.toHaveBeenCalled();
  });

  it("R93 is Light when reading window.localStorage itself throws, as Chrome does with site data blocked", () => {
    vi.stubGlobal("localStorage", undefined);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("Failed to read the 'localStorage' property from 'Window'", "SecurityError");
      },
    });
    expect(readChoice()).toBe("light");
    expect(() => saveChoice("system")).not.toThrow();
  });
});

describe("the mode each choice shows (R92, R96)", () => {
  it("R96 System follows the device, and is light when the browser can't say", () => {
    expect(modeFor("light", device(true).query)).toBe("light");
    expect(modeFor("dark", device(false).query)).toBe("dark");
    expect(modeFor("system", device(true).query)).toBe("dark");
    expect(modeFor("system", device(false).query)).toBe("light");
    expect(modeFor("system", null)).toBe("light");
  });

  it("R92 dark is data-theme=dark on <html>, light is no attribute", () => {
    const root = document.createElement("html");
    applyMode("dark", root);
    expect(root.dataset.theme).toBe("dark");
    expect(currentMode(root)).toBe("dark");
    applyMode("light", root);
    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(currentMode(root)).toBe("light");
  });
});

describe("the theme over a visit (R90, R92, R96)", () => {
  it("R92 starts with the saved choice's mode", () => {
    const root = document.createElement("html");
    startTheme(storageWith("dark"), device(false).query, root);
    expect(root.dataset.theme).toBe("dark");
    expect(currentChoice()).toBe("dark");
  });

  it("R96 with System, follows the device when it changes, with no reload", () => {
    const root = document.createElement("html");
    const phone = device(false);
    startTheme(storageWith("system"), phone.query, root);
    expect(currentMode(root)).toBe("light");
    phone.set(true);
    expect(currentMode(root)).toBe("dark");
    phone.set(false);
    expect(currentMode(root)).toBe("light");
  });

  it("R90 R96 choosing Light or Dark stops following the device; choosing System starts again", () => {
    const root = document.createElement("html");
    const phone = device(false);
    const storage = storageWith("system");
    startTheme(storage, phone.query, root);
    chooseTheme("light", storage, phone.query, root);
    phone.set(true);
    expect(currentMode(root)).toBe("light");
    chooseTheme("system", storage, phone.query, root);
    expect(currentMode(root)).toBe("dark");
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_KEY, "system");
  });

  it("R90 R92 choosing shows the mode at once, saves the choice and tells the menu", () => {
    const root = document.createElement("html");
    const storage = storageWith(null);
    const listener = vi.fn();
    const stop = subscribeTheme(listener);
    chooseTheme("dark", storage, device(false).query, root);
    expect(root.dataset.theme).toBe("dark");
    expect(storage.setItem).toHaveBeenCalledWith(THEME_KEY, "dark");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    chooseTheme("light", storage, device(false).query, root);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("R93 with storage blocked, every choice still applies for the visit", () => {
    const root = document.createElement("html");
    const phone = device(true);
    startTheme(throwing, phone.query, root);
    expect(currentMode(root)).toBe("light");
    for (const [choice, mode] of [
      ["dark", "dark"],
      ["light", "light"],
      ["system", "dark"],
    ] as const) {
      chooseTheme(choice, throwing, phone.query, root);
      expect(currentMode(root), choice).toBe(mode);
    }
  });

  it("stopping removes the device listener", () => {
    const phone = device(false);
    const stop = startTheme(storageWith("system"), phone.query, document.createElement("html"));
    expect(phone.listeners.size).toBe(1);
    stop();
    expect(phone.listeners.size).toBe(0);
  });
});
