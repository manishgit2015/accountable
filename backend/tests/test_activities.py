"""V-B08: activity request rules (R13, R21) and the activity and dashboard shapes (T1.6), and the
activity API (T2.2): create, list, update and delete, mark done and undone, future dates allowed,
exactly one parent. The dashboard figures are in test_dashboard.py (T2.8).
"""

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.errors import validation_fields
from app.schemas import Activity, ActivityCreate, ActivityUpdate, Dashboard, FollowUp, TimelineEntry


def problems(model: type, data: dict) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        model.model_validate(data)
    return validation_fields(caught.value.errors())


def test_R13_type_description_and_one_parent_with_optional_rest() -> None:
    activity = ActivityCreate.model_validate({"type": "call", "description": "Called Jo", "contact_id": 4})
    assert (activity.occurred_at, activity.follow_up_date, activity.done) == (None, None, False)
    assert problems(ActivityCreate, {"contact_id": 4}) == {
        "type": "Choose a type.",
        "description": "Enter a description.",
    }


@pytest.mark.parametrize("parents", [{}, {"contact_id": 1, "deal_id": 2}, {"contact_id": None, "deal_id": None}])
def test_R13_exactly_one_of_contact_and_deal(parents: dict) -> None:
    assert problems(ActivityCreate, {"type": "note", "description": "x", **parents}) == {
        "contact_id": "Log the activity on a contact or a deal, not both."
    }


def test_R13_type_is_note_call_or_email() -> None:
    assert problems(ActivityCreate, {"type": "meeting", "description": "x", "deal_id": 1}) == {
        "type": "Choose note, call or email."
    }


def test_R13_when_it_happened_may_be_in_the_future_and_follow_up_in_the_past() -> None:
    activity = ActivityCreate.model_validate(
        {
            "type": "email",
            "description": "x",
            "deal_id": 1,
            "occurred_at": "2030-01-02T09:15:00",
            "follow_up_date": "2020-01-01",
        }
    )
    assert activity.occurred_at == datetime(2030, 1, 2, 9, 15)
    assert activity.follow_up_date == date(2020, 1, 1)


@pytest.mark.parametrize("occurred_at", ["2026-11-21T14:30:00Z", "2026-11-21T14:30:00+01:00", "2026-11-21", "soon"])
def test_ADR013_times_are_local_with_no_time_zone(occurred_at: str) -> None:
    assert "occurred_at" in problems(
        ActivityCreate, {"type": "note", "description": "x", "deal_id": 1, "occurred_at": occurred_at}
    )


def test_R21_description_up_to_5000_characters() -> None:
    ActivityCreate.model_validate({"type": "note", "description": "d" * 5000, "deal_id": 1})
    assert "description" in problems(ActivityCreate, {"type": "note", "description": "d" * 5001, "deal_id": 1})


def test_R55_update_marks_done_and_clears_the_follow_up() -> None:
    update = ActivityUpdate.model_validate({"done": True, "follow_up_date": None})
    assert update.model_fields_set == {"done", "follow_up_date"}
    assert problems(ActivityUpdate, {"done": "yes"}) == {"done": "Choose true or false."}
    assert problems(ActivityUpdate, {"deal_id": 3}) == {"deal_id": "This field isn't allowed."}


def test_spec53_activity_timeline_and_dashboard_shapes() -> None:
    assert list(Activity.model_fields) == [
        "id",
        "type",
        "contact_id",
        "deal_id",
        "description",
        "occurred_at",
        "follow_up_date",
        "done",
    ]
    assert list(TimelineEntry.model_fields) == [
        "kind",
        "id",
        "type",
        "from_stage",
        "to_stage",
        "description",
        "at",
        "source",
    ]
    assert list(FollowUp.model_fields)[-1] == "source"
    assert list(Dashboard.model_fields) == [
        "today",
        "summary",
        "months",
        "funnel",
        "open_by_stage",
        "follow_ups",
        "recent",
        "counts",
    ]


def test_spec55_the_empty_dashboard_example_fits_the_model() -> None:
    example = {
        "today": "2026-11-21",
        "summary": {
            "open_value": 0,
            "expected_revenue": 0,
            "won_this_month": {"value": 0, "count": 0},
            "win_rate": {"won": 0, "lost": 0, "percent": None},
        },
        "months": [{"month": "2025-12", "revenue_won": 0, "won": 0, "lost": 0}],
        "funnel": [{"stage": "new", "value": 0}],
        "open_by_stage": [{"stage": "new", "count": 0, "value": 0, "expected": 0}],
        "follow_ups": {"overdue": [], "today": [], "next_7_days": [], "later_count": 0},
        "recent": [],
        "counts": {"overdue_follow_ups": 0, "late_deals": 0},
    }
    assert Dashboard.model_validate(example).model_dump() == example


# The API (T2.2) ------------------------------------------------------------------------------------


@pytest.fixture
def parents(client: TestClient) -> dict:
    org = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org}).json()["id"]
    body = {
        "name": "Deal",
        "organization_id": org,
        "contact_id": jo,
        "stage": "new",
        "value": 1,
        "close_date": "2027-01-01",
    }
    deal = client.post("/api/deals", json=body).json()["id"]
    return {"contact": jo, "deal": deal}


def _log(client: TestClient, **fields) -> dict:
    response = client.post("/api/activities", json={"type": "call", "description": "Called", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_R13_R53_log_on_a_contact_defaults_to_now_and_not_done(client: TestClient, parents: dict) -> None:
    activity = _log(client, contact_id=parents["contact"])
    assert activity == {
        "id": activity["id"],
        "type": "call",
        "contact_id": parents["contact"],
        "deal_id": None,
        "description": "Called",
        "occurred_at": "2026-11-21T14:30:00",
        "follow_up_date": None,
        "done": False,
    }
    assert client.get("/api/activities").json() == [activity]


def test_R13_log_on_a_deal_with_a_follow_up_and_each_type(client: TestClient, parents: dict) -> None:
    for kind in ("note", "call", "email"):
        activity = _log(client, type=kind, deal_id=parents["deal"], follow_up_date="2026-11-24")
        assert (activity["type"], activity["deal_id"], activity["contact_id"]) == (kind, parents["deal"], None)
        assert activity["follow_up_date"] == "2026-11-24"


def test_R13_spec45_planned_activity_in_the_future_and_a_past_follow_up_are_accepted(
    client: TestClient, parents: dict
) -> None:
    activity = _log(client, contact_id=parents["contact"], occurred_at="2027-02-01T09:00", follow_up_date="2026-01-01")
    assert (activity["occurred_at"], activity["follow_up_date"]) == ("2027-02-01T09:00:00", "2026-01-01")


@pytest.mark.parametrize("which", ["both", "neither"])
def test_R13_exactly_one_parent_through_the_api(client: TestClient, parents: dict, which: str) -> None:
    links = {"contact_id": parents["contact"], "deal_id": parents["deal"]} if which == "both" else {}
    response = client.post("/api/activities", json={"type": "note", "description": "x", **links})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"contact_id": "Log the activity on a contact or a deal, not both."}


def test_R13_a_parent_that_does_not_exist_is_refused(client: TestClient) -> None:
    response = client.post("/api/activities", json={"type": "note", "description": "x", "deal_id": 5})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"deal_id": "That deal doesn't exist."}
    response = client.post("/api/activities", json={"type": "note", "description": "x", "contact_id": 5})
    assert response.json()["error"]["fields"] == {"contact_id": "That contact doesn't exist."}


def test_R55_mark_done_and_undone(client: TestClient, parents: dict) -> None:
    activity = _log(client, contact_id=parents["contact"], follow_up_date="2026-11-22")
    done = client.patch(f"/api/activities/{activity['id']}", json={"done": True})
    assert done.status_code == 200 and done.json()["done"] is True
    undone = client.patch(f"/api/activities/{activity['id']}", json={"done": False}).json()
    assert undone == {**activity, "done": False}


def test_R55_edit_changes_only_the_fields_sent(client: TestClient, parents: dict) -> None:
    activity = _log(client, deal_id=parents["deal"], follow_up_date="2026-11-22")
    changed = client.patch(
        f"/api/activities/{activity['id']}",
        json={"type": "email", "description": " Emailed ", "occurred_at": "2026-11-20T10:00", "follow_up_date": None},
    ).json()
    assert changed == {
        **activity,
        "type": "email",
        "description": "Emailed",
        "occurred_at": "2026-11-20T10:00:00",
        "follow_up_date": None,
    }
    assert client.patch(f"/api/activities/{activity['id']}", json={}).json() == changed
    refused = client.patch(f"/api/activities/{activity['id']}", json={"description": "", "deal_id": 1})
    assert refused.status_code == 422
    assert set(refused.json()["error"]["fields"]) == {"description", "deal_id"}


def test_R55_delete_and_a_second_delete_is_404(client: TestClient, parents: dict) -> None:
    activity = _log(client, contact_id=parents["contact"])
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 204
    assert client.get("/api/activities").json() == []
    assert client.delete(f"/api/activities/{activity['id']}").status_code == 404
    assert client.patch(f"/api/activities/{activity['id']}", json={"done": True}).status_code == 404


def test_spec53_activities_have_no_get_by_id_and_list_newest_first(client: TestClient, parents: dict) -> None:
    older = _log(client, contact_id=parents["contact"], occurred_at="2026-11-01T09:00")
    newer = _log(client, deal_id=parents["deal"], occurred_at="2026-11-02T09:00")
    assert [a["id"] for a in client.get("/api/activities").json()] == [newer["id"], older["id"]]
    assert client.get(f"/api/activities/{older['id']}").status_code == 405
