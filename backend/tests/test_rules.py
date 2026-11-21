"""V-B01: the business rules of spec 4.2, R14–R20, R24 and section 6.4, as pure functions."""

from datetime import date, datetime

import pytest

from app import rules
from app.rules import DealState

NOW = datetime(2026, 11, 21, 14, 30, 0)
TODAY = NOW.date()
CLOSE = date(2026, 12, 15)


def deal(stage: str, probability: int | None = None, closed_at: datetime | None = None) -> DealState:
    return DealState(
        stage=stage,
        probability=rules.usual_probability(stage) if probability is None else probability,
        close_date=CLOSE,
        closed_at=closed_at,
    )


# R14 -------------------------------------------------------------------------------------------


def test_R14_usual_probability_of_each_stage() -> None:
    assert [rules.usual_probability(s) for s in rules.STAGES] == [5, 20, 40, 70, 100, 0]


def test_R14_stage_list_order_and_open_stages() -> None:
    assert rules.STAGES == ("new", "qualified", "proposal", "negotiation", "won", "lost")
    assert rules.OPEN_STAGES == ("new", "qualified", "proposal", "negotiation")
    assert [rules.is_open(s) for s in rules.STAGES] == [True, True, True, True, False, False]


def test_R14_unknown_stage_is_refused() -> None:
    with pytest.raises(ValueError):
        rules.usual_probability("archived")


# Spec 4.2: created at a stage ----------------------------------------------------------------


@pytest.mark.parametrize("stage", rules.OPEN_STAGES)
def test_R18_created_at_open_stage_takes_usual_probability_and_records_a_row(stage: str) -> None:
    e = rules.creation_effects(stage, CLOSE, NOW)
    assert e.stage == stage
    assert e.probability == rules.usual_probability(stage)
    assert e.close_date == CLOSE
    assert e.closed_at is None
    assert e.contact_becomes_customer is False
    assert e.records_stage_change is True


def test_R15_created_with_probability_set_in_the_form_keeps_it() -> None:
    e = rules.creation_effects("qualified", CLOSE, NOW, probability=35)
    assert e.probability == 35


@pytest.mark.parametrize("stage", rules.CLOSED_STAGES)
def test_R18_created_at_closed_stage_keeps_close_date_and_contact(stage: str) -> None:
    e = rules.creation_effects(stage, CLOSE, NOW)
    assert e.probability == rules.usual_probability(stage)
    assert e.close_date == CLOSE  # spec 4.2: "As entered (required)"
    assert e.contact_becomes_customer is False  # spec 4.2: "Unchanged"
    assert e.closed_at == NOW  # created closed: counts from its creation (ADR-015)
    assert e.records_stage_change is True


# Spec 4.2: open -> another open stage ----------------------------------------------------------


@pytest.mark.parametrize(
    ("old", "new"),
    [("new", "qualified"), ("qualified", "proposal"), ("negotiation", "new"), ("proposal", "negotiation")],
)
def test_R15_open_to_open_takes_new_usual_probability_and_keeps_close_date(old: str, new: str) -> None:
    e = rules.stage_change_effects(deal(old), new, NOW)
    assert e.stage == new
    assert e.probability == rules.usual_probability(new)
    assert e.close_date == CLOSE
    assert e.closed_at is None
    assert e.contact_becomes_customer is False
    assert e.records_stage_change is True


def test_R15_hand_set_probability_is_replaced_on_the_next_stage_change() -> None:
    e = rules.stage_change_effects(deal("qualified", probability=55), "proposal", NOW)
    assert e.probability == 40


def test_R15_probability_sent_with_the_stage_change_is_kept() -> None:
    e = rules.stage_change_effects(deal("qualified"), "proposal", NOW, probability=65)
    assert e.probability == 65


# Spec 4.2: any -> Won, any -> Lost ---------------------------------------------------------------


@pytest.mark.parametrize("old", ["new", "qualified", "proposal", "negotiation", "lost"])
def test_R16_R17_moving_to_won_sets_100_today_and_makes_contact_customer(old: str) -> None:
    e = rules.stage_change_effects(deal(old), "won", NOW)
    assert e.probability == 100
    assert e.close_date == TODAY
    assert e.closed_at == NOW
    assert e.contact_becomes_customer is True
    assert e.records_stage_change is True


@pytest.mark.parametrize("old", ["new", "qualified", "proposal", "negotiation", "won"])
def test_R16_moving_to_lost_sets_0_and_today_and_leaves_contact(old: str) -> None:
    e = rules.stage_change_effects(deal(old), "lost", NOW)
    assert e.probability == 0
    assert e.close_date == TODAY
    assert e.closed_at == NOW
    assert e.contact_becomes_customer is False
    assert e.records_stage_change is True


# Spec 4.2: Won or Lost -> open stage (R24) -------------------------------------------------------


@pytest.mark.parametrize("old", rules.CLOSED_STAGES)
@pytest.mark.parametrize("new", rules.OPEN_STAGES)
def test_R24_reopening_takes_usual_probability_and_keeps_close_date(old: str, new: str) -> None:
    e = rules.stage_change_effects(deal(old, closed_at=datetime(2026, 11, 2, 9, 0)), new, NOW)
    assert e.probability == rules.usual_probability(new)
    assert e.close_date == CLOSE
    assert e.closed_at is None  # null while it's open (spec 6.1)
    assert e.contact_becomes_customer is False  # stays customer: nothing changes it back
    assert e.records_stage_change is True


# Spec 4.2: same stage ----------------------------------------------------------------------------


@pytest.mark.parametrize("stage", rules.STAGES)
def test_R18_same_stage_changes_nothing_and_records_no_row(stage: str) -> None:
    closed = datetime(2026, 11, 2, 9, 0) if stage in rules.CLOSED_STAGES else None
    before = deal(stage, probability=33, closed_at=closed)
    e = rules.stage_change_effects(before, stage, NOW)
    assert (e.stage, e.probability, e.close_date, e.closed_at) == (stage, 33, CLOSE, closed)
    assert e.contact_becomes_customer is False
    assert e.records_stage_change is False


def test_R15_saved_with_no_stage_change_keeps_probability_as_sent() -> None:
    e = rules.stage_change_effects(deal("proposal"), "proposal", NOW, probability=45)
    assert e.probability == 45
    assert e.records_stage_change is False


# R19 late ------------------------------------------------------------------------------------------


@pytest.mark.parametrize("stage", rules.OPEN_STAGES)
def test_R19_open_deal_with_close_date_before_today_is_late(stage: str) -> None:
    assert rules.is_late(stage, date(2026, 11, 20), TODAY) is True
    assert rules.is_late(stage, TODAY, TODAY) is False
    assert rules.is_late(stage, date(2026, 11, 22), TODAY) is False


@pytest.mark.parametrize("stage", rules.CLOSED_STAGES)
def test_R19_closed_deal_is_never_late(stage: str) -> None:
    assert rules.is_late(stage, date(2020, 1, 1), TODAY) is False


# R20 expected revenue ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "probability", "expected"),
    [(10_000, 40, 4_000), (0, 70, 0), (1_000_000_000, 100, 1_000_000_000), (999, 5, 50), (990, 5, 50), (989, 5, 49)],
)
def test_R20_expected_revenue_is_value_times_probability_rounded(value: int, probability: int, expected: int) -> None:
    assert rules.expected_revenue(value, probability) == expected


def test_R20_half_a_dollar_rounds_up() -> None:
    assert rules.expected_revenue(10, 5) == 1  # 0.5 -> 1, not banker's rounding to 0


# Section 6.4 positions -------------------------------------------------------------------------------


def test_R67_top_position_is_one_below_the_smallest() -> None:
    assert rules.top_position(None) == 1.0
    assert rules.top_position(1.0) == 0.0
    assert rules.top_position(-3.5) == -4.5


def test_R63_drop_between_two_cards_takes_the_midpoint() -> None:
    assert rules.midpoint(1.0, 2.0) == 1.5
    assert rules.midpoint(None, 2.0) == 1.0
    assert rules.midpoint(4.0, None) == 5.0
    assert rules.midpoint(None, None) == 1.0


def test_R63_renumber_when_neighbours_are_within_1e_6() -> None:
    assert rules.needs_renumber(1.0, 1.0 + 5e-7) is True
    assert rules.needs_renumber(1.0, 1.0) is True
    assert rules.needs_renumber(1.0, 1.0 + 2e-6) is False
    assert rules.needs_renumber(None, 1.0) is False
    assert rules.needs_renumber(1.0, None) is False


def test_R63_renumbering_gives_1_2_3() -> None:
    assert rules.renumbered_positions(3) == [1.0, 2.0, 3.0]
    assert rules.renumbered_positions(0) == []


def test_R63_repeated_halving_eventually_needs_renumbering() -> None:
    low, high = 1.0, 2.0
    for _ in range(40):
        if rules.needs_renumber(low, high):
            break
        high = rules.midpoint(low, high)
    assert rules.needs_renumber(low, high) is True
