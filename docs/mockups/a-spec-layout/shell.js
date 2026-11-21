// Mockup A: the layout exactly as docs/spec.md describes it. Midnight sidebar, 12-column grid.
function sidebar(active) {
  const items = [
    ["dashboard", "Dashboard", "dashboard.html"],
    ["pipeline", "Pipeline", "pipeline.html"],
    ["deals", "Deals", "#"],
    ["contacts", "Contacts", "#"],
    ["orgs", "Organizations", "#"],
  ];
  return `<aside class="side">
    <div class="brand"><span class="mark">A</span>Accountable</div>
    <nav>${items.map(([k, label, href]) => `<a href="${href}" class="${k === active ? "on" : ""}">${icon(k)}${label}</a>`).join("")}</nav>
    <div class="side-foot"><span class="avatar">SR</span><div><div style="color:#fff;font-weight:600">Sam Rivera</div><div style="font-size:12px">Sales</div></div></div>
  </aside>`;
}
