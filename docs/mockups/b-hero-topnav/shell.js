// Mockup B: floating top navigation.
function topnav(active) {
  const items = [["dashboard", "Dashboard", "dashboard.html"], ["pipeline", "Pipeline", "pipeline.html"], ["deals", "Deals", "#"], ["contacts", "Contacts", "#"], ["orgs", "Organizations", "#"]];
  return `<header class="topnav">
    <div class="brand"><span class="mark">A</span>Accountable</div>
    <nav class="tabs">${items.map(([k, l, h]) => `<a href="${h}" class="${k === active ? "on" : ""}">${l}</a>`).join("")}</nav>
    <div class="right"><button class="btn btn-primary">${icon("plus")}Add deal</button></div>
  </header>`;
}
const initials = (s) => s.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
