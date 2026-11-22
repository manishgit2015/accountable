"""Stage changes and board moves (R15–R18, R24, R63, R67, spec 4.2, 5.4 and 6.4).

`PATCH /api/deals/{id}` and `POST /api/deals/{id}/move` both change a stage through
`change_stage`, so the effects are identical by any route (RK-7). The effects themselves come
from rules.py. Everything runs on the caller's connection, inside the request's one transaction.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Connection, Row, func, insert, select, update
from sqlalchemy.sql.elements import ColumnElement

from app import rules
from app.db import contacts, deals, stage_changes
from app.schemas import DealMove, MoveResult
from app.services import NotFound, StalePosition
from app.services.records import day, get_deals, stamp


def month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def in_column(stage: str, now: datetime) -> ColumnElement[bool]:
    """The deals that make up a board column. Won and Lost hold only this month's (R60, by closed_at)."""
    condition = deals.c.stage == stage
    if not rules.is_open(stage):
        condition = condition & (deals.c.closed_at >= stamp(month_start(now)))
    return condition


def top_of_column(conn: Connection, stage: str, now: datetime, exclude: int | None = None) -> float:
    """Section 6.4: 1.0 above the column's top card."""
    query = select(func.min(deals.c.position)).where(in_column(stage, now))
    if exclude is not None:
        query = query.where(deals.c.id != exclude)
    return rules.top_position(conn.execute(query).scalar())


def _load(conn: Connection, deal_id: int) -> Row[Any]:
    row = conn.execute(select(deals).where(deals.c.id == deal_id)).first()
    if row is None:
        raise NotFound
    return row


def change_stage(
    conn: Connection,
    deal_id: int,
    new_stage: str,
    now: datetime,
    probability: int | None = None,
    to_top: bool = False,
) -> bool:
    """Save a deal with `new_stage` and apply spec 4.2's effects. Returns whether the stage changed.

    `probability` is one sent in the same save, which is kept (R15). With `to_top`, a deal whose
    stage changed goes to the top of its new column (R67). The previous state is read here, in
    the same transaction.
    """
    current = _load(conn, deal_id)
    effects = rules.stage_change_effects(
        rules.DealState(
            stage=current.stage,
            probability=current.probability,
            close_date=datetime.fromisoformat(current.close_date).date(),
            closed_at=datetime.fromisoformat(current.closed_at) if current.closed_at else None,
        ),
        new_stage,
        now,
        probability,
    )
    values: dict[str, Any] = {
        "stage": effects.stage,
        "probability": effects.probability,
        "close_date": day(effects.close_date),
        "closed_at": stamp(effects.closed_at) if effects.closed_at else None,
        "updated_at": stamp(now),
    }
    if effects.records_stage_change and to_top:
        values["position"] = top_of_column(conn, effects.stage, now, exclude=deal_id)
    conn.execute(update(deals).where(deals.c.id == deal_id).values(**values))
    if effects.records_stage_change:  # R18
        conn.execute(
            insert(stage_changes).values(
                deal_id=deal_id, from_stage=current.stage, to_stage=effects.stage, changed_at=stamp(now)
            )
        )
    if effects.contact_becomes_customer and current.contact_id is not None:  # R17
        conn.execute(
            update(contacts)
            .where(contacts.c.id == current.contact_id, contacts.c.status != "customer")
            .values(status="customer", updated_at=stamp(now))
        )
    return effects.records_stage_change


def _column_order(conn: Connection, stage: str, now: datetime, exclude: int) -> list[tuple[int, float]]:
    rows = conn.execute(
        select(deals.c.id, deals.c.position)
        .where(in_column(stage, now), deals.c.id != exclude)
        .order_by(deals.c.position, deals.c.id)
    )
    return [(row.id, row.position) for row in rows]


def _check_neighbours(column: list[int], before_id: int | None, after_id: int | None) -> None:
    """Spec 5.4: both in the target column and next to each other, or the request is stale (409)."""
    if before_id is None and after_id is None:
        if column:
            raise StalePosition
        return
    if before_id is None:
        if not column or column[0] != after_id:
            raise StalePosition
        return
    if after_id is None:
        if not column or column[-1] != before_id:
            raise StalePosition
        return
    if before_id not in column or after_id not in column or column.index(after_id) != column.index(before_id) + 1:
        raise StalePosition


def move(conn: Connection, deal_id: int, body: DealMove, now: datetime) -> MoveResult:
    """POST /api/deals/{id}/move: the stage (if different) and the exact place, in one transaction."""
    _load(conn, deal_id)
    if deal_id in (body.before_id, body.after_id):
        raise StalePosition
    target = body.stage
    # The column is read as it will be once the deal joins it: a deal moving to Won or Lost
    # gets this month's closed_at, so it belongs to the column the board shows (R60).
    column = _column_order(conn, target, now, exclude=deal_id)
    _check_neighbours([deal_id_ for deal_id_, _ in column], body.before_id, body.after_id)

    change_stage(conn, deal_id, target, now)  # R15–R18; a same-stage move adds no row

    positions = dict(column)
    renumbered: list[int] = []
    before = positions.get(body.before_id) if body.before_id is not None else None
    after = positions.get(body.after_id) if body.after_id is not None else None
    if rules.needs_renumber(before, after):
        # Section 6.4: renumber the column 1.0, 2.0, … first, in the same transaction.
        for (other_id, old), new in zip(column, rules.renumbered_positions(len(column)), strict=True):
            positions[other_id] = new
            if new != old:
                conn.execute(update(deals).where(deals.c.id == other_id).values(position=new))
                renumbered.append(other_id)
        before = positions[body.before_id] if body.before_id is not None else None
        after = positions[body.after_id] if body.after_id is not None else None
    conn.execute(update(deals).where(deals.c.id == deal_id).values(position=rules.midpoint(before, after)))

    today = now.date()
    moved, *others = get_deals(conn, [deal_id, *renumbered], today)
    return MoveResult(deal=moved, renumbered=others)
