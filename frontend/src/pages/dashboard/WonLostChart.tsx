import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { Dashboard } from "../../api/types";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { formatMonth } from "../../lib/format";
import { TOOLTIP_ITEM_STYLE, TOOLTIP_STYLE } from "./RevenueChart";

const AXIS = { fill: "var(--ink-muted)", fontSize: 12, fontFamily: "var(--sans)" };

/** R72: deals won each month for the last 12 months, with deals lost beside them. */
export function WonLostChart({ months }: { months: Dashboard["months"] }) {
  const data = months.map((m) => ({ label: formatMonth(m.month), won: m.won, lost: m.lost }));
  const empty = months.every((m) => m.won === 0 && m.lost === 0);
  return (
    <Panel
      title="Deals won and lost"
      className="c4"
      aside={
        <div className="legend">
          <span>
            <i className="dot" style={{ background: "var(--sea-green)" }} />
            Won
          </span>
          <span>
            <i className="dot" style={{ background: "var(--sea-mist)" }} />
            Lost
          </span>
        </div>
      }
    >
      {empty ? (
        <EmptyState message="No deals closed in the last 12 months" />
      ) : (
        <div className="chart" role="img" aria-label="Deals won and lost each month for the last 12 months">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--tint)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.charAt(0)}
              />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ fill: "var(--tint)", fillOpacity: 0.5 }}
              />
              <Bar dataKey="won" name="Won" fill="var(--sea-green)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="lost" name="Lost" fill="var(--sea-mist)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
