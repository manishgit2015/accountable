"""V-B13 (T1.4 part): empty to head, start-up migration, and a failed migration changing nothing.

The upgrade from a previous version holding data is added with the first migration after 0001.
"""

from pathlib import Path

import pytest
from sqlalchemy import Engine, MetaData, inspect

from app import db
from app.config import Settings
from app.main import StartupError, prepare_database

TABLES = {"organizations", "contacts", "deals", "activities", "stage_changes", "alembic_version"}


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
        assert db.upgrade_to_head(engine) == (None, "0001_initial")
        assert set(inspect(engine).get_table_names()) == TABLES
        assert db.upgrade_to_head(engine) == ("0001_initial", "0001_initial")  # running again changes nothing
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
