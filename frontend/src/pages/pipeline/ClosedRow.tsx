import type { Deal } from "../../api/types";
import { formatDateShort, formatMoneyShort } from "../../lib/format";

/** A compact Won or Lost row (R60, spec 3.9): name and organization, short value and date. */
export function ClosedRow({ deal, lifted = false }: { deal: Deal; lifted?: boolean }) {
  return (
    <div className={lifted ? "closed lift" : "closed"} data-testid="closed-row" data-deal-id={deal.id}>
      <div className="closed-text">
        <div className="t" title={deal.name}>
          {deal.name}
        </div>
        <div className="o">{deal.organizationName ?? "No organization"}</div>
      </div>
      <div className="r">
        <div className="num closed-value">{formatMoneyShort(deal.value)}</div>
        <div className="num muted closed-date">{formatDateShort(deal.closeDate)}</div>
      </div>
    </div>
  );
}
