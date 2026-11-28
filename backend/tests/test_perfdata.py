"""V-P01's data generator (T4.2, NFR-13): the volume, data that fits the rules, and the real database refused."""

from pathlib import Path

import pytest
from sqlalchemy import Engine, func, select

from app import perfdata, rules
from app.config import DEFAULT_DB_PATH, FixedClock
from app.db import activities, contacts, deals, stage_changes, transaction


def test_NFR13_twice_the_intents_volume_is_what_npm_run_test_perf_generates(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The perf run's default scale, 2, doubles every count. Checked without generating 13,000 rows, which
    takes the generator about 1 second under coverage (NFR-15)."""
    assert perfdata.scaled_volume(2) == {"organizations": 200, "contacts": 2000, "deals": 1000, "activities": 10000}
    asked: list[int] = []
    monkeypatch.setattr(
        perfdata, "generate", lambda _conn, _now, scale: asked.append(scale) or perfdata.scaled_volume(scale)
    )
    monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path / "perf.db"))
    assert perfdata.main([]) == 0
    assert asked == [2]
    assert "200 organizations, 2000 contacts, 1000 deals, 10000 activities" in capsys.readouterr().out


def test_NFR13_generates_the_intents_volume_with_history_that_fits(engine: Engine, clock: FixedClock) -> None:
    now = clock.now()
    with transaction(engine) as conn:
        found = perfdata.generate(conn, now, scale=1)
    assert found == perfdata.scaled_volume(1) == perfdata.BASE_VOLUME
    with engine.connect() as conn:
        rows = conn.execute(select(deals)).mappings().all()
        assert {row["stage"] for row in rows} == set(rules.STAGES)
        # Each deal's latest stage change, read once in order rather than one query per deal (NFR-15).
        history = conn.execute(
            select(stage_changes.c.deal_id, stage_changes.c.to_stage).order_by(
                stage_changes.c.deal_id, stage_changes.c.changed_at, stage_changes.c.id
            )
        )
        last_stage = {deal_id: to_stage for deal_id, to_stage in history}
        for row in rows:
            closed = row["stage"] in ("won", "lost")
            assert (row["closed_at"] is not None) == closed
            assert last_stage[row["id"]] == row["stage"]  # the history ends at the deal's stage (R18)
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
    assert "never uses" in capsys.readouterr().err  # config refuses it in test mode (ADR-027)


def test_NFR13_main_fills_the_database_it_is_given(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path / "perf.db"))
    assert perfdata.main(["--scale", "1"]) == 0
    assert "100 organizations, 1000 contacts, 500 deals, 5000 activities" in capsys.readouterr().out
