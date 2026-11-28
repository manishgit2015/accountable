"""V-B13: empty to head, start-up migration, a failed migration changing nothing, and 0001 to 0002 on a
database holding data, which keeps every row (DEP-4, E-8).
"""

from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import Engine, MetaData, inspect

from app import db
from app.config import Settings
from app.main import StartupError, prepare_database

TABLES = {"organizations", "contacts", "deals", "activities", "stage_changes", "users", "alembic_version"}


def _snapshot(engine: Engine) -> dict[str, object]:
    inspector = inspect(engine)
    return {
        table: (
            sorted((c["name"], str(c["type"]), c["nullable"]) for c in inspector.get_columns(table)),
            sorted((ix["name"] or "") for ix in inspector.get_indexes(table)),
            sorted((ck["name"] or "") for ck in inspector.get_check_constraints(table)),
            sorted(
                (fk["name"] or "", fk["referred_table"], fk["options"].get("ondelete"))
                for fk in inspector.get_foreign_keys(table)
            ),
        )
        for table in inspector.get_table_names()
        if table != "alembic_version"
    }


def test_DEP4_empty_file_migrates_to_head(tmp_path: Path) -> None:
    engine = db.create_db_engine(tmp_path / "new.db")
    try:
        assert db.upgrade_to_head(engine) == (None, "0002_people")
        assert set(inspect(engine).get_table_names()) == TABLES
        assert db.upgrade_to_head(engine) == ("0002_people", "0002_people")  # running again changes nothing
    finally:
        engine.dispose()


def test_ENG4_migration_and_table_definitions_agree(engine: Engine, tmp_path: Path) -> None:
    from_metadata = db.create_db_engine(tmp_path / "from-metadata.db")
    try:
        db.metadata.create_all(from_metadata)
        assert _snapshot(engine) == _snapshot(from_metadata)
    finally:
        from_metadata.dispose()


def test_REL9_failed_migration_leaves_the_database_unchanged(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "fail.db"
    engine = db.create_db_engine(path)

    def broken_op(*args: object, **kwargs: object) -> None:
        raise RuntimeError("migration failed half way")

    from alembic.operations import Operations

    original = Operations.create_index
    calls = {"n": 0}

    def fail_on_third_index(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        if calls["n"] == 3:
            broken_op()
        return original(self, *args, **kwargs)

    monkeypatch.setattr(Operations, "create_index", fail_on_third_index)
    with pytest.raises(RuntimeError):
        db.upgrade_to_head(engine)
    assert calls["n"] == 3  # tables were created before the failure
    reflected = MetaData()
    reflected.reflect(engine)
    assert reflected.tables == {}  # ...and rolled back with it
    engine.dispose()


def test_REL9_unreadable_database_stops_start_up_with_one_line(tmp_path: Path) -> None:
    path = tmp_path / "damaged.db"
    path.write_bytes(b"this is not a database" * 100)
    before = path.read_bytes()
    with pytest.raises(StartupError) as caught:
        prepare_database(Settings(db_path=path, log_dir=tmp_path / "logs"))
    assert "\n" not in str(caught.value)
    assert "left unchanged" in str(caught.value)
    assert path.read_bytes() == before


def _upgrade_to(engine: Engine, revision: str) -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(db.ALEMBIC_INI))
    with engine.connect() as conn:
        config.attributes["connection"] = conn
        command.upgrade(config, revision)
        conn.commit()


def test_DEP4_E8_0002_keeps_every_row_of_a_database_holding_data(tmp_path: Path) -> None:
    """A 0001 database with the sample data's shape: same rows after 0002, activities' times filled in, and
    nobody recorded as adding or changing anything (R113)."""
    import sqlalchemy as sa

    engine = db.create_db_engine(tmp_path / "v1.db")
    try:
        _upgrade_to(engine, "0001_initial")
        at = "2026-11-20T09:15:00"
        with engine.begin() as conn:
            conn.execute(sa.text("SELECT 1"))  # test code: the 0001 tables, without app.db's newer columns
            conn.exec_driver_sql(
                "INSERT INTO organizations (name, created_at, updated_at) VALUES ('Acme', ?, ?)", (at, at)
            )
            conn.exec_driver_sql(
                "INSERT INTO contacts (organization_id, name, status, created_at, updated_at) "
                "VALUES (1, 'Jo', 'lead', ?, ?)",
                (at, at),
            )
            conn.exec_driver_sql(
                "INSERT INTO deals (organization_id, contact_id, name, stage, value, probability, close_date, "
                "position, created_at, updated_at) VALUES (1, 1, 'Pilot', 'new', 500, 10, '2026-12-01', 1.0, ?, ?)",
                (at, at),
            )
            conn.exec_driver_sql(
                "INSERT INTO activities (type, deal_id, description, occurred_at) VALUES ('call', 1, 'Called', ?)",
                ("2026-11-19T10:00:00",),
            )
            conn.exec_driver_sql(
                "INSERT INTO stage_changes (deal_id, from_stage, to_stage, changed_at) VALUES (1, NULL, 'new', ?)",
                (at,),
            )
        before, after = db.upgrade_to_head(engine)
        assert (before, after) == ("0001_initial", "0002_people")
        with engine.connect() as conn:
            for table in ("organizations", "contacts", "deals", "activities", "stage_changes"):
                assert conn.exec_driver_sql(f"SELECT count(*) FROM {table}").scalar() == 1, table
            activity = conn.execute(sa.select(db.activities)).one()
            assert (activity.created_at, activity.updated_at) == ("2026-11-19T10:00:00", "2026-11-19T10:00:00")
            for table in (db.organizations, db.contacts, db.deals, db.activities):
                row = conn.execute(sa.select(table.c.created_by, table.c.updated_by)).one()
                assert tuple(row) == (None, None), table.name
            assert conn.execute(sa.select(sa.func.count()).select_from(db.users)).scalar() == 0
            assert conn.execute(sa.select(db.organizations.c.name)).scalar() == "Acme"
            # The links survive the table copies: nothing cascaded or was cleared (E-8).
            assert conn.execute(sa.select(db.contacts.c.organization_id)).scalar() == 1
            assert tuple(conn.execute(sa.select(db.deals.c.organization_id, db.deals.c.contact_id)).one()) == (1, 1)
            assert conn.execute(sa.select(db.activities.c.deal_id)).scalar() == 1
            assert conn.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1  # back on afterwards
    finally:
        engine.dispose()


def test_REL9_E8_a_migration_that_breaks_links_is_rolled_back(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """If SQLite's foreign key check finds a broken link after the migrations, none of them is kept."""
    engine = db.create_db_engine(tmp_path / "broken-links.db")
    try:
        _upgrade_to(engine, "0001_initial")
        real = db._pragmas

        def broken_check(raw, pragmas, outside_transaction=True):  # type: ignore[no-untyped-def]
            if pragmas == db.FOREIGN_KEY_CHECK:
                return [("contacts", 1, "organizations", 0)]
            return real(raw, pragmas, outside_transaction)

        monkeypatch.setattr(db, "_pragmas", broken_check)
        with pytest.raises(db.MigrationError, match="break links"):
            db.upgrade_to_head(engine)
        with engine.connect() as conn:
            assert db.schema_version(conn) == "0001_initial"
            assert "users" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_REV003_R4_a_first_start_that_stops_while_loading_sample_data_leaves_nothing_behind(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The tables and the sample data are kept or undone together. Before, the migrations were committed first,
    so a start that stopped there left tables with no data, and the next start never loaded any (review REV-003)."""
    from sqlalchemy.exc import OperationalError

    from app import seed
    from app.config import FixedClock
    from app.seed import counts

    settings = Settings(
        db_path=tmp_path / "first.db", log_dir=tmp_path / "logs", clock=FixedClock(datetime(2026, 11, 21, 14, 30))
    )
    real_load = seed.load_sample_data

    def stops_half_way(conn, now, replace=True):  # type: ignore[no-untyped-def]
        real_load(conn, now, replace=replace)  # the rows are written...
        raise OperationalError("INSERT", {}, Exception("the connection dropped"))  # ...then the start stops

    monkeypatch.setattr(seed, "load_sample_data", stops_half_way)
    with pytest.raises(StartupError):
        prepare_database(settings)
    engine = db.create_db_engine(settings.db_path)
    try:
        with engine.connect() as conn:
            assert db.schema_version(conn) is None  # the migrations were undone with it
        assert inspect(engine).get_table_names() == []
    finally:
        engine.dispose()

    monkeypatch.setattr(seed, "load_sample_data", real_load)
    assert prepare_database(settings) == (None, "0002_people", True)  # so the next start does both
    engine = db.create_db_engine(settings.db_path)
    try:
        with engine.connect() as conn:
            assert counts(conn)["organizations"] == 12
    finally:
        engine.dispose()
