import type { Dashboard } from "../../api/types";
import { greeting, summaryLine } from "../../lib/deals";
import { formatDateLong, formatMoney, formatMoneyShort, parseDate } from "../../lib/format";
import { RevenueChart } from "./RevenueChart";

/** Spec 3.9 dashboard row 1: the greeting (R79), the four figures (R70) and the revenue line (R71). */
export function HeroPanel({ dashboard }: { dashboard: Dashboard }) {
  const { summary, counts, months, openByStage } = dashboard;
  const openDeals = openByStage.reduce((sum, s) => sum + s.count, 0);
  const revenue12 = months.reduce((sum, m) => sum + m.revenueWon, 0);
  const won = summary.wonThisMonth;
  const rate = summary.winRate;
  return (
    <section className="hero" aria-label="Summary">
      <div>
        <h1 className="greeting">{greeting(new Date())}</h1>
        <div className="lead">
          {formatDateLong(parseDate(dashboard.today))} · {summaryLine(counts.overdueFollowUps, counts.lateDeals)}
        </div>
        <div className="kgrid">
          <div className="k" data-testid="figure-open">
            <div className="l">Open pipeline</div>
            <div className="v">{formatMoneyShort(summary.openValue)}</div>
            <div className="s">
              {openDeals} open {openDeals === 1 ? "deal" : "deals"}
            </div>
          </div>
          <div className="k" data-testid="figure-expected">
            <div className="l">Expected revenue</div>
            <div className="v">{formatMoneyShort(summary.expectedRevenue)}</div>
            <div className="s">Value × probability</div>
          </div>
          <div className="k" data-testid="figure-won">
            <div className="l">Won this month</div>
            <div className="v won">{formatMoneyShort(won.value)}</div>
            <div className="s">
              {won.count} {won.count === 1 ? "deal" : "deals"} so far
            </div>
          </div>
          <div className="k" data-testid="figure-win-rate">
            <div className="l">Win rate, last 12 months</div>
            <div className="v">{rate.percent === null ? "None yet" : `${rate.percent}%`}</div>
            <div className="s">
              {rate.won} won · {rate.lost} lost
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="chart-head">
          <h2>Revenue won</h2>
          <span className="chart-sub">
            Last 12 months · <span className="num">{formatMoney(revenue12)}</span>
          </span>
        </div>
        {revenue12 === 0 ? (
          <p className="empty-line hero-empty">No deals won in the last 12 months</p>
        ) : (
          <RevenueChart months={months} />
        )}
      </div>
    </section>
  );
}
