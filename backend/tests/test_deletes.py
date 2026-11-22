"""V-B07: deletes as the warning says, checked on the rows themselves (R30–R36, T2.4)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select

from app.db import activities, contacts, deals, organizations, stage_changes


@pytest.fixture
def data(client: TestClient) -> dict:
    """Acme with two contacts and three deals (one won), activities on contacts and deals, and Beta."""
    acme = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()["id"]
    beta = client.post("/api/organizations", json={"name": "Beta Co"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": acme}).json()["id"]
    sam = client.post("/api/contacts", json={"name": "Sam", "organization_id": acme}).json()["id"]
    kim = client.post("/api/contacts", json={"name": "Kim", "organization_id": beta}).json()["id"]

    def deal(name: str, contact: int, stage: str = "new", org: int = acme) -> int:
        body = {"name": name, "organization_id": org, "contact_id": contact, "stage": stage}
        return client.post("/api/deals", json={**body, "value": 5000, "close_date": "2026-12-31"}).json()["id"]

    ids = {"acme": acme, "beta": beta, "jo": jo, "sam": sam, "kim": kim}
    ids["pilot"] = deal("Pilot", jo)
    ids["rollout"] = deal("Rollout", jo, "proposal")
    ids["won"] = deal("Won one", sam, "negotiation")
    ids["beta_deal"] = deal("Beta deal", kim, org=beta)
    client.post(f"/api/deals/{ids['won']}/move", json={"stage": "won"})
    client.post(f"/api/deals/{ids['rollout']}/move", json={"stage": "negotiation"})
    for parent in ({"contact_id": jo}, {"contact_id": jo}, {"deal_id": ids["pilot"]}, {"deal_id": ids["rollout"]}):
        client.post("/api/activities", json={"type": "note", "description": "x", **parent})
    return ids


def _count(engine: Engine, table, *conditions) -> int:  # type: ignore[no-untyped-def]
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(table).where(*conditions)).scalar_one()


def test_R30_organization_impact_counts_the_kept_contacts_and_deals(client: TestClient, data: dict) -> None:
    response = client.get(f"/api/organizations/{data['acme']}/delete-impact")
    assert response.status_code == 200
    assert response.json() == {"contacts_kept": 2, "deals_kept": 3}


def test_R31_deleting_an_organization_keeps_its_contacts_and_deals_with_the_link_cleared(
    client: TestClient, data: dict, engine: Engine
) -> None:
    assert client.delete(f"/api/organizations/{data['acme']}").status_code == 204
    assert _count(engine, organizations, organizations.c.id == data["acme"]) == 0
    assert _count(engine, contacts) == 3 and _count(engine, deals) == 4
    assert _count(engine, contacts, contacts.c.organization_id.is_(None)) == 2
    assert _count(engine, deals, deals.c.organization_id.is_(None)) == 3
    assert _count(engine, activities) == 4 and _count(engine, stage_changes) == 6
    deal = client.get(f"/api/deals/{data['pilot']}").json()
    assert (deal["organization_id"], deal["organization_name"], deal["contact_name"]) == (None, None, "Jo")  # R34
    beta = client.get(f"/api/organizations/{data['beta']}").json()
    assert (beta["contact_count"], beta["open_deal_count"]) == (1, 1)


def test_R30_contact_impact_counts_kept_deals_and_deleted_activities(client: TestClient, data: dict) -> None:
    assert client.get(f"/api/contacts/{data['jo']}/delete-impact").json() == {"deals_kept": 2, "activities_deleted": 2}


def test_R32_deleting_a_contact_keeps_their_deals_and_deletes_their_activities(
    client: TestClient, data: dict, engine: Engine
) -> None:
    assert client.delete(f"/api/contacts/{data['jo']}").status_code == 204
    assert _count(engine, contacts, contacts.c.id == data["jo"]) == 0
    assert _count(engine, deals, deals.c.contact_id.is_(None)) == 2
    assert _count(engine, deals) == 4
    assert _count(engine, activities, activities.c.contact_id == data["jo"]) == 0
    assert _count(engine, activities) == 2  # the two on deals are kept
    deal = client.get(f"/api/deals/{data['rollout']}").json()
    assert (deal["contact_id"], deal["contact_name"], deal["organization_name"]) == (None, None, "Acme Ltd")


def test_R30_deal_impact_counts_activities_and_stage_changes(client: TestClient, data: dict) -> None:
    assert client.get(f"/api/deals/{data['rollout']}/delete-impact").json() == {
        "activities_deleted": 1,
        "stage_changes_deleted": 2,
    }


def test_R33_deleting_a_deal_deletes_its_activities_and_stage_changes(
    client: TestClient, data: dict, engine: Engine
) -> None:
    assert client.delete(f"/api/deals/{data['rollout']}").status_code == 204
    assert _count(engine, deals, deals.c.id == data["rollout"]) == 0
    assert _count(engine, activities, activities.c.deal_id == data["rollout"]) == 0
    assert _count(engine, stage_changes, stage_changes.c.deal_id == data["rollout"]) == 0
    assert _count(engine, activities) == 3 and _count(engine, stage_changes) == 4
    assert _count(engine, contacts) == 3


def test_R35_won_deals_keep_counting_after_their_organization_and_contact_are_deleted(
    client: TestClient, data: dict
) -> None:
    before = client.get("/api/dashboard").json()
    assert before["summary"]["won_this_month"] == {"value": 5000, "count": 1}
    client.delete(f"/api/contacts/{data['sam']}")
    client.delete(f"/api/organizations/{data['acme']}")
    after = client.get("/api/dashboard").json()
    assert after["summary"] == before["summary"]
    assert after["months"] == before["months"]


@pytest.mark.parametrize("resource", ["organizations", "contacts", "deals"])
def test_REL5_deleting_something_already_gone_is_404(client: TestClient, data: dict, resource: str) -> None:
    record = {"organizations": data["acme"], "contacts": data["jo"], "deals": data["pilot"]}[resource]
    assert client.delete(f"/api/{resource}/{record}").status_code == 204
    second = client.delete(f"/api/{resource}/{record}")
    assert second.status_code == 404 and second.json()["error"]["code"] == "not_found"
    assert client.get(f"/api/{resource}/{record}/delete-impact").status_code == 404


def test_R36_REL2_a_delete_is_permanent_and_whole(client: TestClient, data: dict, engine: Engine) -> None:
    client.delete(f"/api/deals/{data['pilot']}")
    assert client.get(f"/api/deals/{data['pilot']}").status_code == 404
    assert _count(engine, activities, activities.c.deal_id == data["pilot"]) == 0
