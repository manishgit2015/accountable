// R21 field rules, R45 field messages and hints, R48 the server's messages on the form, with the reference (OBS-3).
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { FieldShell, FormError, TextField, applyServerErrors, optional, rules } from "./fields";

const FIELDS = ["name", "email"] as const;

function serverError(code: string, fields: Record<string, string> = {}, requestId: string | null = null) {
  return new ApiError({ status: 422, code, message: `The ${code} message.`, fields, requestId });
}

describe("rules", () => {
  it("accepts an empty optional email or website, and refuses malformed ones", () => {
    expect(rules.email.safeParse("").success).toBe(true);
    expect(rules.email.safeParse("ada@acme.example").success).toBe(true);
    expect(rules.email.safeParse("ada@acme").success).toBe(false);
    expect(rules.website.safeParse("").success).toBe(true);
    expect(rules.website.safeParse("acme.example").success).toBe(true);
    expect(rules.website.safeParse("https://acme.example").success).toBe(true);
    expect(rules.website.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("accepts whole-number values and percentages in range only", () => {
    expect(rules.value.safeParse("1000000000").success).toBe(true);
    expect(rules.value.safeParse("1000000001").success).toBe(false);
    expect(rules.value.safeParse("12.5").success).toBe(false);
    expect(rules.probability.safeParse("100").success).toBe(true);
    expect(rules.probability.safeParse("101").success).toBe(false);
  });

  it("accepts real calendar dates only, and an empty follow-up date", () => {
    expect(rules.closeDate.safeParse("2026-12-31").success).toBe(true);
    expect(rules.closeDate.safeParse("2026-02-30").success).toBe(false);
    expect(rules.closeDate.safeParse("31/12/2026").success).toBe(false);
    expect(rules.followUpDate.safeParse("").success).toBe(true);
  });
});

describe("optional", () => {
  it("sends blank text as null and trims the rest", () => {
    expect(optional("   ")).toBeNull();
    expect(optional("  Buyer ")).toBe("Buyer");
  });
});

describe("applyServerErrors", () => {
  it("puts the server's messages on their fields and asks to check them", () => {
    const setError = vi.fn();
    const message = applyServerErrors(
      serverError("validation_failed", { email: "Taken." }),
      setError,
      FIELDS,
      "contact",
    );
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Taken." });
    expect(message).toBe("Check the highlighted fields.");
  });

  it("shows the server's message at the top when a field isn't on the form", () => {
    const message = applyServerErrors(
      serverError("validation_failed", { stage: "Not allowed." }, "9f2c1a7b00"),
      vi.fn(),
      FIELDS,
      "contact",
    );
    expect(message).toBe("The validation_failed message. Reference: 9f2c1a7b");
  });

  it("passes on the message when the app can't be reached or is busy", () => {
    expect(applyServerErrors(serverError("busy"), vi.fn(), FIELDS, "deal")).toBe("The busy message.");
    expect(applyServerErrors(serverError("unreachable"), vi.fn(), FIELDS, "deal")).toBe("The unreachable message.");
  });

  it("says the save failed for any other error", () => {
    const expected = "Couldn't save the deal. Check the app is still running and try again.";
    expect(applyServerErrors(serverError("internal"), vi.fn(), FIELDS, "deal")).toBe(expected);
    expect(applyServerErrors(new Error("boom"), vi.fn(), FIELDS, "deal")).toBe(expected);
  });
});

describe("FieldShell", () => {
  it("labels the control and describes it with its hint", () => {
    render(
      <FieldShell label="Website" hint="Like example.com">
        {(props) => <input {...props} />}
      </FieldShell>,
    );
    const input = screen.getByLabelText("Website");
    expect(input).toHaveAccessibleDescription("Like example.com");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the hint, and marks the control invalid", () => {
    render(<TextField label="Name" hint="Their full name" error="Enter a name." />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a name.");
    expect(screen.queryByText("Their full name")).not.toBeInTheDocument();
  });
});

describe("FormError", () => {
  it("shows nothing without a message, and an alert with one", () => {
    const { rerender } = render(<FormError message={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(<FormError message="Couldn't save." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save.");
  });
});
