"""V-B05 (T1.6 part): deal and move request rules (R12, R15, R21), and the deal response shape.

The endpoints, R23 and the stage-change rules through the API are added in T2.1 and T2.3.
"""

from datetime import date

import pytest
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
