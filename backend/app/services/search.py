"""The top-bar search: organizations, contacts and deals by part of their name (R121, R122, R125, ADR-024).

Matching is done here with Python's `casefold()`, not the database's `lower()` or `LIKE`, so the same text
finds the same records in the same order on SQLite and on Postgres, accents and capitals included, and `%`
and `_` are plain characters (R125, the engineer's choice with the plan). It reads every name once per
search, three queries in all, which suits the volumes in NFR-13.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Connection, select

from app.db import contacts, deals, organizations
from app.schemas import (
    ContactHit,
    ContactHits,
    DealHit,
    DealHits,
    OrganizationHit,
    OrganizationHits,
    SearchResults,
)
from app.services import Invalid

MIN_LENGTH = 2
MAX_LENGTH = 200
PER_GROUP = 5
TOO_SHORT_OR_LONG = f"Type {MIN_LENGTH} to {MAX_LENGTH} characters to search."


def _best(rows: list[Any], needle: str) -> tuple[int, list[Any]]:
    """The total number of names containing `needle`, and the best 5: names that start with it first,
    then A–Z, then the oldest record first for equal names (R122)."""
    found = [row for row in rows if needle in row.name.casefold()]
    found.sort(key=lambda row: (not row.name.casefold().startswith(needle), row.name.casefold(), row.id))
    return len(found), found[:PER_GROUP]


def search(conn: Connection, query: str) -> SearchResults:
    text = query.strip()
    if not MIN_LENGTH <= len(text) <= MAX_LENGTH:
        raise Invalid({"q": TOO_SHORT_OR_LONG})
    needle = text.casefold()

    org_rows = list(conn.execute(select(organizations.c.id, organizations.c.name, organizations.c.industry)))
    contact_rows = list(
        conn.execute(
            select(contacts.c.id, contacts.c.name, organizations.c.name.label("organization_name")).outerjoin(
                organizations, contacts.c.organization_id == organizations.c.id
            )
        )
    )
    deal_rows = list(
        conn.execute(
            select(deals.c.id, deals.c.name, deals.c.stage, organizations.c.name.label("organization_name")).outerjoin(
                organizations, deals.c.organization_id == organizations.c.id
            )
        )
    )

    org_total, org_best = _best(org_rows, needle)
    contact_total, contact_best = _best(contact_rows, needle)
    deal_total, deal_best = _best(deal_rows, needle)
    return SearchResults(
        organizations=OrganizationHits(
            total=org_total,
            items=[OrganizationHit(id=r.id, name=r.name, industry=r.industry) for r in org_best],
        ),
        contacts=ContactHits(
            total=contact_total,
            items=[ContactHit(id=r.id, name=r.name, organization_name=r.organization_name) for r in contact_best],
        ),
        deals=DealHits(
            total=deal_total,
            items=[
                DealHit(id=r.id, name=r.name, organization_name=r.organization_name, stage=r.stage) for r in deal_best
            ],
        ),
    )
