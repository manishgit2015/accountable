// The record picker: choosing, clearing, its "Add …" item (R45) and its field message.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Picker } from "./Picker";

const OPTIONS = [
  { value: 1, label: "Acme Ltd" },
  { value: 2, label: "Bramble & Oak" },
];

describe("Picker", () => {
  it("reports the chosen record, and null for the placeholder", () => {
    const onChange = vi.fn();
    render(<Picker label="Organization" value={1} options={OPTIONS} onChange={onChange} />);
    const select = screen.getByLabelText("Organization");
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange.mock.calls).toEqual([[2], [null]]);
  });

  it("R45 opens the add form from its last item and keeps the current choice", () => {
    const onChange = vi.fn();
    const onAdd = vi.fn();
    render(
      <Picker
        label="Organization"
        value={1}
        options={OPTIONS}
        onChange={onChange}
        addLabel="Add organization"
        onAdd={onAdd}
      />,
    );
    const select = screen.getByLabelText("Organization") as HTMLSelectElement;
    expect(select.options[select.options.length - 1]).toHaveTextContent("+ Add organization");
    fireEvent.change(select, { target: { value: "__add__" } });
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("R45 shows its message and marks the field invalid", () => {
    render(<Picker label="Organization" value={null} options={OPTIONS} onChange={vi.fn()} error="Choose one." />);
    const select = screen.getByLabelText("Organization");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Choose one.");
  });
});
