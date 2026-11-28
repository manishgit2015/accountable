import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, useSyncExternalStore } from "react";

import { useMe } from "../api/queries";
import { session } from "../lib/session";
import { chooseTheme, currentChoice, subscribeTheme, THEME_CHOICES, type ThemeChoice } from "../lib/theme";

const LABELS: Record<ThemeChoice, string> = { light: "Light", dark: "Dark", system: "System" };

/**
 * The user menu at the end of the top bar (R106, R90, R107, R109, section 3.9 Components): a round button
 * with the signed-in person's initials, opening their name and email, the theme choice and "Sign out".
 * Choosing a theme keeps the menu open, so the change can be seen (R90). Radix's menu gives the keyboard
 * use R109 asks for: Enter, Space or Down opens it, the arrow keys move, Escape closes it back to the button.
 */
export function UserMenu() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const choice = useSyncExternalStore(subscribeTheme, currentChoice);
  const name = me.data?.name ?? "";

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger className="user-button" aria-label={`Account menu, ${name}`}>
        {me.data?.initials ?? ""}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="menu user-menu"
          align="end"
          sideOffset={8}
          // R109: Tab moves out of the menu and closes it.
          onKeyDown={(event) => {
            if (event.key === "Tab") setOpen(false);
          }}
        >
          <div className="user-menu-who">
            <div className="user-menu-name">{name}</div>
            {me.data && me.data.email !== name && <div className="user-menu-email">{me.data.email}</div>}
          </div>
          <Menu.Separator className="user-menu-divider" />
          <Menu.Label className="user-menu-label" id="theme-label">
            Theme
          </Menu.Label>
          <Menu.RadioGroup
            className="segmented user-menu-theme"
            aria-labelledby="theme-label"
            value={choice}
            onValueChange={(value) => chooseTheme(value as ThemeChoice)}
          >
            {THEME_CHOICES.map((option) => (
              <Menu.RadioItem
                key={option}
                value={option}
                className={option === choice ? "on" : undefined}
                // Keep the menu open, so the new mode can be seen (R90).
                onSelect={(event) => event.preventDefault()}
              >
                {LABELS[option]}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
          <Menu.Separator className="user-menu-divider" />
          <Menu.Item className="menu-item" onSelect={() => void session().signOut()}>
            Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
