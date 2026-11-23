// R56: a record that no longer exists, and the shared panel pieces (spec 3.9 Layout).
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { NotFound } from "./NotFound";
import { Panel } from "./Panel";
import { SidePanel } from "./SidePanel";

describe("NotFound", () => {
  it("R56 says the record is gone and links back to its list", () => {
    render(
      <MemoryRouter>
        <NotFound noun="deal" listPath="/deals" listLabel="deals" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "This deal no longer exists" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals");
  });
});

describe("Panel", () => {
  it("shows a title only when given one", () => {
    const { container } = render(<Panel>Body only</Panel>);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("panel");
  });
});

describe("SidePanel", () => {
  it("describes itself, and closes with its close button", () => {
    const onOpenChange = vi.fn();
    render(
      <SidePanel open onOpenChange={onOpenChange} title="Edit deal" description="Changes save at once.">
        <p>Form</p>
      </SidePanel>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit deal" });
    expect(dialog).toHaveAccessibleDescription("Changes save at once.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
