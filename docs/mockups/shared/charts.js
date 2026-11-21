// Small SVG chart helpers for the mockups. The real app uses Recharts (docs/spec.md 7.1).
const niceMax = (v) => {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * p).find((s) => s >= v);
};

let gradSeq = 0;
// Revenue line for the hero panel: Sea Mist text, dark gridlines, the one gradient fill.
function heroLine(values, { w = 860, h = 270, dots = true, endLabel = false } = {}) {
  const pad = { l: 52, r: endLabel ? 64 : 16, t: 16, b: 28 };
  const max = niceMax(Math.max(...values) * 1.08);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i) => pad.l + (i * iw) / (values.length - 1);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const pts = values.map((v, i) => [x(i), y(v)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const id = "hg" + gradSeq++;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    grid += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--hero-grid)"/><text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end">${moneyShort(v)}</text>`;
  }
  const xl = MONTHS.map((m, i) => `<text x="${x(i)}" y="${h - 6}" text-anchor="middle">${m}</text>`).join("");
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#06D6A0" stop-opacity=".30"/><stop offset="1" stop-color="#06D6A0" stop-opacity="0"/></linearGradient></defs>
    ${grid}${xl}
    <path d="${d} L${last[0]} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="#06D6A0" stroke-width="${dots ? 3 : 3.5}" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots ? pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--ink)" stroke="#06D6A0" stroke-width="2"/>`).join("") : ""}
    <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="#06D6A0" stroke="var(--ink)" stroke-width="2.5"/>
    ${endLabel ? `<text x="${last[0] + 12}" y="${last[1] + 4}" style="font:600 13px var(--mono);fill:#fff">${moneyShort(values[values.length - 1])}</text>` : ""}
  </svg>`;
}

// Deals won with deals lost beside them, per month (R72).
function wonLostBars(won, lost, { w = 420, h = 240, lostColor = "var(--sea-mist)", barW = 10 } = {}) {
  const pad = { l: 28, r: 8, t: 12, b: 26 };
  const max = Math.max(...won, ...lost) + 1;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b, slot = iw / won.length;
  const y = (v) => pad.t + ih - (v / max) * ih;
  let out = "";
  for (let i = 0; i <= max; i += 2) out += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(i)}" y2="${y(i)}" stroke="var(--tint)"/><text x="${pad.l - 8}" y="${y(i) + 4}" text-anchor="end">${i}</text>`;
  won.forEach((v, i) => {
    const cx = pad.l + slot * i + slot / 2;
    out += `<rect x="${cx - barW - 1}" y="${y(v)}" width="${barW}" height="${pad.t + ih - y(v)}" rx="3" fill="var(--sea-green)"/>`;
    out += `<rect x="${cx + 1}" y="${y(lost[i])}" width="${barW}" height="${pad.t + ih - y(lost[i])}" rx="3" fill="${lostColor}"/>`;
    out += `<text x="${cx}" y="${h - 6}" text-anchor="middle">${MONTHS[i][0]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}">${out}</svg>`;
}

// Open value by stage as a donut (R73).
function donut(segs, { size = 160, thick = 22 } = {}) {
  const total = sum(segs, (s) => s.v), r = (size - thick) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${segs.map((s) => {
    const len = (s.v / total) * c;
    const a = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(len - 3, 0)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
    return a;
  }).join("")}</svg>`;
}

const openByStage = () => OPEN.map((k) => ({ s: stage(k), n: byStage(k).length, v: sum(byStage(k), (d) => d.value), e: sum(byStage(k), expected) }));
