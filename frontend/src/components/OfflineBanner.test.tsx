// V-F10 (part): the "Can't reach Accountable" banner comes and goes with the backend (REL-7).
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../api/client";
import { createQueryClient, setOffline, useOffline } from "../api/queries";
import { OfflineBanner } from "./OfflineBanner";

function Probe() {
  const offline = useOffline();
  useQuery({ queryKey: ["probe"], queryFn: () => apiRequest("GET", "/api/organizations"), retry: false });
  return <OfflineBanner offline={offline} />;
}

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => setOffline(false));
});

describe("OfflineBanner", () => {
  it("REL-7 shows nothing while the backend answers", () => {
    render(<OfflineBanner offline={false} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("REL-7 says what to do when the backend can't be reached", () => {
    render(<OfflineBanner offline />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Can't reach Accountable. Check it's still running in the terminal.",
    );
  });

  it("REL-7 appears when a request can't reach the backend, and goes when one succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
    await act(() => client.refetchQueries({ queryKey: ["probe"] }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
