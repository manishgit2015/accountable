"""Create, read, update and delete for organizations, contacts, deals and activities.

R10–R13, R21–R23, R34 and R44. A deal's stage effects go through services/moves.py, the one
place they happen (RK-7). Deletes are in services/deletes.py.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import Connection, Row, Select, func, insert, select, update

from app import rules
from app.db import activities, contacts, deals, organizations, stage_changes
from app.schemas import (
    Activity,
    ActivityCreate,
    ActivityUpdate,
    Contact,
    ContactCreate,
    ContactUpdate,
    Deal,
    DealCreate,
    DealUpdate,
    Organization,
    OrganizationCreate,
    OrganizationUpdate,
)
from app.services import Invalid, NotFound

# Formats -------------------------------------------------------------------------------------------


def stamp(moment: datetime) -> str:
    """A local date-time as stored and returned: "2026-11-21T14:30:00" (ADR-013)."""
    return moment.isoformat(timespec="seconds")


def day(value: date) -> str:
    return value.isoformat()


def _changes(body: Any) -> dict[str, Any]:
    """Only the fields sent in a PATCH body (spec 5.3, R34), with dates written as stored."""
    values = body.model_dump(include=body.model_fields_set)
    for key, value in values.items():
        if isinstance(value, datetime):
            values[key] = stamp(value)
        elif isinstance(value, date):
            values[key] = day(value)
    return values


# Organizations (R10, R44) --------------------------------------------------------------------------

_open = deals.c.stage.in_(rules.OPEN_STAGES)


def _organization_query() -> Select[Any]:
    contact_count = (
        select(func.count(contacts.c.id)).where(contacts.c.organization_id == organizations.c.id).scalar_subquery()
    )
    open_deal_count = (
        select(func.count(deals.c.id)).where(deals.c.organization_id == organizations.c.id, _open).scalar_subquery()
    )
    open_value = (
        select(func.coalesce(func.sum(deals.c.value), 0))
        .where(deals.c.organization_id == organizations.c.id, _open)
        .scalar_subquery()
    )
    return select(
        organizations,
        contact_count.label("contact_count"),
        open_deal_count.label("open_deal_count"),
        open_value.label("open_value"),
    )


def list_organizations(conn: Connection) -> list[Organization]:
    rows = conn.execute(_organization_query().order_by(func.lower(organizations.c.name), organizations.c.id))
    return [Organization.model_validate(row._asdict()) for row in rows]


def get_organization(conn: Connection, organization_id: int) -> Organization:
    row = conn.execute(_organization_query().where(organizations.c.id == organization_id)).first()
    if row is None:
        raise NotFound
    return Organization.model_validate(row._asdict())


def create_organization(conn: Connection, body: OrganizationCreate, now: datetime) -> Organization:
    values = body.model_dump()
    new_id = conn.execute(
        insert(organizations).values(**values, created_at=stamp(now), updated_at=stamp(now))
    ).inserted_primary_key
    assert new_id is not None
    return get_organization(conn, new_id[0])


def update_organization(
    conn: Connection, organization_id: int, body: OrganizationUpdate, now: datetime
) -> Organization:
    _require(conn, organizations, organization_id)
    values = _changes(body)
    conn.execute(
        update(organizations).where(organizations.c.id == organization_id).values(**values, updated_at=stamp(now))
    )
    return get_organization(conn, organization_id)


# Contacts (R11, R34) -------------------------------------------------------------------------------


def _contact_query() -> Select[Any]:
    return select(contacts, organizations.c.name.label("organization_name")).outerjoin(
        organizations, contacts.c.organization_id == organizations.c.id
    )


def list_contacts(conn: Connection) -> list[Contact]:
    rows = conn.execute(_contact_query().order_by(func.lower(contacts.c.name), contacts.c.id))
    return [Contact.model_validate(row._asdict()) for row in rows]


def get_contact(conn: Connection, contact_id: int) -> Contact:
    row = conn.execute(_contact_query().where(contacts.c.id == contact_id)).first()
    if row is None:
        raise NotFound
    return Contact.model_validate(row._asdict())


def _check_organization(conn: Connection, organization_id: int) -> str:
    """The organization's name, or a 422 next to the field if it doesn't exist."""
    name = conn.execute(select(organizations.c.name).where(organizations.c.id == organization_id)).scalar()
    if name is None:
        raise Invalid({"organization_id": "That organization doesn't exist. Choose another."})
    return name


def create_contact(conn: Connection, body: ContactCreate, now: datetime) -> Contact:
    _check_organization(conn, body.organization_id)  # required on create, for leads too (R11)
    new_id = conn.execute(
        insert(contacts).values(**body.model_dump(), created_at=stamp(now), updated_at=stamp(now))
    ).inserted_primary_key
    assert new_id is not None
    return get_contact(conn, new_id[0])


def update_contact(conn: Connection, contact_id: int, body: ContactUpdate, now: datetime) -> Contact:
    _require(conn, contacts, contact_id)
    values = _changes(body)
    if "organization_id" in values:  # a link is checked only when it's sent (R34)
        _check_organization(conn, values["organization_id"])
    conn.execute(update(contacts).where(contacts.c.id == contact_id).values(**values, updated_at=stamp(now)))
    return get_contact(conn, contact_id)


# Deals (R12, R15, R23, R67) ------------------------------------------------------------------------


def _deal_query() -> Select[Any]:
    return (
        select(
            deals,
            organizations.c.name.label("organization_name"),
            contacts.c.name.label("contact_name"),
        )
        .outerjoin(organizations, deals.c.organization_id == organizations.c.id)
        .outerjoin(contacts, deals.c.contact_id == contacts.c.id)
    )


def deal_from_row(row: Row[Any], today: date) -> Deal:
    data = row._asdict()
    data["expected_revenue"] = rules.expected_revenue(data["value"], data["probability"])
    data["is_late"] = rules.is_late(data["stage"], date.fromisoformat(data["close_date"]), today)
    return Deal.model_validate(data)


def list_deals(conn: Connection, today: date) -> list[Deal]:
    rows = conn.execute(_deal_query().order_by(deals.c.close_date, deals.c.id))
    return [deal_from_row(row, today) for row in rows]


def get_deal(conn: Connection, deal_id: int, today: date) -> Deal:
    return get_deals(conn, [deal_id], today)[0]


def get_deals(conn: Connection, deal_ids: list[int], today: date) -> list[Deal]:
    """The deals with these IDs, in the order given. A missing one is a 404."""
    rows = {row.id: row for row in conn.execute(_deal_query().where(deals.c.id.in_(deal_ids)))}
    if any(deal_id not in rows for deal_id in deal_ids):
        raise NotFound
    return [deal_from_row(rows[deal_id], today) for deal_id in deal_ids]


def _check_contact_matches(conn: Connection, organization_id: int | None, contact_id: int | None) -> None:
    """R23: the main contact must belong to the deal's organization.

    A link that's empty (cleared by a delete, and not filled in by this save) is exempt (R34).
    """
    org_name = _check_organization(conn, organization_id) if organization_id is not None else None
    if contact_id is None:
        return
    contact_org = conn.execute(select(contacts.c.organization_id).where(contacts.c.id == contact_id)).first()
    if contact_org is None:
        raise Invalid({"contact_id": "That contact doesn't exist. Choose another."})
    if organization_id is not None and contact_org[0] != organization_id:
        raise Invalid({"contact_id": f"Choose a contact from {org_name}."})


def create_deal(conn: Connection, body: DealCreate, now: datetime) -> Deal:
    from app.services.moves import top_of_column

    _check_contact_matches(conn, body.organization_id, body.contact_id)
    effects = rules.creation_effects(body.stage, body.close_date, now, body.probability)
    new_id = conn.execute(
        insert(deals).values(
            organization_id=body.organization_id,
            contact_id=body.contact_id,
            name=body.name,
            stage=effects.stage,
            value=body.value,
            probability=effects.probability,
            close_date=day(effects.close_date),
            position=top_of_column(conn, effects.stage, now),  # R65, R67: the top of its column
            closed_at=stamp(effects.closed_at) if effects.closed_at else None,
            created_at=stamp(now),
            updated_at=stamp(now),
        )
    ).inserted_primary_key
    assert new_id is not None
    # R18: creation is saved as a stage change from no stage.
    conn.execute(
        insert(stage_changes).values(deal_id=new_id[0], from_stage=None, to_stage=effects.stage, changed_at=stamp(now))
    )
    return get_deal(conn, new_id[0], now.date())


def update_deal(conn: Connection, deal_id: int, body: DealUpdate, now: datetime) -> Deal:
    from app.services.moves import change_stage

    current = conn.execute(select(deals).where(deals.c.id == deal_id)).first()
    if current is None:
        raise NotFound
    values = _changes(body)
    if "organization_id" in values or "contact_id" in values:  # R23, checked when either is sent
        _check_contact_matches(
            conn,
            values.get("organization_id", current.organization_id),
            values.get("contact_id", current.contact_id),
        )
    stage = values.pop("stage", None)
    probability = values.pop("probability", None)
    conn.execute(update(deals).where(deals.c.id == deal_id).values(**values, updated_at=stamp(now)))
    if stage is not None or probability is not None:
        # One code path for stage effects, shared with /move (R15–R18, R67).
        change_stage(conn, deal_id, stage or current.stage, now, probability=probability, to_top=True)
    return get_deal(conn, deal_id, now.date())


# Activities (R13, R53, R55) ------------------------------------------------------------------------


def _activity(row: Row[Any]) -> Activity:
    data = row._asdict()
    data["done"] = bool(data["done"])
    return Activity.model_validate(data)


def list_activities(conn: Connection) -> list[Activity]:
    rows = conn.execute(select(activities).order_by(activities.c.occurred_at.desc(), activities.c.id.desc()))
    return [_activity(row) for row in rows]


def get_activity(conn: Connection, activity_id: int) -> Activity:
    row = conn.execute(select(activities).where(activities.c.id == activity_id)).first()
    if row is None:
        raise NotFound
    return _activity(row)


def create_activity(conn: Connection, body: ActivityCreate, now: datetime) -> Activity:
    if body.contact_id is not None:
        _require(conn, contacts, body.contact_id, field="contact_id", message="That contact doesn't exist.")
    if body.deal_id is not None:
        _require(conn, deals, body.deal_id, field="deal_id", message="That deal doesn't exist.")
    new_id = conn.execute(
        insert(activities).values(
            type=body.type,
            contact_id=body.contact_id,
            deal_id=body.deal_id,
            description=body.description,
            occurred_at=stamp(body.occurred_at or now),  # defaults to now, and may be in the future (R13)
            follow_up_date=day(body.follow_up_date) if body.follow_up_date else None,
            done=int(body.done),
        )
    ).inserted_primary_key
    assert new_id is not None
    return get_activity(conn, new_id[0])


def update_activity(conn: Connection, activity_id: int, body: ActivityUpdate) -> Activity:
    _require(conn, activities, activity_id)
    values = _changes(body)
    if "done" in values:
        values["done"] = int(values["done"])
    if values:
        conn.execute(update(activities).where(activities.c.id == activity_id).values(**values))
    return get_activity(conn, activity_id)


# Helpers -------------------------------------------------------------------------------------------


def _require(conn: Connection, table: Any, record_id: int, field: str | None = None, message: str = "") -> None:
    """A 404 when the record isn't there, or a 422 on `field` when it's a link in the body."""
    found = conn.execute(select(table.c.id).where(table.c.id == record_id)).first()
    if found is None:
        raise Invalid({field: message}) if field else NotFound
