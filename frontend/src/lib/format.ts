// Money and dates, as spec 3.9 Writing sets them. Pure functions: no clock reads except through `now`.
//
// - Money always shows its currency: "$12,500", or "$1.2M" / "$82.5K" for large figures.
// - Dates: "12 Nov 2026" in tables, "12 Nov 2026, 14:30" in timelines, with "Today" and "Yesterday".
// - The API's dates are "YYYY-MM-DD" and its date-times local times with no time zone (ADR-013).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** "$12,500". Whole dollars, rounded. */
export function formatMoney(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

/** "$1.2M", "$82.5K", "$636K", "$950". For big figures, chart axes and compact rows. */
export function formatMoneyShort(value: number): string {
  const n = Math.round(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  if (n >= 1e6) return `${sign}$${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1e3) {
    const thousands = (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "");
    // 999,950 rounds to "1000K": show it as "$1M" instead.
    return thousands === "1000" ? `${sign}$1M` : `${sign}$${thousands}K`;
  }
  return `${sign}$${n}`;
}

/** "40%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** Parse "YYYY-MM-DD" as a local calendar date (never UTC). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Parse "YYYY-MM-DDTHH:MM:SS" as a local date-time. */
export function parseDateTime(iso: string): Date {
  const [datePart, timePart = "00:00:00"] = iso.split("T");
  const date = parseDate(datePart ?? iso);
  const [h, min, s] = timePart.split(":").map(Number);
  date.setHours(h ?? 0, min ?? 0, Math.floor(s ?? 0), 0);
  return date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The local date as "YYYY-MM-DD", the API's date form. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local date-time as "YYYY-MM-DDTHH:MM:SS", the API's date-time form. */
export function toIsoDateTime(date: Date): string {
  return `${toIsoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** "YYYY-MM-DDTHH:MM", for a datetime-local input. */
export function toInputDateTime(iso: string): string {
  return iso.slice(0, 16);
}

/** "12 Nov 2026" */
export function formatDate(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "12 Nov" */
export function formatDateShort(iso: string): string {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Saturday 21 November 2026", for the dashboard greeting. */
export function formatDateLong(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function dayDifference(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((start - end) / 86_400_000);
}

/** "Today", "Yesterday" or "12 Nov 2026", for a date. */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const diff = dayDifference(parseDate(iso), now);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return formatDate(iso);
}

/** "Today, 14:30", "Yesterday, 09:05" or "12 Nov 2026, 14:30", for a timeline. */
export function formatDateTime(iso: string, now: Date = new Date()): string {
  const d = parseDateTime(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${formatRelativeDate(iso.slice(0, 10), now)}, ${time}`;
}

/** "Nov" for "2026-11", for chart axes. */
export function formatMonth(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return MONTHS[index] ?? month;
}
