"""V-B06: moves across and within columns, stage effects, stage change rows, 409 and repeats.

R15–R18, R24, R60, R63, spec 4.2, 5.4 and 6.4, through POST /api/deals/{id}/move (T2.3).
"""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select, update

from app.db import deals as deals_table
from app.db import stage_changes


@pytest.fixture
def board(client: TestClient) -> dict:
    org = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org}).json()["id"]
    return {"org": org, "jo": jo}


def _deal(client: TestClient, board: dict, stage: str = "new", **fields) -> dict:
    body = {"name": "Deal", "organization_id": board["org"], "contact_id": board["jo"], "stage": stage}
    response = client.post("/api/deals", json={**body, "value": 1000, "close_date": "2026-12-31", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _move(client: TestClient, deal_id: int, stage: str, before: int | None = None, after: int | None = None):  # type: ignore[no-untyped-def]
    return client.post(f"/api/deals/{deal_id}/move", json={"stage": stage, "before_id": before, "after_id": after})


def _column(client: TestClient, stage: str) -> list[int]:
    deals = [d for d in client.get("/api/deals").json() if d["stage"] == stage]
    return [d["id"] for d in sorted(deals, key=lambda d: (d["position"], d["id"]))]


def _rows(engine: Engine, deal_id: int) -> list[tuple]:
    with engine.connect() as conn:
        query = select(stage_changes.c.from_stage, stage_changes.c.to_stage, stage_changes.c.changed_at)
        return [tuple(r) for r in conn.execute(query.where(stage_changes.c.deal_id == deal_id).order_by("id"))]


def test_R63_move_across_columns_lands_exactly_between_the_two_cards(client: TestClient, board: dict) -> None:
    below, above = _deal(client, board, "proposal"), _deal(client, board, "proposal")  # newest on top
    card = _deal(client, board)
    response = _move(client, card["id"], "proposal", before=above["id"], after=below["id"])
    assert response.status_code == 200
    result = response.json()
    assert result["renumbered"] == []
    assert (result["deal"]["stage"], result["deal"]["position"]) == ("proposal", 0.5)
    assert _column(client, "proposal") == [above["id"], card["id"], below["id"]]


def test_R15_R18_move_to_another_open_stage_applies_the_rules_and_saves_a_row(
    client: TestClient, board: dict, engine: Engine, clock
) -> None:
    card = _deal(client, board, probability=12)
    clock.at = datetime(2026, 11, 21, 16, 0)
    moved = _move(client, card["id"], "negotiation").json()["deal"]
    assert (moved["stage"], moved["probability"], moved["close_date"]) == ("negotiation", 70, "2026-12-31")
    assert moved["updated_at"] == "2026-11-21T16:00:00"
    assert _rows(engine, card["id"]) == [
        (None, "new", "2026-11-21T14:30:00"),
        ("new", "negotiation", "2026-11-21T16:00:00"),
    ]


def test_R63_move_within_a_column_reorders_and_adds_no_stage_row(
    client: TestClient, board: dict, engine: Engine
) -> None:
    c, b, a = _deal(client, board), _deal(client, board), _deal(client, board)
    assert _column(client, "new") == [a["id"], b["id"], c["id"]]
    response = _move(client, a["id"], "new", before=b["id"], after=c["id"])
    assert response.status_code == 200
    assert _column(client, "new") == [b["id"], a["id"], c["id"]]
    assert response.json()["deal"]["probability"] == 5
    assert len(_rows(engine, a["id"])) == 1


def test_spec54_moves_to_the_ends_and_into_an_empty_column(client: TestClient, board: dict) -> None:
    second, first = _deal(client, board, "qualified"), _deal(client, board, "qualified")
    top = _deal(client, board)
    bottom = _deal(client, board)
    assert _move(client, top["id"], "qualified", after=first["id"]).status_code == 200
    assert _move(client, bottom["id"], "qualified", before=second["id"]).status_code == 200
    assert _column(client, "qualified") == [top["id"], first["id"], second["id"], bottom["id"]]
    alone = _move(client, bottom["id"], "proposal")
    assert alone.status_code == 200 and alone.json()["deal"]["stage"] == "proposal"


def test_R16_R17_move_to_won_closes_today_and_makes_the_contact_a_customer(
    client: TestClient, board: dict, engine: Engine, clock
) -> None:
    card = _deal(client, board, "negotiation")
    clock.at = datetime(2026, 11, 23, 9, 42)
    won = _move(client, card["id"], "won").json()["deal"]
    assert (won["probability"], won["close_date"], won["closed_at"]) == (100, "2026-11-23", "2026-11-23T09:42:00")
    assert client.get(f"/api/contacts/{board['jo']}").json()["status"] == "customer"
    assert _rows(engine, card["id"])[-1] == ("negotiation", "won", "2026-11-23T09:42:00")


def test_R16_move_to_lost_closes_today_and_leaves_the_contact(client: TestClient, board: dict) -> None:
    card = _deal(client, board, "proposal")
    lost = _move(client, card["id"], "lost").json()["deal"]
    assert (lost["probability"], lost["close_date"], lost["closed_at"]) == (0, "2026-11-21", "2026-11-21T14:30:00")
    assert client.get(f"/api/contacts/{board['jo']}").json()["status"] == "lead"


def test_R24_reopening_a_won_deal_keeps_the_close_date_and_the_customer(client: TestClient, board: dict, clock) -> None:
    card = _deal(client, board, "negotiation")
    _move(client, card["id"], "won")
    clock.at = datetime(2026, 12, 3, 10, 0)
    reopened = _move(client, card["id"], "negotiation").json()["deal"]
    assert (reopened["probability"], reopened["close_date"], reopened["closed_at"]) == (70, "2026-11-21", None)
    assert reopened["is_late"] is True  # WF-7: the kept close date is now in the past
    assert client.get(f"/api/contacts/{board['jo']}").json()["status"] == "customer"


def test_spec45_winning_a_deal_whose_contact_was_deleted_changes_no_contact(client: TestClient, board: dict) -> None:
    other = client.post("/api/contacts", json={"name": "Sam", "organization_id": board["org"]}).json()
    card = _deal(client, board, "proposal")
    client.delete(f"/api/contacts/{board['jo']}")
    response = _move(client, card["id"], "won")
    assert response.status_code == 200 and response.json()["deal"]["contact_id"] is None
    assert client.get(f"/api/contacts/{other['id']}").json()["status"] == "lead"


def test_spec54_repeating_a_move_gives_the_same_end_state_and_one_row(
    client: TestClient, board: dict, engine: Engine
) -> None:
    below, above = _deal(client, board, "proposal"), _deal(client, board, "proposal")
    card = _deal(client, board)
    first = _move(client, card["id"], "proposal", before=above["id"], after=below["id"]).json()
    again = _move(client, card["id"], "proposal", before=above["id"], after=below["id"])
    assert again.status_code == 200
    assert again.json()["deal"] == first["deal"]
    assert [r[:2] for r in _rows(engine, card["id"])] == [(None, "new"), ("new", "proposal")]


@pytest.mark.parametrize(
    "case",
    ["before in another stage", "not next to each other", "deleted card", "column not empty", "itself", "wrong end"],
)
def test_spec54_a_stale_drop_is_409_and_changes_nothing(
    client: TestClient, board: dict, engine: Engine, case: str
) -> None:
    c, b, a = _deal(client, board, "proposal"), _deal(client, board, "proposal"), _deal(client, board, "proposal")
    elsewhere = _deal(client, board, "qualified")
    card = _deal(client, board)
    gone = _deal(client, board, "proposal")
    client.delete(f"/api/deals/{gone['id']}")
    before, after = {
        "before in another stage": (elsewhere["id"], a["id"]),
        "not next to each other": (a["id"], c["id"]),
        "deleted card": (gone["id"], a["id"]),
        "column not empty": (None, None),
        "itself": (card["id"], None),
        "wrong end": (None, b["id"]),
    }[case]
    response = _move(client, card["id"], "proposal", before=before, after=after)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "stale_position"
    assert response.json()["error"]["message"] == "The board changed. Try again."
    unchanged = client.get(f"/api/deals/{card['id']}").json()
    assert (unchanged["stage"], unchanged["position"]) == ("new", card["position"])
    assert len(_rows(engine, card["id"])) == 1


def test_spec52_moving_a_missing_deal_is_404(client: TestClient) -> None:
    assert _move(client, 999, "won").status_code == 404


def test_spec64_a_gap_too_small_renumbers_the_column_first(client: TestClient, board: dict, engine: Engine) -> None:
    c, b, a = _deal(client, board, "proposal"), _deal(client, board, "proposal"), _deal(client, board, "proposal")
    with engine.begin() as conn:  # squeeze a and b to within 1e-6 of each other
        conn.execute(update(deals_table).where(deals_table.c.id == a["id"]).values(position=5.0))
        conn.execute(update(deals_table).where(deals_table.c.id == b["id"]).values(position=5.0000005))
        conn.execute(update(deals_table).where(deals_table.c.id == c["id"]).values(position=9.0))
    card = _deal(client, board)
    result = _move(client, card["id"], "proposal", before=a["id"], after=b["id"]).json()
    assert result["deal"]["position"] == 1.5
    assert {d["id"]: d["position"] for d in result["renumbered"]} == {a["id"]: 1.0, b["id"]: 2.0, c["id"]: 3.0}
    assert _column(client, "proposal") == [a["id"], card["id"], b["id"], c["id"]]


def test_R60_won_column_holds_only_this_months_deals(client: TestClient, board: dict, clock) -> None:
    clock.at = datetime(2026, 10, 15, 10, 0)
    old = _deal(client, board, "negotiation")
    _move(client, old["id"], "won")
    clock.at = datetime(2026, 11, 21, 14, 30)
    card = _deal(client, board, "negotiation")
    # Last month's win isn't on the board, so this month's column is empty.
    assert _move(client, card["id"], "won").status_code == 200
    late = _deal(client, board, "negotiation")
    assert _move(client, late["id"], "won", before=old["id"]).status_code == 409
    assert _move(client, late["id"], "won", before=card["id"]).status_code == 200
