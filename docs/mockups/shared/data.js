// Made-up sample data shared by both mockups. "Today" is fixed at Friday 20 Nov 2026.
const STAGES = [
  { key: "new", name: "New", prob: 5, color: "var(--sea-mist)", tint: "#EEF3F4", onColor: "var(--ink)" },
  { key: "qualified", name: "Qualified", prob: 20, color: "var(--cerulean)", tint: "#E3F1F6", onColor: "#fff" },
  { key: "proposal", name: "Proposal", prob: 40, color: "var(--marigold)", tint: "#FFF4DC", onColor: "var(--ink)" },
  { key: "negotiation", name: "Negotiation", prob: 70, color: "var(--coral)", tint: "#FDEBE5", onColor: "var(--ink)" },
  { key: "won", name: "Won", prob: 100, color: "var(--sea-green)", tint: "#DDF8EF", onColor: "var(--ink)" },
  { key: "lost", name: "Lost", prob: 0, color: "var(--raspberry)", tint: "#FDE6EC", onColor: "#fff" },
];
const OPEN = ["new", "qualified", "proposal", "negotiation"];

// Open deals, in board order within each column.
const DEALS = [
  { name: "Fleet telematics pilot", org: "Northwind Logistics", contact: "Priya Raman", stage: "new", value: 18000, close: "2026-12-18" },
  { name: "Website rebuild", org: "Bramble & Oak", contact: "Tom Ashworth", stage: "new", value: 9500, close: "2027-01-10" },
  { name: "Annual support plan", org: "Kestrel Health", contact: "Dana Whitfield", stage: "new", value: 24000, close: "2027-01-22" },
  { name: "POS rollout, 12 stores", org: "Harbor Street Coffee", contact: "Luis Ortega", stage: "new", value: 31000, close: "2027-02-05" },
  { name: "Warehouse scanners", org: "Northwind Logistics", contact: "Priya Raman", stage: "qualified", value: 42000, close: "2026-12-12" },
  { name: "Clinic scheduling suite", org: "Kestrel Health", contact: "Dana Whitfield", stage: "qualified", value: 56000, close: "2026-11-14" },
  { name: "Brand refresh", org: "Lumen Studio", contact: "Ines Laurent", stage: "qualified", value: 14500, close: "2027-01-08" },
  { name: "Cold-chain monitoring", org: "Fernhill Foods", contact: "Grace Okafor", stage: "qualified", value: 27000, close: "2026-12-30" },
  { name: "ERP migration", org: "Atlas Fabrication", contact: "Marcus Bell", stage: "proposal", value: 88000, close: "2026-12-20" },
  { name: "Field sales tablets", org: "Fernhill Foods", contact: "Grace Okafor", stage: "proposal", value: 36000, close: "2026-11-10" },
  { name: "Data warehouse", org: "Copperline Energy", contact: "Hannah Price", stage: "proposal", value: 64000, close: "2027-01-15" },
  { name: "Loyalty app", org: "Harbor Street Coffee", contact: "Luis Ortega", stage: "proposal", value: 22000, close: "2026-12-05" },
  { name: "Plant safety training", org: "Atlas Fabrication", contact: "Marcus Bell", stage: "negotiation", value: 19500, close: "2026-11-28" },
  { name: "Grid analytics licence", org: "Copperline Energy", contact: "Hannah Price", stage: "negotiation", value: 120000, close: "2026-12-15" },
  { name: "Office network upgrade", org: "Bramble & Oak", contact: "Tom Ashworth", stage: "negotiation", value: 16000, close: "2026-11-06" },
  { name: "Telehealth integration", org: "Kestrel Health", contact: "Dana Whitfield", stage: "negotiation", value: 48000, close: "2026-12-08" },
  // Closed this calendar month (R60: the board shows this month only).
  { name: "Route optimisation", org: "Northwind Logistics", contact: "Priya Raman", stage: "won", value: 34000, close: "2026-11-17" },
  { name: "Packaging line sensors", org: "Atlas Fabrication", contact: "Marcus Bell", stage: "won", value: 14500, close: "2026-11-12" },
  { name: "Studio licences", org: "Lumen Studio", contact: "Ines Laurent", stage: "won", value: 8000, close: "2026-11-05" },
  { name: "Spare parts portal", org: "Atlas Fabrication", contact: "Marcus Bell", stage: "won", value: 5000, close: "2026-11-03" },
  { name: "Solar monitoring", org: "Copperline Energy", contact: "Hannah Price", stage: "lost", value: 52000, close: "2026-11-09" },
];

// Last 12 months, Dec 2025 to Nov 2026 (Nov is month to date).
const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
const REVENUE_WON = [42000, 38500, 51000, 47500, 63000, 58000, 71500, 66000, 79000, 84500, 92000, 61500];
const DEALS_WON = [3, 3, 4, 3, 5, 4, 5, 4, 6, 6, 7, 4];
const DEALS_LOST = [2, 1, 2, 3, 2, 2, 1, 3, 2, 2, 1, 1];
// Value reaching each stage, for deals created in the last 12 months (R74).
const FUNNEL = [
  { key: "new", value: 2140000 },
  { key: "qualified", value: 1620000 },
  { key: "proposal", value: 1180000 },
  { key: "negotiation", value: 905000 },
  { key: "won", value: 754500 },
];

const FOLLOW_UPS = {
  overdue: [
    { title: "Send revised ERP quote", about: "ERP migration · Atlas Fabrication", due: "17 Nov" },
    { title: "Chase decision on scheduling suite", about: "Dana Whitfield · Kestrel Health", due: "18 Nov" },
  ],
  today: [
    { title: "Confirm pilot start date", about: "Priya Raman · Northwind Logistics", due: "Today" },
    { title: "Email safety training agenda", about: "Plant safety training · Atlas Fabrication", due: "Today" },
  ],
  week: [
    { title: "Demo grid analytics to the CFO", about: "Grid analytics licence · Copperline Energy", due: "23 Nov" },
    { title: "Check loyalty app scope", about: "Luis Ortega · Harbor Street Coffee", due: "25 Nov" },
    { title: "Send contract draft", about: "Telehealth integration · Kestrel Health", due: "26 Nov" },
  ],
  later: 9,
};

const ACTIVITY = [
  { type: "stage", to: "won", title: "Route optimisation moved from Negotiation to Won", about: "Northwind Logistics", when: "Today, 09:42" },
  { type: "call", title: "Talked through pilot scope, wants 20 vans", about: "Priya Raman · Northwind Logistics", when: "Yesterday, 16:10" },
  { type: "email", title: "Sent the security questionnaire", about: "Telehealth integration · Kestrel Health", when: "Yesterday, 11:05" },
  { type: "stage", to: "negotiation", title: "Grid analytics licence moved from Proposal to Negotiation", about: "Copperline Energy", when: "18 Nov 2026, 15:20" },
  { type: "note", title: "Prefers quotes split by plant", about: "Marcus Bell · Atlas Fabrication", when: "18 Nov 2026, 10:02" },
  { type: "stage", to: "won", title: "Packaging line sensors moved from Negotiation to Won", about: "Atlas Fabrication", when: "12 Nov 2026, 14:48" },
  { type: "call", title: "Budget approved for Q1, wants a phased plan", about: "Hannah Price · Copperline Energy", when: "11 Nov 2026, 09:30" },
  { type: "stage", to: "lost", title: "Solar monitoring moved from Proposal to Lost", about: "Copperline Energy", when: "9 Nov 2026, 17:05" },
  { type: "email", title: "Sent the revised website timeline", about: "Website rebuild · Bramble & Oak", when: "6 Nov 2026, 13:15" },
  { type: "stage", to: "won", title: "Studio licences moved from Proposal to Won", about: "Lumen Studio", when: "5 Nov 2026, 11:40" },
];

/* Helpers */
const stage = (key) => STAGES.find((s) => s.key === key);
const isLate = (d) => OPEN.includes(d.stage) && d.close < "2026-11-20";
const prob = (d) => stage(d.stage).prob;
const expected = (d) => Math.round((d.value * prob(d)) / 100);
const sum = (arr, f) => arr.reduce((t, x) => t + f(x), 0);
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const moneyShort = (n) => {
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
  return "$" + n;
};
const dateLong = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateShort = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const byStage = (key) => DEALS.filter((d) => d.stage === key);
const openDeals = DEALS.filter((d) => OPEN.includes(d.stage));
const OPEN_VALUE = sum(openDeals, (d) => d.value);
const OPEN_EXPECTED = sum(openDeals, expected);
const LATE_COUNT = openDeals.filter(isLate).length;
const WON_TOTAL = sum(DEALS_WON, (x) => x), LOST_TOTAL = sum(DEALS_LOST, (x) => x);
const WIN_RATE = Math.round((WON_TOTAL / (WON_TOTAL + LOST_TOTAL)) * 100);
const initials = (s) => s.split(/[\s&,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* Lucide-style icons, inline so the mockups need no icon package */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  stage: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
};
const icon = (name, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

function topBar(active) {
  const tabs = [["dashboard", "Dashboard", "dashboard.html"], ["pipeline", "Pipeline", "pipeline.html"], ["deals", "Deals", "#"], ["contacts", "Contacts", "#"], ["orgs", "Organizations", "#"]];
  return `<header class="topbar">
    <div class="brand"><span class="mark">A</span>Accountable</div>
    <nav class="tabs">${tabs.map(([k, l, h]) => `<a href="${h}" class="${k === active ? "on" : ""}">${l}</a>`).join("")}</nav>
    <div class="right"><button class="btn btn-primary">${icon("plus")}Add deal</button></div>
  </header>`;
}

function feedItem(a, { sourceStyle = "meta" } = {}) {
  const s = a.type === "stage" ? stage(a.to) : null;
  const ico = s ? `<span class="ico" style="background:${s.color};color:${s.onColor}">${icon("stage")}</span>` : `<span class="ico">${icon(a.type)}</span>`;
  return `<li>${ico}<div class="body"><div class="title">${a.title}</div><div class="meta">${a.about} · ${a.when}</div></div></li>`;
}
function followItem(f, overdue) {
  return `<li><span class="check"></span><div class="body"><div class="title">${f.title}</div><div class="meta">${f.about}</div></div><span class="num" style="font-size:12px;white-space:nowrap;color:${overdue ? "var(--raspberry-text)" : "var(--ink-muted)"}">${f.due}</span></li>`;
}
