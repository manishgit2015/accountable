"""V-B11: the sample data's counts, coverage and history, and seeding only when new (R4, R80–R84, T2.6)."""

from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select

from app.config import FixedClock, Settings
from app.db import activities, create_db_engine, stage_changes, transaction
from app.main import prepare_database
from app.seed import ORGANIZATIONS, clear_all, counts, load_sample_data


def _seed(engine: Engine, now: datetime) -> dict[str, int]:
    with transaction(engine) as conn:
        return load_sample_data(conn, now)


@pytest.fixture
def seeded(engine: Engine, clock: FixedClock) -> Engine:
    _seed(engine, clock.now())
    return engine


def test_R80_counts(seeded: Engine) -> None:
    with seeded.connect() as conn:
        assert counts(conn) == {"organizations": 12, "contacts": 40, "deals": 45, "activities": 150}


def test_R80_coverage_of_industries_statuses_and_stages(client: TestClient, seeded: Engine) -> None:
    assert len({industry for _, industry, _ in ORGANIZATIONS}) >= 6
    assert {o["industry"] for o in client.get("/api/organizations").json()} >= {"Healthcare", "Energy", "Logistics"}
    statuses = Counter(c["status"] for c in client.get("/api/contacts").json())
    assert set(statuses) == {"lead", "qualified", "customer"}
    stages = Counter(d["stage"] for d in client.get("/api/deals").json())
    assert set(stages) == {"new", "qualified", "proposal", "negotiation", "won", "lost"}


def test_R81_won_and_lost_every_month_open_close_dates_ahead_and_late_deals(client: TestClient, seeded: Engine) -> None:
    dashboard = client.get("/api/dashboard").json()
    assert all(m["won"] >= 1 and m["lost"] >= 1 for m in dashboard["months"]), dashboard["months"]
    today = date(2026, 11, 21)
    open_deals = [
        d for d in client.get("/api/deals").json() if d["stage"] in ("new", "qualified", "proposal", "negotiation")
    ]
    late = [d for d in open_deals if d["is_late"]]
    ahead = [date.fromisoformat(d["close_date"]) for d in open_deals if not d["is_late"]]
    assert len(late) >= 4 and dashboard["counts"]["late_deals"] == len(late)
    assert ahead and all(today <= when <= today + timedelta(days=92) for when in ahead)
    assert max(ahead) > today + timedelta(days=60)  # spread over the next 3 months


def test_R82_follow_ups_overdue_today_this_week_later_and_done(client: TestClient, seeded: Engine) -> None:
    follow_ups = client.get("/api/dashboard").json()["follow_ups"]
    assert follow_ups["overdue"] and follow_ups["today"] and follow_ups["next_7_days"]
    assert follow_ups["later_count"] > 0
    done = [a for a in client.get("/api/activities").json() if a["done"] and a["follow_up_date"]]
    assert done


def test_R83_every_deal_history_starts_at_creation_and_ends_at_its_stage(client: TestClient, seeded: Engine) -> None:
    with seeded.connect() as conn:
        rows = conn.execute(select(stage_changes).order_by(stage_changes.c.deal_id, stage_changes.c.id)).all()
    history: dict[int, list] = {}
    for row in rows:
        history.setdefault(row.deal_id, []).append(row)
    for deal in client.get("/api/deals").json():
        steps = history[deal["id"]]
        assert steps[0].from_stage is None and steps[0].changed_at == deal["created_at"]
        for previous, step in zip(steps, steps[1:], strict=False):
            assert step.from_stage == previous.to_stage
            assert step.changed_at >= previous.changed_at
        assert steps[-1].to_stage == deal["stage"]
        assert deal["updated_at"] == steps[-1].changed_at
        if deal["stage"] in ("won", "lost"):
            assert deal["closed_at"] == steps[-1].changed_at  # walked through the rules (R16)
            assert deal["close_date"] == deal["closed_at"][:10]
        else:
            assert deal["closed_at"] is None
        assert (
            deal["probability"]
            == {"new": 5, "qualified": 20, "proposal": 40, "negotiation": 70, "won": 100, "lost": 0}[deal["stage"]]
        )


def test_R17_contacts_of_won_deals_are_customers(client: TestClient, seeded: Engine) -> None:
    statuses = {c["id"]: c["status"] for c in client.get("/api/contacts").json()}
    for deal in client.get("/api/deals").json():
        if deal["stage"] == "won":
            assert statuses[deal["contact_id"]] == "customer"


def test_R83_nothing_happens_after_now_except_planned_activity(client: TestClient, seeded: Engine) -> None:
    now = "2026-11-21T14:30:00"
    deals = client.get("/api/deals").json()
    assert all(d["created_at"] <= now and (d["closed_at"] or "") <= now for d in deals)
    future = [a for a in client.get("/api/activities").json() if a["occurred_at"] > now]
    assert 0 < len(future) <= 3 and all(a["follow_up_date"] is None for a in future)


def test_spec31_mockup_names_and_made_up_addresses(client: TestClient, seeded: Engine) -> None:
    deals = {d["name"]: d for d in client.get("/api/deals").json()}
    assert deals["Grid analytics licence"]["stage"] == "negotiation"
    assert deals["Route optimisation"]["stage"] == "won"
    assert deals["Route optimisation"]["closed_at"] == "2026-11-21T09:42:00"
    organizations = client.get("/api/organizations").json()
    assert all(o["website"].endswith(".example") for o in organizations)  # R84: no real company's address
    assert all(c["email"].endswith(".example") for c in client.get("/api/contacts").json())
    titles = [f["description"] for f in client.get("/api/dashboard").json()["follow_ups"]["overdue"]]
    assert titles == ["Send revised ERP quote", "Chase decision on scheduling suite"]


def test_R83_the_data_is_the_same_for_the_same_moment_and_moves_with_the_date(engine: Engine) -> None:
    def snapshot(now: datetime) -> list:
        _seed(engine, now)
        with engine.connect() as conn:
            return [tuple(r) for r in conn.execute(select(activities).order_by(activities.c.id))]

    first = snapshot(datetime(2026, 11, 21, 14, 30))
    assert snapshot(datetime(2026, 11, 21, 14, 30)) == first
    later = snapshot(datetime(2026, 11, 28, 14, 30))
    assert later != first
    assert later[5][5][:10] == (datetime.fromisoformat(first[5][5]) + timedelta(days=7)).date().isoformat()


@pytest.mark.parametrize(
    "now", [datetime(2027, 3, 1, 0, 30), datetime(2026, 12, 31, 23, 50), datetime(2028, 2, 29, 8, 0)]
)
def test_R81_coverage_holds_whatever_the_date(
    client: TestClient, engine: Engine, clock: FixedClock, now: datetime
) -> None:
    _seed(engine, now)
    clock.at = now
    dashboard = client.get("/api/dashboard").json()
    assert all(m["won"] >= 1 and m["lost"] >= 1 for m in dashboard["months"]), dashboard["months"]
    deals = client.get("/api/deals").json()
    assert all(d["created_at"] <= now.isoformat() for d in deals)
    assert sum(d["is_late"] for d in deals) >= 4


def test_spec65_seeding_again_replaces_everything_and_clear_empties_every_table(seeded: Engine, clock) -> None:
    with transaction(seeded) as conn:
        assert load_sample_data(conn, clock.now())["deals"] == 45
    with transaction(seeded) as conn:
        assert clear_all(conn) == {"organizations": 12, "contacts": 40, "deals": 45, "activities": 150}
    with seeded.connect() as conn:
        assert counts(conn) == {"organizations": 0, "contacts": 0, "deals": 0, "activities": 0}
        assert conn.execute(select(stage_changes)).first() is None


def test_R4_REL9_only_a_database_just_created_is_seeded(tmp_path: Path, clock: FixedClock) -> None:
    settings = Settings(db_path=tmp_path / "new.db", log_dir=tmp_path / "logs", clock=clock)
    assert prepare_database(settings) == (None, "0002_people", True)
    engine = create_db_engine(settings.db_path)
    with transaction(engine) as conn:
        clear_all(conn)
    assert prepare_database(settings) == ("0002_people", "0002_people", False)
    with engine.connect() as conn:
        assert counts(conn)["deals"] == 0  # an existing (emptied) database is never reseeded
    engine.dispose()
