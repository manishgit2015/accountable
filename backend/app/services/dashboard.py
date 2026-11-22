"""The dashboard's figures (R70–R79, spec 5.5, ADR-015, C-1).

Everything is worked out from the data on each load (R77), with "now" passed in. Months and
the "last 12 months" windows use `closed_at`, never `close_date` (ADR-015). Figures are
aggregated in SQL; only the open follow-ups are loaded as rows, because they're listed.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import Connection, and_, case, func, select
from sqlalchemy.sql.elements import ColumnElement

from app import rules
from app.db import activities, contacts, deals, stage_changes
from app.schemas import (
    Dashboard,
    DashboardCounts,
    FollowUp,
    FollowUps,
    FunnelStage,
    MonthFigures,
    OpenStage,
    Source,
    Summary,
    WinRate,
    WonThisMonth,
)
from app.services.records import day, stamp
from app.services.timeline import recent

FUNNEL_STAGES = ("new", "qualified", "proposal", "negotiation", "won")
WINDOW_MONTHS = 12


def _add_months(first: date, months: int) -> date:
    index = first.year * 12 + first.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def month_starts(today: date) -> list[date]:
    """The first day of each of the last 12 months, the current one included, oldest first (R71)."""
    this_month = today.replace(day=1)
    return [_add_months(this_month, offset) for offset in range(-(WINDOW_MONTHS - 1), 1)]


def _at(first: date) -> str:
    return stamp(datetime.combine(first, datetime.min.time()))


def _closed_between(start: date, end: date) -> ColumnElement[bool]:
    return and_(deals.c.closed_at >= _at(start), deals.c.closed_at < _at(end))


_expected = (deals.c.value * deals.c.probability + 50) // 100  # R20, per deal, as rules.expected_revenue


def open_by_stage(conn: Connection) -> list[OpenStage]:
    """R61, R73: count, value and expected revenue of each open stage."""
    rows = conn.execute(
        select(
            deals.c.stage,
            func.count(deals.c.id).label("count"),
            func.sum(deals.c.value).label("value"),
            func.sum(_expected).label("expected"),
        )
        .where(deals.c.stage.in_(rules.OPEN_STAGES))
        .group_by(deals.c.stage)
    )
    found = {row.stage: row for row in rows}
    return [
        OpenStage(
            stage=stage,
            count=found[stage].count if stage in found else 0,
            value=int(found[stage].value or 0) if stage in found else 0,
            expected=int(found[stage].expected or 0) if stage in found else 0,
        )
        for stage in rules.OPEN_STAGES
    ]


def months(conn: Connection, today: date) -> list[MonthFigures]:
    """R71, R72: revenue won, deals won and deals lost in each of the last 12 months, by closed_at."""
    starts = month_starts(today)
    month = func.substr(deals.c.closed_at, 1, 7)
    rows = conn.execute(
        select(
            month.label("month"),
            func.sum(case((deals.c.stage == "won", deals.c.value), else_=0)).label("revenue_won"),
            func.sum(case((deals.c.stage == "won", 1), else_=0)).label("won"),
            func.sum(case((deals.c.stage == "lost", 1), else_=0)).label("lost"),
        )
        .where(deals.c.stage.in_(rules.CLOSED_STAGES), _closed_between(starts[0], _add_months(starts[-1], 1)))
        .group_by(month)
    )
    found = {row.month: row for row in rows}
    figures = []
    for start in starts:
        key = start.strftime("%Y-%m")
        row = found.get(key)
        figures.append(
            MonthFigures(
                month=key,
                revenue_won=int(row.revenue_won) if row else 0,
                won=int(row.won) if row else 0,
                lost=int(row.lost) if row else 0,
            )
        )
    return figures


def _percent(part: int, whole: int) -> int | None:
    """A whole-number percentage, halves rounded up, or None when there's nothing to divide by."""
    return (part * 200 + whole) // (whole * 2) if whole else None


def summary(open_stages: list[OpenStage], month_figures: list[MonthFigures]) -> Summary:
    """R70: open pipeline, expected revenue, won this month, and the 12-month win rate by count."""
    won = sum(m.won for m in month_figures)
    lost = sum(m.lost for m in month_figures)
    this_month = month_figures[-1]
    return Summary(
        open_value=sum(s.value for s in open_stages),
        expected_revenue=sum(s.expected for s in open_stages),
        won_this_month=WonThisMonth(value=this_month.revenue_won, count=this_month.won),
        win_rate=WinRate(won=won, lost=lost, percent=_percent(won, won + lost)),
    )


def funnel(conn: Connection, today: date) -> list[FunnelStage]:
    """R74 (C-1): for deals created in the last 12 months, the value of those that reached each
    stage. A deal counts at every open stage up to the furthest its history reached, and a won
    deal counts at every stage."""
    rank = case(
        *((stage_changes.c.to_stage == stage, index) for index, stage in enumerate(rules.OPEN_STAGES)),
        else_=-1,
    )
    furthest = (
        select(stage_changes.c.deal_id, func.max(rank).label("reached")).group_by(stage_changes.c.deal_id).subquery()
    )
    won_rank = len(rules.OPEN_STAGES)
    reached = case((deals.c.stage == "won", won_rank), else_=func.coalesce(furthest.c.reached, -1))
    window_start = _at(month_starts(today)[0])
    columns: list[Any] = [
        func.coalesce(func.sum(case((reached >= index, deals.c.value), else_=0)), 0).label(stage)
        for index, stage in enumerate(FUNNEL_STAGES)
    ]
    row = conn.execute(
        select(*columns)
        .select_from(deals.outerjoin(furthest, furthest.c.deal_id == deals.c.id))
        .where(deals.c.created_at >= window_start)
    ).one()
    return [FunnelStage(stage=stage, value=int(row._mapping[stage])) for stage in FUNNEL_STAGES]


def follow_ups(conn: Connection, today: date) -> FollowUps:
    """R76: open follow-ups in Overdue, Today and Next 7 days, and a count of those due later."""
    source_kind = case((activities.c.deal_id.is_not(None), "deal"), else_="contact")
    source_id = case((activities.c.deal_id.is_not(None), activities.c.deal_id), else_=activities.c.contact_id)
    source_name = case((activities.c.deal_id.is_not(None), deals.c.name), else_=contacts.c.name)
    week_end = day(today + timedelta(days=7))
    open_follow_ups = and_(activities.c.follow_up_date.is_not(None), activities.c.done == 0)
    rows = conn.execute(
        select(
            activities,
            source_kind.label("source_kind"),
            source_id.label("source_id"),
            source_name.label("source_name"),
        )
        .select_from(
            activities.outerjoin(deals, activities.c.deal_id == deals.c.id).outerjoin(
                contacts, activities.c.contact_id == contacts.c.id
            )
        )
        .where(open_follow_ups, activities.c.follow_up_date <= week_end)
        .order_by(activities.c.follow_up_date, activities.c.occurred_at, activities.c.id)
    )
    groups: dict[str, list[FollowUp]] = {"overdue": [], "today": [], "next_7_days": []}
    for row in rows:
        data = row._asdict()
        item = FollowUp(
            id=data["id"],
            type=data["type"],
            contact_id=data["contact_id"],
            deal_id=data["deal_id"],
            description=data["description"],
            occurred_at=data["occurred_at"],
            follow_up_date=data["follow_up_date"],
            done=bool(data["done"]),
            source=Source(kind=data["source_kind"], id=data["source_id"], name=data["source_name"]),
        )
        due = data["follow_up_date"]
        group = "overdue" if due < day(today) else "today" if due == day(today) else "next_7_days"
        groups[group].append(item)
    later = conn.execute(
        select(func.count(activities.c.id)).where(open_follow_ups, activities.c.follow_up_date > week_end)
    ).scalar_one()
    return FollowUps(**groups, later_count=int(later))


def late_deals(conn: Connection, today: date) -> int:
    """R19, R79: open deals whose close date is before today."""
    return int(
        conn.execute(
            select(func.count(deals.c.id)).where(deals.c.stage.in_(rules.OPEN_STAGES), deals.c.close_date < day(today))
        ).scalar_one()
    )


def dashboard(conn: Connection, now: datetime) -> Dashboard:
    today = now.date()
    open_stages = open_by_stage(conn)
    month_figures = months(conn, today)
    follow = follow_ups(conn, today)
    return Dashboard(
        today=day(today),
        summary=summary(open_stages, month_figures),
        months=month_figures,
        funnel=funnel(conn, today),
        open_by_stage=open_stages,
        follow_ups=follow,
        recent=recent(conn, now),
        counts=DashboardCounts(overdue_follow_ups=len(follow.overdue), late_deals=late_deals(conn, today)),
    )
