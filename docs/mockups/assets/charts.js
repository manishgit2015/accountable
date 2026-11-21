// Small SVG chart helpers for the mockups. The real app uses Recharts (docs/spec.md).
const niceMax = (v) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return steps.map((s) => s * p).find((s) => s >= v);
};

let gradId = 0;
function lineChart(values, { w = 720, h = 260, color = "var(--sea-green)", stroke = "var(--sea-green-text)", fill = true, labels = MONTHS, fmt = moneyShort, pad = { l: 52, r: 16, t: 16, b: 28 }, gridColor = "var(--tint)", textColor } = {}) {
  const max = niceMax(Math.max(...values) * 1.08);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i) => pad.l + (i * iw) / (values.length - 1);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const pts = values.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const id = "g" + gradId++;
  const tStyle = textColor ? ` style="fill:${textColor}"` : "";
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4, yy = y(v);
    grid += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${yy}" y2="${yy}" stroke="${gridColor}" stroke-width="1"/>`;
    grid += `<text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end"${tStyle}>${fmt(v)}</text>`;
  }
  const xl = labels.map((l, i) => `<text x="${x(i)}" y="${h - 6}" text-anchor="middle"${tStyle}>${l}</text>`).join("");
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#06D6A0" stop-opacity=".28"/><stop offset="1" stop-color="#06D6A0" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}
    ${fill ? `<path d="${path} L${last[0]} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z" fill="url(#${id})"/>` : ""}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="${stroke}" stroke-width="2"/>`).join("")}
    <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="${color}" stroke="#fff" stroke-width="2.5"/>
  </svg>`;
}

function groupedBars(a, b, { w = 420, h = 220, ca = "var(--sea-green)", cb = "var(--sea-mist)", labels = MONTHS, pad = { l: 28, r: 8, t: 12, b: 26 } } = {}) {
  const max = Math.max(...a, ...b) + 1;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const slot = iw / a.length, bw = Math.min(10, slot / 3);
  const y = (v) => pad.t + ih - (v / max) * ih;
  let out = "";
  for (let i = 0; i <= max; i += 2) out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(i)}" y2="${y(i)}" stroke="var(--tint)"/><text x="${pad.l - 8}" y="${y(i) + 4}" text-anchor="end">${i}</text>`;
  a.forEach((v, i) => {
    const cx = pad.l + slot * i + slot / 2;
    out += `<rect x="${cx - bw - 1}" y="${y(v)}" width="${bw}" height="${pad.t + ih - y(v)}" rx="3" fill="${ca}"/>`;
    out += `<rect x="${cx + 1}" y="${y(b[i])}" width="${bw}" height="${pad.t + ih - y(b[i])}" rx="3" fill="${cb}"/>`;
    out += `<text x="${cx}" y="${h - 6}" text-anchor="middle">${labels[i][0]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

function bars(values, { w = 420, h = 200, color = "var(--sea-green)", labels = MONTHS, fmt = moneyShort, pad = { l: 44, r: 8, t: 12, b: 26 }, highlightLast = true } = {}) {
  const max = niceMax(Math.max(...values) * 1.05);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const slot = iw / values.length, bw = slot * 0.58;
  const y = (v) => pad.t + ih - (v / max) * ih;
  let out = "";
  for (let i = 0; i <= 4; i++) { const v = (max * i) / 4; out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--tint)"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`; }
  values.forEach((v, i) => {
    const x = pad.l + slot * i + (slot - bw) / 2;
    const c = highlightLast && i === values.length - 1 ? "var(--marigold)" : color;
    out += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${pad.t + ih - y(v)}" rx="4" fill="${c}"/>`;
    out += `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

function sparkline(values, { w = 120, h = 36, color = "var(--sea-green-text)" } = {}) {
  const max = Math.max(...values), min = Math.min(...values);
  const x = (i) => 2 + (i * (w - 4)) / (values.length - 1);
  const y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const d = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="3" fill="${color}"/></svg>`;
}

/* Funnel: one bar per stage, width by value reached */
function funnelHTML({ compact = false } = {}) {
  const max = FUNNEL[0].value;
  return FUNNEL.map((f, i) => {
    const s = stage(f.key);
    const pct = i ? Math.round((f.value / FUNNEL[i - 1].value) * 100) + "%" : "";
    return `<div style="display:grid;grid-template-columns:${compact ? "84px" : "96px"} 1fr 74px;align-items:center;gap:10px;margin:${compact ? 7 : 18}px 0">
      <span style="font-weight:500">${s.name}</span>
      <span style="display:block;height:${compact ? 18 : 26}px;border-radius:6px;background:var(--tint)"><span style="display:block;height:100%;width:${(f.value / max) * 100}%;border-radius:6px;background:${s.color}"></span></span>
      <span class="num" style="text-align:right;font-size:13px">${moneyShort(f.value)}<span class="muted" style="display:block;font-size:11px;line-height:1.1">${pct ? pct + " carried" : "&nbsp;"}</span></span>
    </div>`;
  }).join("");
}

/* Pipeline by stage: one stacked bar of open value */
function stackedBarHTML({ height = 14, showLegend = true } = {}) {
  const segs = OPEN.map((k) => ({ s: stage(k), v: sum(byStage(k), (d) => d.value), e: sum(byStage(k), expected) }));
  const bar = `<div style="display:flex;gap:3px;height:${height}px">${segs.map((g) => `<span style="flex:${g.v};background:${g.s.color};border-radius:4px"></span>`).join("")}</div>`;
  if (!showLegend) return bar;
  const legend = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:14px">${segs.map((g) => `
    <div><div style="display:flex;align-items:center;gap:8px" class="label"><span class="dot" style="background:${g.s.color}"></span>${g.s.name} · ${byStage(g.s.key).length} deals</div>
    <div class="num" style="font-size:18px;font-weight:600;margin-top:4px">${money(g.v)}</div>
    <div class="label"><span class="num">${money(g.e)}</span> expected</div></div>`).join("")}</div>`;
  return bar + legend;
}

function donut(segs, { size = 180, thick = 26 } = {}) {
  const total = sum(segs, (s) => s.v), r = (size - thick) / 2, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = segs.map((s) => {
    const len = (s.v / total) * c, gap = 3;
    const a = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(len - gap, 0)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
    return a;
  }).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${arcs}</svg>`;
}
