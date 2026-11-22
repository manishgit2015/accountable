"""Timelines: activities and stage changes merged, newest first, with their source (R50–R54, R75).

Each timeline takes two queries, one for activities and one for stage changes, whatever its
length (no query per entry).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Connection, case, literal, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.db import activities, contacts, deals, organizations, stage_changes
from app.schemas import Source, TimelineEntry
from app.services import NotFound
from app.services.records import stamp

# An activity's source is its deal when it's on a deal, otherwise its contact (R54).
_activity_columns = (
    activities.c.id,
    activities.c.type,
    activities.c.description,
    activities.c.occurred_at.label("at"),
    case((activities.c.deal_id.is_not(None), literal("deal")), else_=literal("contact")).label("source_kind"),
    case((activities.c.deal_id.is_not(None), activities.c.deal_id), else_=activities.c.contact_id).label("source_id"),
    case((activities.c.deal_id.is_not(None), deals.c.name), else_=contacts.c.name).label("source_name"),
)
_activity_from = activities.outerjoin(deals, activities.c.deal_id == deals.c.id).outerjoin(
    contacts, activities.c.contact_id == contacts.c.id
)
_change_columns = (
    stage_changes.c.id,
    stage_changes.c.from_stage,
    stage_changes.c.to_stage,
    stage_changes.c.changed_at.label("at"),
    deals.c.id.label("source_id"),
    deals.c.name.label("source_name"),
)
_change_from = stage_changes.join(deals, stage_changes.c.deal_id == deals.c.id)


def _entries(
    conn: Connection,
    activity_filter: ColumnElement[bool],
    change_filter: ColumnElement[bool],
    limit: int | None = None,
    until: datetime | None = None,
) -> list[TimelineEntry]:
    activity_query = select(*_activity_columns).select_from(_activity_from).where(activity_filter)
    change_query = select(*_change_columns).select_from(_change_from).where(change_filter)
    if until is not None:
        activity_query = activity_query.where(activities.c.occurred_at <= stamp(until))
        change_query = change_query.where(stage_changes.c.changed_at <= stamp(until))
    if limit is not None:
        activity_query = activity_query.order_by(activities.c.occurred_at.desc(), activities.c.id.desc()).limit(limit)
        change_query = change_query.order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc()).limit(limit)

    entries: list[tuple[tuple[str, int, int], TimelineEntry]] = []
    for row in conn.execute(activity_query):
        entry = TimelineEntry(
            kind="activity",
            id=row.id,
            type=row.type,
            from_stage=None,
            to_stage=None,
            description=row.description,
            at=row.at,
            source=Source(kind=row.source_kind, id=row.source_id, name=row.source_name),
        )
        entries.append(((row.at, 0, row.id), entry))
    for row in conn.execute(change_query):
        entry = TimelineEntry(
            kind="stage_change",
            id=row.id,
            type=None,
            from_stage=row.from_stage,
            to_stage=row.to_stage,
            description=None,
            at=row.at,
            source=Source(kind="deal", id=row.source_id, name=row.source_name),
        )
        # At the same moment, a stage change sorts above an activity: the move came last.
        entries.append(((row.at, 1, row.id), entry))
    entries.sort(key=lambda pair: pair[0], reverse=True)
    result = [entry for _, entry in entries]
    return result[:limit] if limit is not None else result


def _require(conn: Connection, table: Any, record_id: int) -> None:
    if conn.execute(select(table.c.id).where(table.c.id == record_id)).first() is None:
        raise NotFound


def deal_timeline(conn: Connection, deal_id: int) -> list[TimelineEntry]:
    """R52: the deal's activities and stage changes."""
    _require(conn, deals, deal_id)
    return _entries(conn, activities.c.deal_id == deal_id, stage_changes.c.deal_id == deal_id)


def contact_timeline(conn: Connection, contact_id: int) -> list[TimelineEntry]:
    """R51: their own activities, plus the activities and stage changes of deals where they're
    the main contact now."""
    _require(conn, contacts, contact_id)
    their_deals = select(deals.c.id).where(deals.c.contact_id == contact_id).scalar_subquery()
    return _entries(
        conn,
        or_(activities.c.contact_id == contact_id, activities.c.deal_id.in_(their_deals)),
        stage_changes.c.deal_id.in_(their_deals),
    )


def organization_timeline(conn: Connection, organization_id: int) -> list[TimelineEntry]:
    """R50: its contacts' activities, its deals' activities and its deals' stage changes."""
    _require(conn, organizations, organization_id)
    its_contacts = select(contacts.c.id).where(contacts.c.organization_id == organization_id).scalar_subquery()
    its_deals = select(deals.c.id).where(deals.c.organization_id == organization_id).scalar_subquery()
    return _entries(
        conn,
        or_(activities.c.contact_id.in_(its_contacts), activities.c.deal_id.in_(its_deals)),
        stage_changes.c.deal_id.in_(its_deals),
    )


def recent(conn: Connection, now: datetime, limit: int = 10) -> list[TimelineEntry]:
    """R75: the latest activities and stage changes. Planned activity (in the future) waits until it happens."""
    everything = literal(True)
    return _entries(conn, everything, everything, limit=limit, until=now)
