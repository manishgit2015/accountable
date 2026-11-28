// V-F12 (the menu): the person's name, email and initials, the theme choice, keyboard use and sign out
// (R105, R106, R107, R109, R90).
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setSession } from "../lib/session";
import { THEME_KEY } from "../lib/theme";
import { fakeApi, renderPage } from "../test/app";
import { fakeSession } from "../test/session";
import { UserMenu } from "./UserMenu";

const PRIYA = { id: "u1", name: "Priya Shah", email: "priya@example.com", initials: "PS" };

function open(button: HTMLElement) {
  fireEvent.pointerDown(button, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

async function button(me = PRIYA) {
  fakeApi({ "GET /api/me": me });
  renderPage(<UserMenu />);
  return screen.findByRole("button", { name: `Account menu, ${me.name}` });
}

describe("the user menu (R106)", () => {
  it("R105 R106 R109 the button shows the initials and is named for the person", async () => {
    expect(await button()).toHaveTextContent("PS");
  });

  it("R106 opens with the name, the email, the theme choice and Sign out", async () => {
    open(await button());
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveTextContent("Priya Shah");
    expect(menu).toHaveTextContent("priya@example.com");
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Light", "Dark", "System"]);
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeInTheDocument();
  });

  it("R105 someone with no display name shows by email once, with its first letter", async () => {
    const nameless = { id: "u3", name: "sam@example.com", email: "sam@example.com", initials: "S" };
    const found = await button(nameless);
    expect(found).toHaveTextContent("S");
    open(found);
    expect((await screen.findByRole("menu")).textContent?.match(/sam@example\.com/g)).toHaveLength(1);
  });

  it("R90 R92 choosing Dark shows it at once, saves it, marks it and keeps the menu open", async () => {
    open(await button());
    const light = await screen.findByRole("menuitemradio", { name: "Light" });
    expect(light).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("R109 opens with Enter and closes with Escape, back on the button", async () => {
    const found = await button();
    found.focus();
    fireEvent.keyDown(found, { key: "Enter" });
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(found).toHaveFocus();
  });

  it("R109 Tab moves out of the menu and closes it", async () => {
    open(await button());
    fireEvent.keyDown(await screen.findByRole("menu"), { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("R107 Sign out ends the session", async () => {
    const current = fakeSession();
    setSession(current);
    open(await button());
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(current.signOut).toHaveBeenCalledTimes(1);
  });
});
