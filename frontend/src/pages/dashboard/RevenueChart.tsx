import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Dashboard } from "../../api/types";
import { formatMoney, formatMoneyShort, formatMonth } from "../../lib/format";

const AXIS = { fill: "var(--sea-mist)", fontSize: 12, fontFamily: "var(--sans)" };
export const TOOLTIP_STYLE = {
  background: "var(--panel)",
  border: "none",
  borderRadius: 10,
  boxShadow: "var(--shadow)",
  color: "var(--ink)",
  fontFamily: "var(--sans)",
  fontSize: 12,
};

/** R71: revenue won each month for the last 12 months, the current one included. The one gradient. */
export function RevenueChart({ months }: { months: Dashboard["months"] }) {
  const data = months.map((m) => ({ label: formatMonth(m.month), value: m.revenueWon }));
  return (
    <div className="chart hero-chart" role="img" aria-label="Revenue won each month for the last 12 months">
      <ResponsiveContainer width="100%" height={270}>
        <AreaChart data={data} margin={{ top: 12, right: 18, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--sea-green)" stopOpacity={0.3} />
              <stop offset="1" stopColor="var(--sea-green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--hero-grid)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} dy={8} />
          <YAxis
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => formatMoneyShort(v)}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [formatMoney(Number(value)), "Revenue won"]}
            cursor={{ stroke: "var(--sea-mist)", strokeOpacity: 0.4 }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke="var(--sea-green)"
            strokeWidth={3}
            fill="url(#revenue-fill)"
            dot={{ r: 3.5, fill: "var(--ink)", stroke: "var(--sea-green)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "var(--sea-green)", stroke: "var(--ink)", strokeWidth: 2.5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
