"""V-B08 (T1.6 part): activity request rules (R13, R21) and the activity and dashboard shapes.

The endpoints are added in T2.2, and the dashboard figures in T2.8.
"""

from datetime import date, datetime

import pytest
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
