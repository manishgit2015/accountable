// R46, R78: empty states with an optional action; loading and read errors with their reference (OBS-3).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { EmptyState, QueryState, errorMessage } from "./EmptyState";

describe("EmptyState", () => {
  it("shows the message, and the action only when there is one", () => {
    const { rerender } = render(<EmptyState message="No deals yet" />);
    expect(screen.getByText("No deals yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <EmptyState message="No deals yet">
        <button type="button">Add deal</button>
      </EmptyState>,
    );
    expect(screen.getByRole("button", { name: "Add deal" })).toBeInTheDocument();
  });
});

describe("errorMessage", () => {
  it("passes on the message when the app can't be reached, with the reference", () => {
    const error = new ApiError({ status: 0, code: "timeout", message: "Too slow.", requestId: "abcdef1234" });
    expect(errorMessage(error, "deals")).toBe("Too slow. Reference: abcdef12");
  });

  it("says the read failed for anything else", () => {
    const expected = "Couldn't load the deals. Check the app is still running and try again.";
    expect(errorMessage(new ApiError({ status: 500, code: "internal", message: "Boom" }), "deals")).toBe(expected);
    expect(errorMessage(new TypeError("bad"), "deals")).toBe(expected);
  });
});

describe("QueryState", () => {
  it("shows loading, then the error, then the data", () => {
    const children = (data: string[]) => <p>{data.join(", ")}</p>;
    const { rerender } = render(
      <QueryState query={{ data: undefined, error: null, isPending: true }} what="deals">
        {children}
      </QueryState>,
    );
    expect(screen.getByText("Loading deals...")).toBeInTheDocument();

    rerender(
      <QueryState query={{ data: undefined, error: new Error("x"), isPending: false }} what="deals">
        {children}
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the deals.");

    rerender(
      <QueryState query={{ data: ["Acme renewal"], error: null, isPending: false }} what="deals">
        {children}
      </QueryState>,
    );
    expect(screen.getByText("Acme renewal")).toBeInTheDocument();
  });
});
