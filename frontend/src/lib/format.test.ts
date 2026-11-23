// V-F01: money and dates as spec 3.9 Writing sets them.
import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatMoney,
  formatMoneyShort,
  formatPercent,
  formatMonth,
  formatRelativeDate,
  parseDate,
  parseDateTime,
  toIsoDate,
  toIsoDateTime,
} from "./format";

describe("money", () => {
  it("spec 3.9 shows whole dollars with the currency and thousands separators", () => {
    expect(formatMoney(12500)).toBe("$12,500");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1_000_000_000)).toBe("$1,000,000,000");
    expect(formatMoney(999.5)).toBe("$1,000");
  });

  it("spec 3.9 shortens large figures to K and M", () => {
    expect(formatMoneyShort(1_200_000)).toBe("$1.2M");
    expect(formatMoneyShort(2_140_000)).toBe("$2.14M");
    expect(formatMoneyShort(1_000_000)).toBe("$1M");
    expect(formatMoneyShort(82_500)).toBe("$82.5K");
    expect(formatMoneyShort(61_500)).toBe("$61.5K");
    expect(formatMoneyShort(636_000)).toBe("$636K");
    expect(formatMoneyShort(139_500)).toBe("$140K");
    expect(formatMoneyShort(5_000)).toBe("$5K");
    expect(formatMoneyShort(999_950)).toBe("$1M");
    expect(formatMoneyShort(950)).toBe("$950");
    expect(formatMoneyShort(0)).toBe("$0");
  });
});

describe("dates", () => {
  it("spec 3.9 shows dates as 12 Nov 2026 in tables", () => {
    expect(formatDate("2026-11-12")).toBe("12 Nov 2026");
    expect(formatDate("2027-01-05")).toBe("5 Jan 2027");
    expect(formatDateShort("2026-11-12")).toBe("12 Nov");
  });

  it("spec 3.9 shows timeline times with Today and Yesterday for recent ones", () => {
    const now = new Date(2026, 10, 21, 14, 30);
    expect(formatDateTime("2026-11-21T09:42:00", now)).toBe("Today, 09:42");
    expect(formatDateTime("2026-11-20T16:10:00", now)).toBe("Yesterday, 16:10");
    expect(formatDateTime("2026-11-12T14:30:00", now)).toBe("12 Nov 2026, 14:30");
    expect(formatRelativeDate("2026-11-22", now)).toBe("22 Nov 2026");
  });

  it("ADR-013 reads and writes local dates and times with no time zone", () => {
    const d = parseDate("2026-11-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 1, 0]);
    const t = parseDateTime("2026-11-21T14:30:05");
    expect([t.getHours(), t.getMinutes(), t.getSeconds()]).toEqual([14, 30, 5]);
    expect(toIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
    expect(toIsoDateTime(new Date(2026, 10, 21, 9, 5, 7))).toBe("2026-11-21T09:05:07");
  });

  it("R79 writes the greeting's date in full, and chart months as short names", () => {
    expect(formatDateLong(new Date(2026, 10, 21))).toBe("Saturday 21 November 2026");
    expect(formatMonth("2025-12")).toBe("Dec");
    expect(formatMonth("2026-11")).toBe("Nov");
  });
});

describe("formatPercent", () => {
  it("rounds to a whole percentage", () => {
    expect(formatPercent(40)).toBe("40%");
    expect(formatPercent(66.6)).toBe("67%");
  });
});
