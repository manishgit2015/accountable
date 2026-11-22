import { Cell, Pie, PieChart } from "recharts";

import type { Dashboard } from "../../api/types";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { stageInfo } from "../../lib/deals";
import { formatMoney, formatMoneyShort } from "../../lib/format";

/** R73: open value by stage as a donut in stage colors, the total in the middle, each stage listed. */
export function StageDonut({ openByStage }: { openByStage: Dashboard["openByStage"] }) {
  const total = openByStage.reduce((sum, s) => sum + s.value, 0);
  const segments = openByStage.filter((s) => s.value > 0);
  return (
    <Panel title="Open by stage" className="c3">
      {total === 0 ? (
        <EmptyState message="No open deals" />
      ) : (
        <>
          <div className="donut" role="img" aria-label={`Open value by stage, ${formatMoney(total)} in all`}>
            <PieChart width={150} height={150}>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="stage"
                innerRadius={53}
                outerRadius={75}
                startAngle={90}
                endAngle={-270}
                paddingAngle={1.5}
                stroke="none"
                isAnimationActive={false}
              >
                {segments.map((s) => (
                  <Cell key={s.stage} fill={stageInfo(s.stage).color} />
                ))}
              </Pie>
            </PieChart>
            <div className="donut-center">
              <div className="num donut-total">{formatMoneyShort(total)}</div>
              <div className="label">open</div>
            </div>
          </div>
          <ul className="donut-legend">
            {openByStage.map((s) => (
              <li key={s.stage}>
                <span className="dot" style={{ background: stageInfo(s.stage).color }} aria-hidden="true" />
                {stageInfo(s.stage).label}
                <span className="num">{formatMoney(s.value)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
