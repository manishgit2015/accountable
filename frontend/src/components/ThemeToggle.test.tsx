// V-F11: the light and dark mode toggle (R90, R93). Its keyboard use is checked in real Chrome by V-E13
// (e2e/theme.spec.ts), since jsdom doesn't turn Enter or Space on a button into a click.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_KEY } from "../lib/theme";
import { blockLocalStorage, restoreLocalStorage } from "../test/storage";
import { ThemeToggle } from "./ThemeToggle";

const html = document.documentElement;

afterEach(() => {
  restoreLocalStorage();
  delete html.dataset.theme;
  localStorage.clear();
});

function toggle() {
  return screen.getByRole("button", { name: "Dark mode" });
}

describe("ThemeToggle", () => {
  it("R90 starts in light mode when <html> has no data-theme", () => {
    render(<ThemeToggle />);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(toggle().querySelector(".lucide-moon")).not.toBeNull();
  });

  it("R90 starts in dark mode when the inline script already set it", () => {
    html.dataset.theme = "dark";
    render(<ThemeToggle />);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle().querySelector(".lucide-sun")).not.toBeNull();
  });

  it("R90 a click switches to dark, saves it, and a second click switches back", () => {
    render(<ThemeToggle />);

    fireEvent.click(toggle());
    expect(html.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle().querySelector(".lucide-sun")).not.toBeNull();

    fireEvent.click(toggle());
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(toggle().querySelector(".lucide-moon")).not.toBeNull();
  });

  it("R93 still switches when storage can't be written, and logs nothing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    render(<ThemeToggle />);

    fireEvent.click(toggle());
    expect(html.dataset.theme).toBe("dark");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("R93 switches both ways when reading localStorage itself throws (site data blocked), with no error", () => {
    blockLocalStorage();
    const error = vi.spyOn(console, "error");
    render(<ThemeToggle />);

    fireEvent.click(toggle());
    expect(html.dataset.theme).toBe("dark");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(toggle().querySelector(".lucide-sun")).not.toBeNull();

    fireEvent.click(toggle());
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(error).not.toHaveBeenCalled();
  });
});
