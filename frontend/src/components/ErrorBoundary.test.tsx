// V-F10 (part): the error boundary's fallback screen and the request ID it shows (REL-12, OBS-3).
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken({ error }: { error: Error }): never {
  throw error;
}

describe("ErrorBoundary", () => {
  it("REL-12 shows the page's content when nothing goes wrong", () => {
    render(
      <ErrorBoundary>
        <p>Content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Content")).toBeTruthy();
  });

  it("REL-12 shows a message and a reload button instead of a blank screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    render(
      <ErrorBoundary>
        <Broken error={new Error("boom")} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong on this page" })).toBeTruthy();
    expect(screen.queryByText(/Reference:/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("OBS-3 shows the request ID of an API error as a reference", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new ApiError({ status: 500, code: "internal", message: "x", requestId: "9f2c1a7b5e6d4c3b" });
    render(
      <ErrorBoundary>
        <Broken error={error} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Reference: 9f2c1a7b")).toBeTruthy();
  });
});
