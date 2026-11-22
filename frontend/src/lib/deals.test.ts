// V-F02: late check, expected revenue, greeting times, initials, and the stage list.
import { describe, expect, it } from "vitest";

import {
  STAGES,
  closedThisMonth,
  expectedRevenue,
  greeting,
  initials,
  isLate,
  summaryLine,
  usualProbability,
} from "./deals";

const today = new Date(2026, 10, 21, 14, 30);

describe("stages", () => {
  it("R14 lists the six stages in board order with their usual probabilities", () => {
    expect(STAGES.map((s) => [s.key, s.probability])).toEqual([
      ["new", 5],
      ["qualified", 20],
      ["proposal", 40],
      ["negotiation", 70],
      ["won", 100],
      ["lost", 0],
    ]);
    expect(usualProbability("negotiation")).toBe(70);
  });
});

describe("late", () => {
  it("R19 a deal is late when it's open and its close date is before today", () => {
    expect(isLate({ stage: "proposal", closeDate: "2026-11-20" }, today)).toBe(true);
    expect(isLate({ stage: "new", closeDate: "2026-11-21" }, today)).toBe(false);
    expect(isLate({ stage: "negotiation", closeDate: "2026-12-01" }, today)).toBe(false);
  });

  it("R19 a won or lost deal is never late", () => {
    expect(isLate({ stage: "won", closeDate: "2026-01-01" }, today)).toBe(false);
    expect(isLate({ stage: "lost", closeDate: "2026-01-01" }, today)).toBe(false);
  });
});

describe("expected revenue", () => {
  it("R20 is value times probability over 100, to the nearest dollar", () => {
    expect(expectedRevenue(88_000, 40)).toBe(35_200);
    expect(expectedRevenue(1_000_000_000, 100)).toBe(1_000_000_000);
    expect(expectedRevenue(0, 70)).toBe(0);
    expect(expectedRevenue(10, 5)).toBe(1); // 0.5 rounds up
    expect(expectedRevenue(9, 5)).toBe(0); // 0.45 rounds down
  });
});

describe("greeting", () => {
  it("R79 says Good morning before 12:00", () => {
    expect(greeting(new Date(2026, 10, 21, 0, 0))).toBe("Good morning");
    expect(greeting(new Date(2026, 10, 21, 11, 59))).toBe("Good morning");
  });

  it("R79 says Good afternoon from 12:00 to 17:59", () => {
    expect(greeting(new Date(2026, 10, 21, 12, 0))).toBe("Good afternoon");
    expect(greeting(new Date(2026, 10, 21, 17, 59))).toBe("Good afternoon");
  });

  it("R79 says Good evening from 18:00", () => {
    expect(greeting(new Date(2026, 10, 21, 18, 0))).toBe("Good evening");
    expect(greeting(new Date(2026, 10, 21, 23, 59))).toBe("Good evening");
  });

  it("R79 counts overdue follow-ups and late deals, or says Nothing overdue", () => {
    expect(summaryLine(2, 3)).toBe("2 follow-ups overdue, 3 deals running late");
    expect(summaryLine(1, 0)).toBe("1 follow-up overdue");
    expect(summaryLine(0, 1)).toBe("1 deal running late");
    expect(summaryLine(0, 0)).toBe("Nothing overdue");
  });
});

describe("initials", () => {
  it("spec 3.9 takes the first letters of the first two words", () => {
    expect(initials("Northwind Logistics")).toBe("NL");
    expect(initials("Bramble & Oak")).toBe("BO");
    expect(initials("lumen")).toBe("L");
    expect(initials(null)).toBe("–");
  });
});

describe("closed this month", () => {
  it("R60 counts a deal closed on or after the 1st of this month, by closed_at", () => {
    expect(closedThisMonth({ closedAt: "2026-11-01T00:00:00" }, today)).toBe(true);
    expect(closedThisMonth({ closedAt: "2026-10-31T23:59:59" }, today)).toBe(false);
    expect(closedThisMonth({ closedAt: null }, today)).toBe(false);
  });
});
