import type { Deal } from "../../api/types";
import { OPEN_STAGES } from "../../lib/deals";
import { formatMoney } from "../../lib/format";
import { columnDeals, columnTotals } from "./Column";

/** R61: a stacked bar of open value by stage, with each stage's count, value and expected revenue. */
export function StageStrip({ deals }: { deals: Deal[] }) {
  const stages = OPEN_STAGES.map((stage) => ({ stage, ...columnTotals(columnDeals(stage, deals)) }));
  const total = stages.reduce((sum, s) => sum + s.value, 0);
  return (
    <section className="panel stage-strip" aria-label="Open pipeline by stage">
      <div className="strip-bar" aria-hidden="true">
        {total > 0 ? (
          stages.map(({ stage, value }) =>
            value > 0 ? <span key={stage.key} style={{ flex: value, background: stage.color }} /> : null,
          )
        ) : (
          <span className="strip-empty" />
        )}
      </div>
      <div className="strip-legend">
        {stages.map(({ stage, count, value, expected }) => (
          <div key={stage.key} data-stage={stage.key}>
            <div className="label strip-label">
              <span className="dot" style={{ background: stage.color }} aria-hidden="true" />
              {stage.label} · {count} {count === 1 ? "deal" : "deals"}
            </div>
            <div className="num strip-value">{formatMoney(value)}</div>
            <div className="label">
              <span className="num">{formatMoney(expected)}</span> expected
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
