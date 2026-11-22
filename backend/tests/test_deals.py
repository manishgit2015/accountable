"""V-B05: deal and move request rules (R12, R15, R21) and the response shape (T1.6), and the API:
required fields, bounds, the contact matching the organization (R23), the first stage change row
and top-of-column position (T2.1), and a stage change through PATCH following the rules (T2.3).
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.errors import validation_fields
from app.schemas import Deal, DealCreate, DealMove, DealUpdate, MoveResult

VALID = {
    "name": "New website",
    "organization_id": 1,
    "contact_id": 2,
    "stage": "qualified",
    "value": 12_500,
    "close_date": "2026-12-31",
}


def problems(model: type, data: dict) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        model.model_validate(data)
    return validation_fields(caught.value.errors())


def test_R12_every_field_is_required_on_create_except_probability() -> None:
    deal = DealCreate.model_validate(VALID)
    assert deal.close_date == date(2026, 12, 31)
    assert deal.probability is None  # left out: the stage's usual one, set by the service
    assert problems(DealCreate, {}) == {
        "name": "Enter a name.",
        "organization_id": "Choose an organization.",
        "contact_id": "Choose a contact.",
        "stage": "Choose a stage.",
        "value": "Enter a value.",
        "close_date": "Enter a close date.",
    }


@pytest.mark.parametrize("value", [0, 1_000_000_000])
def test_R21_value_bounds_are_accepted(value: int) -> None:
    assert DealCreate.model_validate({**VALID, "value": value}).value == value


@pytest.mark.parametrize("value", [-1, 1_000_000_001, 12.5, "12500", True, None])
def test_R12_R21_value_must_be_a_whole_number_of_dollars_in_range(value: object) -> None:
    assert problems(DealCreate, {**VALID, "value": value}) == {
        "value": "Enter a whole number of dollars from 0 to 1,000,000,000."
    }


@pytest.mark.parametrize("probability", [0, 100])
def test_R21_probability_bounds_are_accepted(probability: int) -> None:
    assert DealCreate.model_validate({**VALID, "probability": probability}).probability == probability


@pytest.mark.parametrize("probability", [-1, 101, 50.5, "50"])
def test_R21_probability_must_be_0_to_100(probability: object) -> None:
    assert problems(DealCreate, {**VALID, "probability": probability}) == {
        "probability": "Enter a whole-number percentage from 0 to 100."
    }


@pytest.mark.parametrize("stage", ["archived", "Won", "", 3])
def test_R14_stage_must_be_one_of_the_six(stage: object) -> None:
    assert problems(DealCreate, {**VALID, "stage": stage}) == {"stage": "Choose a stage."}


@pytest.mark.parametrize("close_date", ["2026-02-30", "2026-13-01", "31/12/2026", "2026-12-31T00:00:00", 20261231, ""])
def test_R21_dates_must_be_real_calendar_dates_in_yyyy_mm_dd(close_date: object) -> None:
    assert problems(DealCreate, {**VALID, "close_date": close_date}) == {
        "close_date": "Enter a close date like 2026-12-31."
    }


def test_R21_leap_day_is_a_real_date() -> None:
    assert DealCreate.model_validate({**VALID, "close_date": "2028-02-29"}).close_date == date(2028, 2, 29)


@pytest.mark.parametrize("field", ["organization_id", "contact_id"])
@pytest.mark.parametrize("bad", [0, -4, "7", 1.0])
def test_spec51_ids_are_positive_whole_numbers(field: str, bad: object) -> None:
    assert field in problems(DealCreate, {**VALID, field: bad})


def test_R15_update_may_send_stage_and_probability_together() -> None:
    update = DealUpdate.model_validate({"stage": "proposal", "probability": 65})
    assert update.model_fields_set == {"stage", "probability"}


@pytest.mark.parametrize(
    "field", ["name", "organization_id", "contact_id", "stage", "value", "close_date", "probability"]
)
def test_R34_update_cannot_set_a_required_field_to_null(field: str) -> None:
    assert field in problems(DealUpdate, {field: None})


def test_R34_a_link_left_out_of_an_update_is_not_checked() -> None:
    assert DealUpdate.model_validate({"value": 10}).model_fields_set == {"value"}


def test_spec54_move_takes_stage_and_neighbours_which_may_be_null() -> None:
    move = DealMove.model_validate({"stage": "proposal", "before_id": 12, "after_id": 31})
    assert (move.stage, move.before_id, move.after_id) == ("proposal", 12, 31)
    empty_column = DealMove.model_validate({"stage": "won", "before_id": None, "after_id": None})
    assert (empty_column.before_id, empty_column.after_id) == (None, None)
    assert problems(DealMove, {"stage": "proposal", "before_id": 0}) == {"before_id": "Choose a deal on the board."}
    assert problems(DealMove, {"before_id": 1}) == {"stage": "Choose a stage."}


def test_spec53_deal_response_has_the_spec_fields() -> None:
    assert list(Deal.model_fields) == [
        "id",
        "organization_id",
        "organization_name",
        "contact_id",
        "contact_name",
        "name",
        "stage",
        "value",
        "probability",
        "expected_revenue",
        "close_date",
        "is_late",
        "position",
        "closed_at",
        "created_at",
        "updated_at",
    ]
    assert list(MoveResult.model_fields) == ["deal", "renumbered"]


# The API (T2.1, T2.3) ------------------------------------------------------------------------------


@pytest.fixture
def acme(client: TestClient) -> dict:
    """An organization with two contacts, and another organization with one."""
    org = client.post("/api/organizations", json={"name": "Acme Ltd"}).json()
    other = client.post("/api/organizations", json={"name": "Beta Co"}).json()
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org["id"]}).json()
    sam = client.post("/api/contacts", json={"name": "Sam", "organization_id": org["id"]}).json()
    kim = client.post("/api/contacts", json={"name": "Kim", "organization_id": other["id"]}).json()
    return {"org": org["id"], "other": other["id"], "jo": jo["id"], "sam": sam["id"], "kim": kim["id"]}


def _create(client: TestClient, acme: dict, **fields) -> dict:
    body = {**VALID, "organization_id": acme["org"], "contact_id": acme["jo"], **fields}
    response = client.post("/api/deals", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _history(client: TestClient, deal_id: int) -> list[tuple]:
    entries = client.get(f"/api/deals/{deal_id}/timeline").json()
    return [(e["from_stage"], e["to_stage"], e["at"]) for e in reversed(entries) if e["kind"] == "stage_change"]


def test_R12_R18_create_returns_the_deal_and_saves_its_first_stage_change(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme)
    assert deal == {
        "id": deal["id"],
        "organization_id": acme["org"],
        "organization_name": "Acme Ltd",
        "contact_id": acme["jo"],
        "contact_name": "Jo",
        "name": "New website",
        "stage": "qualified",
        "value": 12500,
        "probability": 20,  # R15: the stage's usual one when none is sent
        "expected_revenue": 2500,
        "close_date": "2026-12-31",
        "is_late": False,
        "position": 1.0,
        "closed_at": None,
        "created_at": "2026-11-21T14:30:00",
        "updated_at": "2026-11-21T14:30:00",
    }
    assert client.get(f"/api/deals/{deal['id']}").json() == deal
    assert _history(client, deal["id"]) == [(None, "qualified", "2026-11-21T14:30:00")]


def test_R15_a_probability_sent_on_create_is_kept(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme, probability=35)
    assert (deal["probability"], deal["expected_revenue"]) == (35, 4375)


def test_R12_every_required_field_is_checked_by_the_api(client: TestClient) -> None:
    response = client.post("/api/deals", json={"name": " ", "value": 1_000_000_001})
    assert response.status_code == 422
    assert set(response.json()["error"]["fields"]) == {
        "name",
        "organization_id",
        "contact_id",
        "stage",
        "value",
        "close_date",
    }
    assert client.get("/api/deals").json() == []


@pytest.mark.parametrize(("value", "probability"), [(0, 0), (1_000_000_000, 100)])
def test_R21_bounds_are_accepted_by_the_api(client: TestClient, acme: dict, value: int, probability: int) -> None:
    deal = _create(client, acme, value=value, probability=probability)
    assert (deal["value"], deal["probability"]) == (value, probability)


@pytest.mark.parametrize(("value", "probability"), [(-1, 50), (1_000_000_001, 50), (10, 101), (10, -1)])
def test_R21_values_outside_the_bounds_are_refused_by_the_api(
    client: TestClient, acme: dict, value: int, probability: int
) -> None:
    body = {**VALID, "organization_id": acme["org"], "contact_id": acme["jo"], "value": value}
    response = client.post("/api/deals", json={**body, "probability": probability})
    assert response.status_code == 422


def test_R23_the_contact_must_belong_to_the_organization(client: TestClient, acme: dict) -> None:
    response = client.post("/api/deals", json={**VALID, "organization_id": acme["org"], "contact_id": acme["kim"]})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"contact_id": "Choose a contact from Acme Ltd."}
    response = client.post("/api/deals", json={**VALID, "organization_id": 999, "contact_id": acme["jo"]})
    assert response.json()["error"]["fields"] == {"organization_id": "That organization doesn't exist. Choose another."}
    response = client.post("/api/deals", json={**VALID, "organization_id": acme["org"], "contact_id": 999})
    assert response.json()["error"]["fields"] == {"contact_id": "That contact doesn't exist. Choose another."}
    assert client.get("/api/deals").json() == []


def test_spec45_changing_the_organization_so_the_contact_no_longer_matches_is_refused(
    client: TestClient, acme: dict
) -> None:
    deal = _create(client, acme)
    response = client.patch(f"/api/deals/{deal['id']}", json={"organization_id": acme["other"]})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"contact_id": "Choose a contact from Beta Co."}
    changed = client.patch(
        f"/api/deals/{deal['id']}", json={"organization_id": acme["other"], "contact_id": acme["kim"]}
    )
    assert changed.status_code == 200
    assert (changed.json()["organization_name"], changed.json()["contact_name"]) == ("Beta Co", "Kim")
    response = client.patch(f"/api/deals/{deal['id']}", json={"contact_id": acme["sam"]})
    assert response.json()["error"]["fields"] == {"contact_id": "Choose a contact from Beta Co."}


def test_R34_R23_a_link_cleared_by_a_delete_is_exempt_until_filled_in(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme)
    assert client.delete(f"/api/contacts/{acme['jo']}").status_code == 204
    response = client.patch(f"/api/deals/{deal['id']}", json={"value": 900})
    assert response.status_code == 200
    saved = response.json()
    assert (saved["contact_id"], saved["contact_name"], saved["value"]) == (None, None, 900)
    # Changing the organization while the contact is empty is allowed; filling the contact is checked.
    assert client.patch(f"/api/deals/{deal['id']}", json={"organization_id": acme["other"]}).status_code == 200
    assert client.patch(f"/api/deals/{deal['id']}", json={"contact_id": acme["sam"]}).status_code == 422
    assert client.patch(f"/api/deals/{deal['id']}", json={"contact_id": acme["kim"]}).status_code == 200
    assert client.delete(f"/api/organizations/{acme['other']}").status_code == 204
    assert client.patch(f"/api/deals/{deal['id']}", json={"name": "Renamed"}).status_code == 200


def test_R67_a_new_deal_goes_to_the_top_of_its_column(client: TestClient, acme: dict) -> None:
    first = _create(client, acme)
    second = _create(client, acme)
    elsewhere = _create(client, acme, stage="proposal")
    assert (first["position"], second["position"], elsewhere["position"]) == (1.0, 0.0, 1.0)


def test_R19_R20_is_late_and_expected_revenue_are_worked_out(client: TestClient, acme: dict) -> None:
    late = _create(client, acme, close_date="2026-11-20", value=999, probability=50)
    assert (late["is_late"], late["expected_revenue"]) == (True, 500)
    due_today = _create(client, acme, close_date="2026-11-21")
    assert due_today["is_late"] is False
    lost = _create(client, acme, close_date="2026-01-01", stage="lost")
    assert lost["is_late"] is False


def test_R47_list_is_sorted_by_close_date_soonest_first(client: TestClient, acme: dict) -> None:
    for close_date in ("2027-03-01", "2026-12-01", "2027-01-15"):
        _create(client, acme, close_date=close_date)
    assert [d["close_date"] for d in client.get("/api/deals").json()] == ["2026-12-01", "2027-01-15", "2027-03-01"]


def test_D3_a_deal_created_at_won_is_closed_now_and_its_contact_is_unchanged(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme, stage="won")
    assert (deal["probability"], deal["close_date"], deal["closed_at"]) == (100, "2026-12-31", "2026-11-21T14:30:00")
    assert client.get(f"/api/contacts/{acme['jo']}").json()["status"] == "lead"


# A stage change through PATCH (T2.3) ---------------------------------------------------------------


def test_R15_R18_R67_patch_stage_change_follows_the_rules_and_goes_to_the_top(
    client: TestClient, acme: dict, clock
) -> None:
    deal = _create(client, acme, probability=33)
    top = _create(client, acme, stage="proposal")
    clock.at = clock.at.replace(hour=15)
    response = client.patch(f"/api/deals/{deal['id']}", json={"stage": "proposal"})
    assert response.status_code == 200
    moved = response.json()
    assert (moved["stage"], moved["probability"], moved["close_date"]) == ("proposal", 40, "2026-12-31")
    assert moved["position"] < top["position"]  # R67
    assert moved["updated_at"] == "2026-11-21T15:30:00"
    assert _history(client, deal["id"])[-1] == ("qualified", "proposal", "2026-11-21T15:30:00")


def test_R15_a_probability_sent_with_the_stage_change_is_kept(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme)
    moved = client.patch(f"/api/deals/{deal['id']}", json={"stage": "negotiation", "probability": 55}).json()
    assert (moved["stage"], moved["probability"]) == ("negotiation", 55)


def test_spec42_saving_with_no_stage_change_adds_no_row_and_keeps_the_place(client: TestClient, acme: dict) -> None:
    deal = _create(client, acme)
    _create(client, acme)  # now above it
    for body in ({"stage": "qualified"}, {"probability": 90}, {"close_date": "2027-01-31", "value": 5}):
        response = client.patch(f"/api/deals/{deal['id']}", json=body)
        assert response.status_code == 200
        assert response.json()["position"] == 1.0
    saved = client.get(f"/api/deals/{deal['id']}").json()
    assert (saved["probability"], saved["close_date"], saved["value"]) == (90, "2027-01-31", 5)
    assert len(_history(client, deal["id"])) == 1


def test_R16_R17_patch_to_won_closes_today_and_makes_the_contact_a_customer(
    client: TestClient, acme: dict, clock
) -> None:
    deal = _create(client, acme)
    clock.at = clock.at.replace(day=25, hour=9, minute=5)
    won = client.patch(f"/api/deals/{deal['id']}", json={"stage": "won", "close_date": "2027-06-01"}).json()
    assert (won["probability"], won["close_date"], won["closed_at"]) == (100, "2026-11-25", "2026-11-25T09:05:00")
    assert client.get(f"/api/contacts/{acme['jo']}").json()["status"] == "customer"
    # R16: the close date can be edited afterwards, and closed_at stays.
    edited = client.patch(f"/api/deals/{deal['id']}", json={"close_date": "2026-11-20"}).json()
    assert (edited["close_date"], edited["closed_at"]) == ("2026-11-20", "2026-11-25T09:05:00")


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_spec52_missing_deal_is_404(client: TestClient, method: str) -> None:
    kwargs = {"json": {"value": 1}} if method == "patch" else {}
    assert getattr(client, method)("/api/deals/404", **kwargs).status_code == 404
