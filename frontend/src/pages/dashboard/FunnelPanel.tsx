import type { Dashboard } from "../../api/types";
import { EmptyState } from "../../components/EmptyState";
import { Panel } from "../../components/Panel";
import { stageInfo } from "../../lib/deals";
import { formatMoney, formatMoneyShort } from "../../lib/format";

/** R74: value reaching each stage from New to Won, with the share carried over from the stage before. */
export function FunnelPanel({ funnel }: { funnel: Dashboard["funnel"] }) {
  const top = funnel[0]?.value ?? 0;
  return (
    <Panel
      title="Sales funnel"
      className="c5"
      aside={<span className="sub">Value reaching each stage · deals created in the last 12 months</span>}
    >
      {top === 0 ? (
        <EmptyState message="No deals created in the last 12 months" />
      ) : (
        <div role="list" aria-label="Sales funnel">
          {funnel.map((row, i) => {
            const info = stageInfo(row.stage);
            const previous = i > 0 ? funnel[i - 1]?.value : undefined;
            const carried = previous ? `${Math.round((row.value / previous) * 100)}% carried` : null;
            return (
              <div className="funnel-row" role="listitem" key={row.stage} title={formatMoney(row.value)}>
                <span className="funnel-name">{info.label}</span>
                <span className="track">
                  <span className="fill" style={{ width: `${(row.value / top) * 100}%`, background: info.color }} />
                </span>
                <span className="fig num">
                  {formatMoneyShort(row.value)}
                  {carried && <small>{carried}</small>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
