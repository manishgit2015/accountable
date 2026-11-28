"""V-B16: who added and who last changed each record (R110–R114, section 6.5, ADR-022).

Two test people sign in with test tokens (SEC-17): Priya through conftest's client, Sam through his own.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, event, select

from app.config import FixedClock, Settings
from app.db import transaction, users
from app.routers.sign_in_for_tests import SignInPerson, make_test_token
from app.seed import load_sample_data
from tests.conftest import API_BASE, APP_ORIGIN, PRIYA, SAM

PRIYA_REF = {"id": PRIYA.id, "name": "Priya Shah"}
SAM_REF = {"id": SAM.id, "name": "Sam Lee"}


def _client_for(app: FastAPI, settings: Settings, person: SignInPerson) -> TestClient:
    token = make_test_token(settings, person)
    headers = {"Origin": APP_ORIGIN, "Authorization": f"Bearer {token}"}
    return TestClient(app, base_url=API_BASE, headers=headers, raise_server_exceptions=False)


@pytest.fixture
def sam(app: FastAPI, settings: Settings) -> Iterator[TestClient]:
    with _client_for(app, settings, SAM) as client:
        yield client


@pytest.fixture
def records(client: TestClient) -> dict[str, dict]:
    """One of each kind of record, added by Priya."""
    org = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()
    contact = client.post("/api/contacts", json={"name": "Jo Bloggs", "organization_id": org["id"]}).json()
    deal = client.post(
        "/api/deals",
        json={
            "name": "Pilot",
            "organization_id": org["id"],
            "contact_id": contact["id"],
            "stage": "new",
            "value": 5000,
            "close_date": "2026-12-31",
        },
    ).json()
    activity = client.post(
        "/api/activities", json={"type": "call", "description": "Called", "deal_id": deal["id"]}
    ).json()
    return {"organizations": org, "contacts": contact, "deals": deal, "activities": activity}


KINDS = ["organizations", "contacts", "deals", "activities"]
EDITS = {
    "organizations": {"industry": "Logistics"},
    "contacts": {"job_title": "Buyer"},
    "deals": {"value": 6000},
    "activities": {"description": "Called back"},
}


@pytest.mark.parametrize("kind", KINDS)
def test_R110_creating_records_the_signed_in_person_as_adder_and_changer(records: dict, kind: str) -> None:
    record = records[kind]
    assert record["created_by"] == PRIYA_REF
    assert record["updated_by"] == PRIYA_REF


@pytest.mark.parametrize("kind", KINDS)
def test_R110_R111_a_change_records_who_made_it_and_keeps_who_added_it(
    records: dict, sam: TestClient, client: TestClient, kind: str, clock: FixedClock
) -> None:
    clock.at = clock.at + timedelta(days=1)
    changed = sam.patch(f"/api/{kind}/{records[kind]['id']}", json=EDITS[kind])
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert (body["created_by"], body["updated_by"]) == (PRIYA_REF, SAM_REF)
    assert (body["created_at"], body["updated_at"]) == ("2026-11-21T14:30:00", "2026-11-22T14:30:00")
    # Everyone sees the same names (R115).
    again = client.get(f"/api/{kind}/{records[kind]['id']}" if kind != "activities" else "/api/activities").json()
    seen = again if kind != "activities" else next(a for a in again if a["id"] == records[kind]["id"])
    assert (seen["created_by"], seen["updated_by"]) == (PRIYA_REF, SAM_REF)


def test_R110_moving_a_deal_records_the_mover_and_its_contact_becoming_a_customer(
    records: dict, sam: TestClient, client: TestClient
) -> None:
    deal = records["deals"]
    moved = sam.post(f"/api/deals/{deal['id']}/move", json={"stage": "won", "before_id": None, "after_id": None})
    assert moved.status_code == 200, moved.text
    assert moved.json()["deal"]["updated_by"] == SAM_REF
    contact = client.get(f"/api/contacts/{records['contacts']['id']}").json()
    assert (contact["status"], contact["updated_by"]) == ("customer", SAM_REF)  # R17's change is Sam's too


@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("field", ["created_by", "updated_by"])
def test_R110_a_body_naming_a_person_is_refused(client: TestClient, records: dict, kind: str, field: str) -> None:
    patched = client.patch(f"/api/{kind}/{records[kind]['id']}", json={field: SAM.id})
    assert patched.status_code == 422
    assert patched.json()["error"]["fields"] == {field: "This field isn't allowed."}
    created = client.post(f"/api/{kind}", json={"name": "X", field: SAM.id})
    assert created.status_code == 422
    assert field in created.json()["error"]["fields"]


def test_R112_timelines_name_who_added_each_activity(records: dict, sam: TestClient) -> None:
    deal_id = records["deals"]["id"]
    sam.post("/api/activities", json={"type": "note", "description": "Sam's note", "deal_id": deal_id})
    entries = sam.get(f"/api/deals/{deal_id}/timeline").json()
    by_description = {e["description"]: e["added_by"] for e in entries if e["kind"] == "activity"}
    assert by_description == {"Called": PRIYA_REF, "Sam's note": SAM_REF}
    assert all(e["added_by"] is None for e in entries if e["kind"] == "stage_change")


# --- The users table (section 6.5, R114, ADR-022) ---


def _user(engine: Engine, person_id: str) -> tuple | None:
    with engine.connect() as conn:
        row = conn.execute(select(users.c.email, users.c.name, users.c.last_seen_at).where(users.c.id == person_id))
        return row.first()


def test_spec65_the_first_signed_in_request_adds_the_persons_row(client: TestClient, engine: Engine) -> None:
    assert _user(engine, PRIYA.id) is None
    client.get("/api/me")
    assert tuple(_user(engine, PRIYA.id) or ()) == ("priya@test.example", "Priya Shah", "2026-11-21")


def test_spec65_the_users_table_is_only_touched_when_something_changed(
    client: TestClient, engine: Engine, clock: FixedClock
) -> None:
    """The first request writes the row in one statement, with no read first (two first requests at once
    would otherwise race). The next ones don't touch the users table at all: no round trip to the database
    for it (Supabase is far away), until the day or the person's details change."""
    seen: list[str] = []

    def count(_conn, _cursor, statement: str, *_args) -> None:  # type: ignore[no-untyped-def]
        words = statement.split()
        if "users" in (w.strip('"').lower() for w in words):
            seen.append(words[0].upper())

    app_engine = client.app.state.engine  # type: ignore[attr-defined]
    event.listen(app_engine, "before_cursor_execute", count)
    for _ in range(3):
        client.get("/api/me")
    assert seen == ["INSERT"]
    clock.at = clock.at + timedelta(days=1)  # last_seen_at is kept to the day
    client.get("/api/me")
    assert seen == ["INSERT", "INSERT"]  # INSERT ... ON CONFLICT DO UPDATE
    row = _user(engine, PRIYA.id)
    assert row is not None and row[2] == "2026-11-22"


def test_R114_ADR022_a_new_name_shows_on_every_record_and_a_removed_person_keeps_theirs(
    app: FastAPI, settings: Settings, client: TestClient, engine: Engine
) -> None:
    with _client_for(app, settings, SAM) as sam:
        org = sam.post("/api/organizations", json={"name": "Beta Co"}).json()
    renamed = SignInPerson(SAM.id, SAM.email, "Samuel Lee")
    with _client_for(app, settings, renamed) as samuel:
        samuel.get("/api/me")
    assert client.get(f"/api/organizations/{org['id']}").json()["created_by"] == {"id": SAM.id, "name": "Samuel Lee"}
    # Sam is removed in Supabase: no token of his works again, but his row and his name stay.
    assert tuple(_user(engine, SAM.id) or ())[:2] == ("sam@test.example", "Samuel Lee")
    assert client.get("/api/organizations").json()[0]["created_by"]["name"] == "Samuel Lee"


def test_R105_someone_with_no_name_is_shown_by_email(app: FastAPI, settings: Settings) -> None:
    nameless = SignInPerson("00000000-0000-4000-8000-000000000003", "noname@test.example", None)
    with _client_for(app, settings, nameless) as client:
        org = client.post("/api/organizations", json={"name": "Gamma"}).json()
    assert org["created_by"] == {"id": nameless.id, "name": "noname@test.example"}


def test_R113_sample_data_has_no_person(client: TestClient, engine: Engine) -> None:
    with transaction(engine) as conn:
        load_sample_data(conn, datetime(2026, 11, 21, 14, 30))
    for kind in KINDS:
        rows = client.get(f"/api/{kind}").json()
        assert rows and all(r["created_by"] is None and r["updated_by"] is None for r in rows), kind
    dashboard = client.get("/api/dashboard").json()
    assert all(item["created_by"] is None for item in dashboard["follow_ups"]["overdue"])


def test_spec65_two_first_requests_at_once_both_succeed(app: FastAPI, settings: Settings, engine: Engine) -> None:
    """A page asks for /api/me and its data together. With a read before the write, SQLite refused one of
    them at once ("database is locked", 503) and Postgres would refuse the second insert (500)."""
    import threading

    from app.people import Directory

    directory = Directory(engine, settings.clock)
    failures: list[BaseException] = []
    for n in range(10):
        start = threading.Barrier(2)

        def remember(n: int = n, start: threading.Barrier = start) -> None:
            start.wait()
            try:
                directory.remember(f"person-{n}", f"p{n}@test.example", None)
            except BaseException as exc:  # noqa: BLE001 (collected and checked below)
                failures.append(exc)

        threads = [threading.Thread(target=remember) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
    assert failures == []
    with engine.connect() as conn:
        assert len(conn.execute(select(users.c.id).where(users.c.id.like("person-%"))).all()) == 10
