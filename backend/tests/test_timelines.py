"""V-B09: deal, contact and organization timelines, their order and sources (R50–R54, T2.5)."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event


@pytest.fixture
def story(client: TestClient, clock) -> dict:
    """Acme with Jo and Sam; Jo is the main contact of Pilot; Sam of Rollout; Beta stays apart."""
    acme = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()["id"]
    beta = client.post("/api/organizations", json={"name": "Beta Co"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": acme}).json()["id"]
    sam = client.post("/api/contacts", json={"name": "Sam", "organization_id": acme}).json()["id"]
    kim = client.post("/api/contacts", json={"name": "Kim", "organization_id": beta}).json()["id"]

    def deal(name: str, org: int, contact: int) -> int:
        body = {"name": name, "organization_id": org, "contact_id": contact, "stage": "new", "value": 100}
        return client.post("/api/deals", json={**body, "close_date": "2027-01-01"}).json()["id"]

    def log(when: str, description: str, **parent: int) -> int:
        body = {"type": "call", "description": description, "occurred_at": when, **parent}
        return client.post("/api/activities", json=body).json()["id"]

    clock.at = datetime(2026, 11, 1, 9, 0)
    pilot = deal("Pilot", acme, jo)
    clock.at = datetime(2026, 11, 2, 9, 0)
    rollout = deal("Rollout", acme, sam)
    other = deal("Beta deal", beta, kim)
    clock.at = datetime(2026, 11, 5, 12, 0)
    client.post(f"/api/deals/{pilot}/move", json={"stage": "proposal"})
    ids = {"acme": acme, "beta": beta, "jo": jo, "sam": sam, "kim": kim, "pilot": pilot, "rollout": rollout}
    ids["call_jo"] = log("2026-11-03T10:00", "Called Jo", contact_id=jo)
    ids["note_pilot"] = log("2026-11-04T10:00", "Pilot note", deal_id=pilot)
    ids["note_rollout"] = log("2026-11-06T10:00", "Rollout note", deal_id=rollout)
    ids["call_sam"] = log("2026-11-07T10:00", "Called Sam", contact_id=sam)
    ids["planned"] = log("2026-12-01T10:00", "Planned visit", deal_id=pilot)
    log("2026-11-08T10:00", "Beta call", contact_id=kim)
    log("2026-11-08T11:00", "Beta note", deal_id=other)
    clock.at = datetime(2026, 11, 21, 14, 30)
    return ids


def _summary(entries: list[dict]) -> list[tuple]:
    return [
        (e["kind"], e["description"] or f"{e['from_stage']}->{e['to_stage']}", e["source"]["name"]) for e in entries
    ]


def test_R52_deal_timeline_merges_activities_and_stage_changes_newest_first(client: TestClient, story: dict) -> None:
    entries = client.get(f"/api/deals/{story['pilot']}/timeline").json()
    assert _summary(entries) == [
        ("activity", "Planned visit", "Pilot"),  # planned activity sits at its future time
        ("stage_change", "new->proposal", "Pilot"),
        ("activity", "Pilot note", "Pilot"),
        ("stage_change", "None->new", "Pilot"),
    ]
    assert entries[1] == {
        "kind": "stage_change",
        "id": entries[1]["id"],
        "type": None,
        "from_stage": "new",
        "to_stage": "proposal",
        "description": None,
        "at": "2026-11-05T12:00:00",
        "source": {"kind": "deal", "id": story["pilot"], "name": "Pilot"},
    }
    assert entries[2] == {
        "kind": "activity",
        "id": story["note_pilot"],
        "type": "call",
        "from_stage": None,
        "to_stage": None,
        "description": "Pilot note",
        "at": "2026-11-04T10:00:00",
        "source": {"kind": "deal", "id": story["pilot"], "name": "Pilot"},
    }


def test_R51_contact_timeline_has_their_activities_and_their_deals_entries(client: TestClient, story: dict) -> None:
    entries = client.get(f"/api/contacts/{story['jo']}/timeline").json()
    assert _summary(entries) == [
        ("activity", "Planned visit", "Pilot"),
        ("stage_change", "new->proposal", "Pilot"),
        ("activity", "Pilot note", "Pilot"),
        ("activity", "Called Jo", "Jo"),
        ("stage_change", "None->new", "Pilot"),
    ]
    assert entries[3]["source"] == {"kind": "contact", "id": story["jo"], "name": "Jo"}


def test_R51_contact_timeline_follows_deals_where_they_are_the_main_contact_now(
    client: TestClient, story: dict
) -> None:
    client.patch(f"/api/deals/{story['pilot']}", json={"contact_id": story["sam"]})
    jo = _summary(client.get(f"/api/contacts/{story['jo']}/timeline").json())
    assert jo == [("activity", "Called Jo", "Jo")]
    sam = _summary(client.get(f"/api/contacts/{story['sam']}/timeline").json())
    assert ("activity", "Pilot note", "Pilot") in sam and ("activity", "Rollout note", "Rollout") in sam


def test_R50_organization_timeline_combines_its_contacts_and_deals(client: TestClient, story: dict) -> None:
    entries = client.get(f"/api/organizations/{story['acme']}/timeline").json()
    assert _summary(entries) == [
        ("activity", "Planned visit", "Pilot"),
        ("activity", "Called Sam", "Sam"),
        ("activity", "Rollout note", "Rollout"),
        ("stage_change", "new->proposal", "Pilot"),
        ("activity", "Pilot note", "Pilot"),
        ("activity", "Called Jo", "Jo"),
        ("stage_change", "None->new", "Rollout"),
        ("stage_change", "None->new", "Pilot"),
    ]
    assert all("Beta" not in e["source"]["name"] and e["source"]["name"] != "Kim" for e in entries)
    beta = _summary(client.get(f"/api/organizations/{story['beta']}/timeline").json())
    assert beta == [
        ("activity", "Beta note", "Beta deal"),
        ("activity", "Beta call", "Kim"),
        ("stage_change", "None->new", "Beta deal"),
    ]


def test_R54_entries_at_the_same_moment_keep_a_stable_order(client: TestClient, story: dict) -> None:
    client.post("/api/activities", json={"type": "note", "description": "Same time", "deal_id": story["rollout"]})
    client.post(f"/api/deals/{story['rollout']}/move", json={"stage": "qualified"})
    entries = client.get(f"/api/deals/{story['rollout']}/timeline").json()
    assert _summary(entries)[:2] == [
        ("stage_change", "new->qualified", "Rollout"),
        ("activity", "Same time", "Rollout"),
    ]


@pytest.mark.parametrize("resource", ["organizations", "contacts", "deals"])
def test_R56_timeline_of_a_missing_record_is_404(client: TestClient, resource: str) -> None:
    response = client.get(f"/api/{resource}/321/timeline")
    assert response.status_code == 404 and response.json()["error"]["code"] == "not_found"


def test_plan_T25_a_timeline_takes_a_bounded_number_of_queries(client: TestClient, story: dict, app) -> None:  # type: ignore[no-untyped-def]
    statements: list[str] = []

    def count(*_args) -> None:  # type: ignore[no-untyped-def]
        statements.append("q")

    engine = app.state.engine
    for _ in range(20):
        client.post("/api/activities", json={"type": "note", "description": "more", "contact_id": story["jo"]})
    event.listen(engine, "before_cursor_execute", count)
    try:
        client.get(f"/api/organizations/{story['acme']}/timeline")
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert len(statements) <= 3  # the existence check, activities and stage changes
