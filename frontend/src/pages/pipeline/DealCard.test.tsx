// V-F08: an open card's Late badge in place of the date, and the probability meter's width (R62).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Deal } from "../../api/types";
import { DealCard, meterWidth } from "./DealCard";

const base: Deal = {
  id: 1,
  organizationId: 1,
  organizationName: "Northwind Logistics",
  contactId: 2,
  contactName: "Priya Raman",
  name: "Fleet telematics pilot",
  stage: "proposal",
  value: 36_000,
  probability: 40,
  expectedRevenue: 14_400,
  closeDate: "2026-12-18",
  isLate: false,
  position: 1,
  closedAt: null,
  createdAt: "2026-10-01T09:00:00",
  updatedAt: "2026-10-01T09:00:00",
};

describe("DealCard", () => {
  it("R62 shows initials, name, organization and contact, value and the close date", () => {
    render(<DealCard deal={base} />);
    expect(screen.getByText("NL")).toBeInTheDocument();
    expect(screen.getByText("Fleet telematics pilot")).toBeInTheDocument();
    expect(screen.getByText("Northwind Logistics · Priya Raman")).toBeInTheDocument();
    expect(screen.getByText("$36,000")).toBeInTheDocument();
    expect(screen.getByText("18 Dec 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Late/)).toBeNull();
  });

  it("R62 R19 a late deal shows a Late badge with the date in place of the plain date", () => {
    render(<DealCard deal={{ ...base, closeDate: "2026-11-10", isLate: true }} />);
    const badge = screen.getByText("Late · 10 Nov");
    expect(badge).toHaveClass("badge", "badge-late");
    expect(screen.queryByText("10 Nov 2026")).toBeNull();
  });

  it("R62 draws the probability meter at the deal's percentage", () => {
    render(<DealCard deal={base} />);
    const meter = screen.getByRole("meter", { name: "Probability" });
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter.querySelector("i")).toHaveStyle({ width: "40%" });
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("R62 keeps the meter between 0 and 100", () => {
    expect(meterWidth(0)).toBe("0%");
    expect(meterWidth(100)).toBe("100%");
    expect(meterWidth(140)).toBe("100%");
    expect(meterWidth(-5)).toBe("0%");
  });

  it("R34 a cleared organization or contact is said plainly", () => {
    render(<DealCard deal={{ ...base, organizationName: null, contactName: null }} />);
    expect(screen.getByText("No organization · No contact")).toBeInTheDocument();
  });
});
