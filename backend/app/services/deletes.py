"""Delete-impact counts and deletes (R30–R36).

The deletes rely on the database's foreign key rules (spec 6.1): an organization's contacts and
deals are kept with the link cleared (SET NULL), a contact's deals are kept and its activities
deleted, and a deal's activities and stage changes are deleted (CASCADE). Nothing here repeats
those rules in Python, so the database stays the single source of truth.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection, delete, func, select

from app.db import activities, contacts, deals, organizations, stage_changes
from app.schemas import ContactDeleteImpact, DealDeleteImpact, OrganizationDeleteImpact
from app.services import NotFound


def _count(conn: Connection, table: Any, *conditions: Any) -> int:
    return int(conn.execute(select(func.count()).select_from(table).where(*conditions)).scalar_one())


def _exists(conn: Connection, table: Any, record_id: int) -> None:
    if conn.execute(select(table.c.id).where(table.c.id == record_id)).first() is None:
        raise NotFound


def organization_impact(conn: Connection, organization_id: int) -> OrganizationDeleteImpact:
    _exists(conn, organizations, organization_id)
    return OrganizationDeleteImpact(
        contacts_kept=_count(conn, contacts, contacts.c.organization_id == organization_id),
        deals_kept=_count(conn, deals, deals.c.organization_id == organization_id),
    )


def contact_impact(conn: Connection, contact_id: int) -> ContactDeleteImpact:
    _exists(conn, contacts, contact_id)
    return ContactDeleteImpact(
        deals_kept=_count(conn, deals, deals.c.contact_id == contact_id),
        activities_deleted=_count(conn, activities, activities.c.contact_id == contact_id),
    )


def deal_impact(conn: Connection, deal_id: int) -> DealDeleteImpact:
    _exists(conn, deals, deal_id)
    return DealDeleteImpact(
        activities_deleted=_count(conn, activities, activities.c.deal_id == deal_id),
        stage_changes_deleted=_count(conn, stage_changes, stage_changes.c.deal_id == deal_id),
    )


def delete_record(conn: Connection, table: Any, record_id: int) -> None:
    """Delete one record. Something already gone is a 404 (REL-5), which the frontend treats as done."""
    result = conn.execute(delete(table).where(table.c.id == record_id))
    if result.rowcount == 0:
        raise NotFound


def delete_organization(conn: Connection, organization_id: int) -> None:
    delete_record(conn, organizations, organization_id)  # R31


def delete_contact(conn: Connection, contact_id: int) -> None:
    delete_record(conn, contacts, contact_id)  # R32


def delete_deal(conn: Connection, deal_id: int) -> None:
    delete_record(conn, deals, deal_id)  # R33


def delete_activity(conn: Connection, activity_id: int) -> None:
    delete_record(conn, activities, activity_id)  # R55
