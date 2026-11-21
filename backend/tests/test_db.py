"""V-B02: connection settings, database-enforced constraints, and E-1 (PRAGMA is the only text SQL)."""

import re
from pathlib import Path

import pytest
from sqlalchemy import Engine, insert, inspect, select
from sqlalchemy.exc import IntegrityError

from app import db
from app.config import BACKEND_DIR

NOW = "2026-11-21T14:30:00"


def _pragma(engine: Engine, name: str) -> object:
    with engine.connect() as conn:
        # Reading a setting back needs PRAGMA text; this is test code, not the app (E-1).
        return conn.exec_driver_sql(f"PRAGMA {name}").scalar()


def test_REL1_REL2_every_connection_has_the_spec_6_3_settings(engine: Engine) -> None:
    assert _pragma(engine, "foreign_keys") == 1
    assert _pragma(engine, "journal_mode") == "wal"
    assert _pragma(engine, "synchronous") == 2  # FULL
    assert _pragma(engine, "busy_timeout") == 5000


def _org(conn, name: str = "Acme Ltd") -> int:  # type: ignore[no-untyped-def]
    return conn.execute(
        insert(db.organizations).values(name=name, created_at=NOW, updated_at=NOW)
    ).inserted_primary_key[0]


def _contact(conn, org_id: int | None) -> int:  # type: ignore[no-untyped-def]
    return conn.execute(
        insert(db.contacts).values(name="Jo", organization_id=org_id, created_at=NOW, updated_at=NOW)
    ).inserted_primary_key[0]


def _deal(conn, **overrides) -> int:  # type: ignore[no-untyped-def]
    values = dict(
        name="Deal",
        stage="new",
        value=1000,
        probability=5,
        close_date="2026-12-01",
        position=1.0,
        created_at=NOW,
        updated_at=NOW,
    )
    values.update(overrides)
    return conn.execute(insert(db.deals).values(**values)).inserted_primary_key[0]


def test_R11_contact_status_defaults_to_lead(engine: Engine) -> None:
    with db.transaction(engine) as conn:
        contact_id = _contact(conn, _org(conn))
        assert conn.execute(select(db.contacts.c.status).where(db.contacts.c.id == contact_id)).scalar() == "lead"


@pytest.mark.parametrize(
    ("table", "values"),
    [
        ("contacts", {"status": "vip"}),
        ("deals", {"stage": "archived"}),
        ("deals", {"value": -1}),
        ("deals", {"value": 1_000_000_001}),
        ("deals", {"probability": 101}),
        ("deals", {"probability": -1}),
        ("deals", {"organization_id": 999}),
    ],
)
def test_spec61_database_refuses_values_outside_the_rules(engine: Engine, table: str, values: dict) -> None:
    with pytest.raises(IntegrityError), db.transaction(engine) as conn:
        if table == "contacts":
            conn.execute(insert(db.contacts).values(name="Jo", created_at=NOW, updated_at=NOW, **values))
        else:
            _deal(conn, **values)


def test_spec61_deal_boundaries_are_accepted(engine: Engine) -> None:
    with db.transaction(engine) as conn:
        _deal(conn, value=0, probability=0)
        _deal(conn, value=1_000_000_000, probability=100)


def test_R13_activity_needs_exactly_one_parent(engine: Engine) -> None:
    with db.transaction(engine) as conn:
        org_id = _org(conn)
        contact_id = _contact(conn, org_id)
        deal_id = _deal(conn)

    base = {"type": "call", "description": "Called", "occurred_at": NOW}
    for parents in ({}, {"contact_id": contact_id, "deal_id": deal_id}):
        with pytest.raises(IntegrityError), db.transaction(engine) as conn:
            conn.execute(insert(db.activities).values(**base, **parents))
    with db.transaction(engine) as conn:
        conn.execute(insert(db.activities).values(**base, contact_id=contact_id))
        conn.execute(insert(db.activities).values(**base, deal_id=deal_id))
    with pytest.raises(IntegrityError), db.transaction(engine) as conn:
        conn.execute(insert(db.activities).values(**{**base, "type": "meeting"}, deal_id=deal_id))


def test_R31_R32_R33_foreign_key_rules_are_enforced_by_the_database(engine: Engine) -> None:
    with db.transaction(engine) as conn:
        org_id = _org(conn)
        contact_id = _contact(conn, org_id)
        deal_id = _deal(conn, organization_id=org_id, contact_id=contact_id)
        conn.execute(insert(db.activities).values(type="note", description="n", occurred_at=NOW, contact_id=contact_id))
        conn.execute(insert(db.activities).values(type="note", description="n", occurred_at=NOW, deal_id=deal_id))
        conn.execute(insert(db.stage_changes).values(deal_id=deal_id, to_stage="new", changed_at=NOW))

    with db.transaction(engine) as conn:
        conn.execute(db.organizations.delete())  # R31: contacts and deals kept, organization cleared
        assert conn.execute(select(db.contacts.c.organization_id)).scalar_one() is None
        assert conn.execute(select(db.deals.c.organization_id)).scalar_one() is None
        conn.execute(db.contacts.delete())  # R32: deal kept with no contact, contact's activities deleted
        assert conn.execute(select(db.deals.c.contact_id)).scalar_one() is None
        assert conn.execute(select(db.activities.c.deal_id)).scalars().all() == [deal_id]
        conn.execute(db.deals.delete())  # R33: its activities and stage changes go too
        assert conn.execute(select(db.activities.c.id)).first() is None
        assert conn.execute(select(db.stage_changes.c.id)).first() is None


def test_spec62_indexes_exist(engine: Engine) -> None:
    inspector = inspect(engine)
    indexed = {
        (table, tuple(ix["column_names"]))
        for table in ("contacts", "deals", "activities", "stage_changes")
        for ix in inspector.get_indexes(table)
    }
    expected = {
        ("contacts", ("organization_id",)),
        ("deals", ("organization_id",)),
        ("deals", ("contact_id",)),
        ("deals", ("stage", "position")),
        ("deals", ("closed_at",)),
        ("activities", ("contact_id",)),
        ("activities", ("deal_id",)),
        ("activities", ("occurred_at",)),
        ("activities", ("follow_up_date", "done")),
        ("stage_changes", ("deal_id", "changed_at")),  # also serves the deal_id foreign key
    }
    assert expected <= indexed


def test_REL2_transaction_rolls_back_everything_on_error(engine: Engine) -> None:
    with pytest.raises(IntegrityError), db.transaction(engine) as conn:
        _org(conn, "Kept?")
        _deal(conn, probability=500)
    with engine.connect() as conn:
        assert conn.execute(select(db.organizations.c.id)).first() is None


# Text SQL through SQLAlchemy (text(), exec_driver_sql, a string to execute) or the raw driver.
TEXT_SQL = re.compile(
    r"\btext\(|exec_driver_sql|executescript|\.cursor\(|dbapi_connection\.execute|\.execute\(\s*f?[\"']"
)


def test_E1_SEC5_pragma_in_the_connection_hook_is_the_only_text_sql() -> None:
    sources = [*(BACKEND_DIR / "app").rglob("*.py"), *(BACKEND_DIR / "migrations").rglob("*.py")]
    offenders = []
    for path in sources:
        for number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
            if TEXT_SQL.search(line):
                offenders.append(f"{path.relative_to(BACKEND_DIR).as_posix()}:{number}: {line.strip()}")
    # db.py's hook runs the statements in CONNECTION_PRAGMAS, and they're all PRAGMAs.
    assert offenders == [f"app/db.py:{_hook_line()}: dbapi_connection.execute(pragma)"]
    assert all(statement.startswith("PRAGMA ") for statement in db.CONNECTION_PRAGMAS)


def _hook_line() -> int:
    lines = (BACKEND_DIR / "app" / "db.py").read_text(encoding="utf-8").splitlines()
    return next(i for i, line in enumerate(lines, 1) if "dbapi_connection.execute(pragma)" in line)
