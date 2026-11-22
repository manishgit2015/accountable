"""V-P01's data generator (T4.2, NFR-13): the volume, data that fits the rules, and the real database refused."""

from pathlib import Path

import pytest
from sqlalchemy import Engine, func, select

from app import perfdata, rules
from app.config import DEFAULT_DB_PATH, FixedClock
from app.db import activities, contacts, deals, stage_changes, transaction


def test_NFR13_generates_twice_the_intents_volume_with_history_that_fits(engine: Engine, clock: FixedClock) -> None:
    now = clock.now()
    with transaction(engine) as conn:
        found = perfdata.generate(conn, now, scale=2)
    assert found == {"organizations": 200, "contacts": 2000, "deals": 1000, "activities": 10000}
    with engine.connect() as conn:
        rows = conn.execute(select(deals)).mappings().all()
        assert {row["stage"] for row in rows} == set(rules.STAGES)
        for row in rows:
            closed = row["stage"] in ("won", "lost")
            assert (row["closed_at"] is not None) == closed
            last = conn.execute(
                select(stage_changes.c.to_stage)
                .where(stage_changes.c.deal_id == row["id"])
                .order_by(stage_changes.c.changed_at.desc(), stage_changes.c.id.desc())
                .limit(1)
            ).scalar_one()
            assert last == row["stage"]  # the history ends at the deal's stage (R18)
        won_contacts = select(deals.c.contact_id).where(deals.c.stage == "won")
        not_customers = conn.execute(
            select(func.count())
            .select_from(contacts)
            .where(contacts.c.id.in_(won_contacts), contacts.c.status != "customer")
        ).scalar_one()
        assert not_customers == 0  # R17
        future = conn.execute(
            select(func.count()).select_from(activities).where(activities.c.occurred_at > now.isoformat())
        ).scalar_one()
        assert future == 0


def test_RK23_refuses_the_real_database(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setenv("ACCOUNTABLE_DB", str(DEFAULT_DB_PATH))
    monkeypatch.setattr(perfdata, "create_db_engine", lambda _path: pytest.fail("must not open the real database"))
    assert perfdata.main([]) == 2
    assert "refuses the real database" in capsys.readouterr().err


def test_NFR13_main_fills_the_database_it_is_given(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path / "perf.db"))
    assert perfdata.main(["--scale", "1"]) == 0
    assert "100 organizations, 1000 contacts, 500 deals, 5000 activities" in capsys.readouterr().out
