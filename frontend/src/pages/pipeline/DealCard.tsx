import type { Deal } from "../../api/types";
import { Badge } from "../../components/Badge";
import { initials, stageInfo } from "../../lib/deals";
import { formatDate, formatDateShort, formatMoney } from "../../lib/format";

/** The probability meter's fill width: the percentage, kept to 0–100 (R62). */
export function meterWidth(probability: number): string {
  return `${Math.min(100, Math.max(0, probability))}%`;
}

/**
 * An open-stage card (R62, spec 3.9): initials, name, "organization · contact", value, the close date
 * or a Late badge, and a probability meter in the stage color. Drag handling is added by the board.
 */
export function DealCard({ deal, lifted = false }: { deal: Deal; lifted?: boolean }) {
  const color = stageInfo(deal.stage).color;
  const about = [deal.organizationName ?? "No organization", deal.contactName ?? "No contact"].join(" · ");
  return (
    <div className={lifted ? "card lift" : "card"} data-testid="deal-card" data-deal-id={deal.id}>
      <div className="top">
        <span className="chip" aria-hidden="true">
          {initials(deal.organizationName)}
        </span>
        <div className="card-text">
          <div className="t">{deal.name}</div>
          <div className="o">{about}</div>
        </div>
      </div>
      <div className="row">
        <span className="num card-value">{formatMoney(deal.value)}</span>
        {deal.isLate ? (
          <Badge kind="late">Late · {formatDateShort(deal.closeDate)}</Badge>
        ) : (
          <span className="num muted">{formatDate(deal.closeDate)}</span>
        )}
      </div>
      <div
        className="meter"
        role="meter"
        aria-label="Probability"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={deal.probability}
      >
        <i style={{ width: meterWidth(deal.probability), background: color }} />
      </div>
      <div className="row meter-row">
        <span className="muted">Probability</span>
        <span className="num">{deal.probability}%</span>
      </div>
    </div>
  );
}
