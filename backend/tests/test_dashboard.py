"""V-B10: every dashboard figure on a fixed data set, the funnel from history, follow-up groups,
the month boundary and an empty database (R70–R79, ADR-015, C-1, T2.8)."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from tests.conftest import PRIYA

MONTHS = ["2025-12", *(f"2026-{m:02d}" for m in range(1, 12))]


def test_R78_an_empty_database_gives_zeros_and_none_yet(client: TestClient) -> None:
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    assert response.json() == {
        "today": "2026-11-21",
        "summary": {
            "open_value": 0,
            "expected_revenue": 0,
            "won_this_month": {"value": 0, "count": 0},
            "win_rate": {"won": 0, "lost": 0, "percent": None},
        },
        "months": [{"month": m, "revenue_won": 0, "won": 0, "lost": 0} for m in MONTHS],
        "funnel": [{"stage": s, "value": 0} for s in ("new", "qualified", "proposal", "negotiation", "won")],
        "open_by_stage": [
            {"stage": s, "count": 0, "value": 0, "expected": 0} for s in ("new", "qualified", "proposal", "negotiation")
        ],
        "follow_ups": {"overdue": [], "today": [], "next_7_days": [], "later_count": 0},
        "recent": [],
        "counts": {"overdue_follow_ups": 0, "late_deals": 0},
    }


@pytest.fixture
def data(client: TestClient, clock) -> dict:
    """Deals walked through their stages at known moments, and follow-ups around today (Sat 21 Nov 2026)."""
    org = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org}).json()["id"]
    ids: dict[str, int] = {"org": org, "jo": jo}

    def deal(key: str, value: int, created: str, path: list[tuple[str, str]], close_date: str = "2027-01-01") -> None:
        clock.at = datetime.fromisoformat(created)
        stage = path[0][0]
        body = {"name": key, "organization_id": org, "contact_id": jo, "stage": stage, "value": value}
        ids[key] = client.post("/api/deals", json={**body, "close_date": close_date}).json()["id"]
        for stage, when in path[1:]:
            clock.at = datetime.fromisoformat(when)
            assert client.patch(f"/api/deals/{ids[key]}", json={"stage": stage}).status_code == 200

    deal(
        "won_april",
        10000,
        "2026-03-10T09:00",
        [
            ("new", ""),
            ("qualified", "2026-03-20T09:00"),
            ("proposal", "2026-04-01T09:00"),
            ("negotiation", "2026-04-10T09:00"),
            ("won", "2026-04-15T09:00"),
        ],
    )
    deal(
        "lost_june",
        4000,
        "2026-06-01T09:00",
        [("new", ""), ("qualified", "2026-06-05T09:00"), ("lost", "2026-06-20T09:00")],
    )
    deal("late_new", 2000, "2026-11-02T09:00", [("new", "")], close_date="2026-11-10")
    deal(
        "open_negotiation",
        8000,
        "2026-10-01T09:00",
        [("qualified", ""), ("proposal", "2026-10-10T09:00"), ("negotiation", "2026-10-20T09:00")],
    )
    deal("won_october", 3000, "2026-10-31T09:00", [("new", ""), ("won", "2026-10-31T23:59:59")])
    deal("won_november", 6000, "2026-10-31T10:00", [("new", ""), ("won", "2026-11-01T00:00:00")])
    deal("won_too_long_ago", 50000, "2025-10-01T09:00", [("new", ""), ("won", "2025-11-30T23:59:59")])
    deal("lost_november", 1000, "2026-11-10T09:00", [("proposal", ""), ("lost", "2026-11-12T09:00")])

    clock.at = datetime(2026, 11, 21, 14, 30)

    def follow(key: str, due: str | None, done: bool = False, when: str = "2026-11-15T10:00", **parent: int) -> None:
        body = {"type": "call", "description": key, "occurred_at": when, "follow_up_date": due, "done": done}
        ids[key] = client.post("/api/activities", json={**body, **(parent or {"contact_id": jo})}).json()["id"]

    follow("overdue", "2026-11-20", deal_id=ids["late_new"])
    follow("done_overdue", "2026-11-19", done=True)
    follow("due_today", "2026-11-21")
    follow("tomorrow", "2026-11-22")
    follow("in_7_days", "2026-11-28")
    follow("in_8_days", "2026-11-29")
    follow("no_follow_up", None, when="2026-11-21T14:00")
    follow("planned", None, when="2026-11-25T10:00")
    return ids


def test_R70_R73_summary_and_open_pipeline_by_stage(client: TestClient, data: dict) -> None:
    body = client.get("/api/dashboard").json()
    assert body["summary"] == {
        "open_value": 10000,
        "expected_revenue": 100 + 5600,  # 2,000 × 5% and 8,000 × 70%
        "won_this_month": {"value": 6000, "count": 1},
        "win_rate": {"won": 3, "lost": 2, "percent": 60},  # the last 12 months, by closed_at
    }
    assert body["open_by_stage"] == [
        {"stage": "new", "count": 1, "value": 2000, "expected": 100},
        {"stage": "qualified", "count": 0, "value": 0, "expected": 0},
        {"stage": "proposal", "count": 0, "value": 0, "expected": 0},
        {"stage": "negotiation", "count": 1, "value": 8000, "expected": 5600},
    ]


def test_R71_R72_ADR015_months_by_closed_at_with_the_boundary_minute(client: TestClient, data: dict) -> None:
    months = {m["month"]: m for m in client.get("/api/dashboard").json()["months"]}
    assert list(months) == MONTHS
    assert months["2026-04"] == {"month": "2026-04", "revenue_won": 10000, "won": 1, "lost": 0}
    assert months["2026-06"] == {"month": "2026-06", "revenue_won": 0, "won": 0, "lost": 1}
    assert months["2026-10"] == {"month": "2026-10", "revenue_won": 3000, "won": 1, "lost": 0}  # 31 Oct 23:59:59
    assert months["2026-11"] == {"month": "2026-11", "revenue_won": 6000, "won": 1, "lost": 1}  # 1 Nov 00:00:00
    assert sum(m["won"] + m["lost"] for m in months.values()) == 5  # Nov 2025 is outside the window


def test_ADR015_editing_the_close_date_does_not_move_a_won_deal_to_another_month(
    client: TestClient, data: dict
) -> None:
    before = client.get("/api/dashboard").json()
    client.patch(f"/api/deals/{data['won_october']}", json={"close_date": "2026-11-15"})
    client.patch(f"/api/deals/{data['won_april']}", json={"close_date": "2025-01-01"})
    after = client.get("/api/dashboard").json()
    assert (after["months"], after["summary"]) == (before["months"], before["summary"])


def test_R74_C1_funnel_counts_deals_created_in_the_last_12_months_by_their_furthest_stage(
    client: TestClient, data: dict
) -> None:
    # Reached: won_april, won_october, won_november every stage; open_negotiation negotiation;
    # lost_november proposal (created there); lost_june qualified; late_new new. The deal created
    # in October 2025 is outside the window.
    assert client.get("/api/dashboard").json()["funnel"] == [
        {"stage": "new", "value": 34000},
        {"stage": "qualified", "value": 32000},
        {"stage": "proposal", "value": 28000},
        {"stage": "negotiation", "value": 27000},
        {"stage": "won", "value": 19000},
    ]


def test_R76_follow_ups_are_grouped_with_a_later_count_and_their_source(client: TestClient, data: dict) -> None:
    follow_ups = client.get("/api/dashboard").json()["follow_ups"]
    assert [f["description"] for f in follow_ups["overdue"]] == ["overdue"]
    assert [f["description"] for f in follow_ups["today"]] == ["due_today"]
    assert [f["description"] for f in follow_ups["next_7_days"]] == ["tomorrow", "in_7_days"]
    assert follow_ups["later_count"] == 1
    assert follow_ups["overdue"][0] == {
        "id": data["overdue"],
        "type": "call",
        "contact_id": None,
        "deal_id": data["late_new"],
        "description": "overdue",
        "occurred_at": "2026-11-15T10:00:00",
        "follow_up_date": "2026-11-20",
        "done": False,
        "created_at": "2026-11-21T14:30:00",
        "created_by": {"id": PRIYA.id, "name": "Priya Shah"},
        "updated_at": "2026-11-21T14:30:00",
        "updated_by": {"id": PRIYA.id, "name": "Priya Shah"},
        "source": {"kind": "deal", "id": data["late_new"], "name": "late_new"},
    }
    assert follow_ups["today"][0]["source"] == {"kind": "contact", "id": data["jo"], "name": "Jo"}


def test_R76_marking_one_done_removes_it_straight_away(client: TestClient, data: dict) -> None:
    client.patch(f"/api/activities/{data['tomorrow']}", json={"done": True})
    follow_ups = client.get("/api/dashboard").json()["follow_ups"]
    assert [f["description"] for f in follow_ups["next_7_days"]] == ["in_7_days"]


def test_R79_counts_for_the_greeting_line(client: TestClient, data: dict) -> None:
    assert client.get("/api/dashboard").json()["counts"] == {"overdue_follow_ups": 1, "late_deals": 1}


def test_R75_recent_is_the_10_latest_entries_up_to_now(client: TestClient, data: dict) -> None:
    recent = client.get("/api/dashboard").json()["recent"]
    assert len(recent) == 10
    times = [e["at"] for e in recent]
    assert times == sorted(times, reverse=True)
    assert times[0] == "2026-11-21T14:00:00" and recent[0]["description"] == "no_follow_up"
    assert all(t <= "2026-11-21T14:30:00" for t in times)  # planned activity waits until it happens
    assert recent[1]["kind"] == "activity"
    stage_entries = [e for e in recent if e["kind"] == "stage_change"]
    assert stage_entries[0]["source"]["name"] == "lost_november"
    assert (stage_entries[0]["from_stage"], stage_entries[0]["to_stage"]) == ("proposal", "lost")


def test_R77_month_boundary_follows_the_clock_on_each_load(client: TestClient, data: dict, clock) -> None:
    clock.at = datetime(2026, 11, 30, 23, 59, 59)
    late_november = client.get("/api/dashboard").json()
    assert late_november["summary"]["won_this_month"] == {"value": 6000, "count": 1}
    clock.at = datetime(2026, 12, 1, 0, 0, 0)
    december = client.get("/api/dashboard").json()
    assert december["today"] == "2026-12-01"
    assert december["summary"]["won_this_month"] == {"value": 0, "count": 0}
    assert [m["month"] for m in december["months"]][0] == "2026-01" and december["months"][-1]["month"] == "2026-12"
    assert december["summary"]["win_rate"] == {"won": 3, "lost": 2, "percent": 60}


def test_R77_a_deal_won_today_counts_in_this_month_at_once(client: TestClient, data: dict) -> None:
    client.patch(f"/api/deals/{data['open_negotiation']}", json={"stage": "won"})
    body = client.get("/api/dashboard").json()
    assert body["summary"]["won_this_month"] == {"value": 14000, "count": 2}
    assert body["months"][-1]["revenue_won"] == 14000
    assert body["summary"]["open_value"] == 2000
    assert body["recent"][0]["to_stage"] == "won"


@pytest.mark.parametrize(("won", "lost", "percent"), [(1, 2, 33), (2, 1, 67), (1, 1, 50), (1, 7, 13)])
def test_R70_win_rate_is_a_whole_percentage_by_count(client: TestClient, won: int, lost: int, percent: int) -> None:
    org = client.post("/api/organizations", json={"name": "A"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org}).json()["id"]
    for stage in ["won"] * won + ["lost"] * lost:
        body = {"name": "d", "organization_id": org, "contact_id": jo, "stage": stage, "value": 1}
        client.post("/api/deals", json={**body, "close_date": "2026-11-01"})
    assert client.get("/api/dashboard").json()["summary"]["win_rate"] == {"won": won, "lost": lost, "percent": percent}


def test_R71_VB19_months_groups_by_the_same_expression_it_selects_on_postgres() -> None:
    """Postgres refuses GROUP BY when the grouped expression has its own bound values (error 42803).
    The automated tests run only on SQLite, so the statement is compiled for Postgres and compared."""
    import re
    from datetime import date
    from typing import cast

    from sqlalchemy import Connection
    from sqlalchemy.dialects import postgresql

    from app.services import dashboard

    seen = []

    class Recorder:
        def execute(self, statement):  # type: ignore[no-untyped-def]
            seen.append(statement)
            return []

    dashboard.months(cast(Connection, Recorder()), date(2026, 11, 21))
    sql = str(seen[0].compile(dialect=postgresql.dialect(), compile_kwargs={"render_postcompile": True}))
    selected = re.search(r"SELECT (substr\(.+?\)) AS month", sql)
    grouped = re.search(r"GROUP BY (substr\(.+?\))\s*$", sql)
    assert selected and grouped, sql
    assert selected.group(1) == grouped.group(1) == "substr(deals.closed_at, 1, 7)"
