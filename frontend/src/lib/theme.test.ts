// V-F11: the light or dark choice is read, saved and shown as spec 3.10 sets out (R91-R93).
import { afterEach, describe, expect, it } from "vitest";

import { applyTheme, currentTheme, readTheme, saveTheme, THEME_KEY } from "./theme";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  };
}

const blocked = {
  getItem: () => {
    throw new DOMException("Blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("Blocked", "SecurityError");
  },
};

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
});

describe("readTheme", () => {
  it("R91 is light when nothing is saved", () => {
    expect(readTheme(memoryStorage())).toBe("light");
  });

  it("R92 is dark when dark is saved", () => {
    expect(readTheme(memoryStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
  });

  it("R91 treats anything but light or dark as no choice", () => {
    for (const value of ["light", "Dark", "true", "", "{}"]) {
      expect(readTheme(memoryStorage({ [THEME_KEY]: value })), value).toBe("light");
    }
  });

  it("R93 is light when storage can't be read", () => {
    expect(readTheme(blocked)).toBe("light");
  });

  it("R93 is light when there's no storage at all", () => {
    expect(readTheme(undefined)).toBe("light");
  });

  it("R92 reads this browser's localStorage by default", () => {
    localStorage.setItem(THEME_KEY, "dark");
    expect(readTheme()).toBe("dark");
  });
});

describe("saveTheme", () => {
  it("R92 saves the choice under accountable.theme", () => {
    const storage = memoryStorage();
    saveTheme("dark", storage);
    expect(storage.getItem("accountable.theme")).toBe("dark");
    saveTheme("light", storage);
    expect(storage.getItem("accountable.theme")).toBe("light");
  });

  it("R93 ignores storage that can't be written", () => {
    expect(() => saveTheme("dark", blocked)).not.toThrow();
  });

  it("R92 writes this browser's localStorage by default", () => {
    saveTheme("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });
});

describe("applyTheme and currentTheme", () => {
  it("R92 dark sets data-theme on <html>, and light removes it", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(currentTheme()).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(currentTheme()).toBe("light");
  });

  it("R91 any other data-theme value counts as light", () => {
    document.documentElement.dataset.theme = "sepia";
    expect(currentTheme()).toBe("light");
  });
});
