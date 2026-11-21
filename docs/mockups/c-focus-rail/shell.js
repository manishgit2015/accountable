// Mockup C: slim icon rail.
function rail(active) {
  const items = [["dashboard", "Home", "dashboard.html"], ["pipeline", "Pipeline", "pipeline.html"], ["deals", "Deals", "#"], ["contacts", "Contacts", "#"], ["orgs", "Orgs", "#"]];
  return `<aside class="rail"><span class="mark">A</span>${items.map(([k, l, h]) => `<a href="${h}" class="${k === active ? "on" : ""}">${icon(k)}${l}</a>`).join("")}<span class="me">SR</span></aside>`;
}

// Vertical funnel drawn as stacked trapezoids, width by value reached.
function funnelShape({ w = 300, rowH = 44 } = {}) {
  const max = FUNNEL[0].value, cx = w / 2;
  const widths = FUNNEL.map((f) => Math.max((f.value / max) * w, 40));
  let out = "";
  FUNNEL.forEach((f, i) => {
    const top = widths[i], bot = i < FUNNEL.length - 1 ? widths[i + 1] : widths[i] * 0.9, y = i * (rowH + 4);
    const s = stage(f.key);
    out += `<path d="M${cx - top / 2} ${y} L${cx + top / 2} ${y} L${cx + bot / 2} ${y + rowH} L${cx - bot / 2} ${y + rowH} Z" fill="${s.color}"/>`;
    const dark = ["qualified"].includes(f.key);
    out += `<text x="${cx}" y="${y + rowH / 2 + 4}" text-anchor="middle" style="font:600 12px var(--mono);fill:${dark ? "#fff" : "var(--ink)"}">${moneyShort(f.value)}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${FUNNEL.length * (rowH + 4)}">${out}</svg>`;
}
