"""Business rules as pure functions (R14–R20, R24, spec 4.2 and 6.4).

No input or output, no clock reads (the time is passed in), and no imports from the app.
The stage list lives here and is mirrored once in frontend/src/lib/deals.ts.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

STAGES = ("new", "qualified", "proposal", "negotiation", "won", "lost")
OPEN_STAGES = STAGES[:4]
CLOSED_STAGES = ("won", "lost")
USUAL_PROBABILITY = {"new": 5, "qualified": 20, "proposal": 40, "negotiation": 70, "won": 100, "lost": 0}

CONTACT_STATUSES = ("lead", "qualified", "customer")
ACTIVITY_TYPES = ("note", "call", "email")

MAX_VALUE = 1_000_000_000
RENUMBER_GAP = 1e-6


def _check_stage(stage: str) -> None:
    if stage not in USUAL_PROBABILITY:
        raise ValueError(f"Unknown stage: {stage!r}")


def usual_probability(stage: str) -> int:
    """R14: the probability that goes with a stage."""
    _check_stage(stage)
    return USUAL_PROBABILITY[stage]


def is_open(stage: str) -> bool:
    _check_stage(stage)
    return stage in OPEN_STAGES


@dataclass(frozen=True)
class DealState:
    """The parts of a deal that a stage change can affect."""

    stage: str
    probability: int
    close_date: date
    closed_at: datetime | None


@dataclass(frozen=True)
class StageEffects:
    """A deal's stage fields after a creation or a save, and what else must happen (spec 4.2)."""

    stage: str
    probability: int
    close_date: date
    closed_at: datetime | None
    contact_becomes_customer: bool
    records_stage_change: bool


def creation_effects(stage: str, close_date: date, now: datetime, probability: int | None = None) -> StageEffects:
    """Spec 4.2, "Created at a stage": the usual probability unless one was set, the close date
    as entered, the contact unchanged, and a stage change row from no stage."""
    _check_stage(stage)
    return StageEffects(
        stage=stage,
        probability=usual_probability(stage) if probability is None else probability,
        close_date=close_date,
        # closed_at is when the deal last became Won or Lost (spec 6.1). Created closed, that's now.
        closed_at=None if is_open(stage) else now,
        contact_becomes_customer=False,
        records_stage_change=True,
    )


def stage_change_effects(
    current: DealState, new_stage: str, now: datetime, probability: int | None = None
) -> StageEffects:
    """Spec 4.2: the effects of saving a deal with `new_stage`, by any route (R15–R18, R24).

    `probability` is the one sent in the same save, if any. It's kept, because R15 says a save
    that changes both stage and probability keeps the probability sent.
    """
    _check_stage(new_stage)
    if new_stage == current.stage:
        return StageEffects(
            stage=current.stage,
            probability=current.probability if probability is None else probability,
            close_date=current.close_date,
            closed_at=current.closed_at,
            contact_becomes_customer=False,
            records_stage_change=False,
        )
    if new_stage in CLOSED_STAGES:
        close_date: date = now.date()  # R16: today
        closed_at: datetime | None = now
    else:
        close_date = current.close_date  # R24: reopening keeps the close date
        closed_at = None
    return StageEffects(
        stage=new_stage,
        probability=usual_probability(new_stage) if probability is None else probability,
        close_date=close_date,
        closed_at=closed_at,
        contact_becomes_customer=new_stage == "won",  # R17
        records_stage_change=True,  # R18
    )


def is_late(stage: str, close_date: date, today: date) -> bool:
    """R19: an open deal whose close date is before today."""
    return is_open(stage) and close_date < today


def expected_revenue(value: int, probability: int) -> int:
    """R20: value × probability ÷ 100, rounded to the nearest dollar (halves round up)."""
    return (value * probability + 50) // 100


def top_position(smallest: float | None) -> float:
    """Section 6.4: 1.0 below the column's smallest position, so the deal lands on top."""
    return 1.0 if smallest is None else smallest - 1.0


def midpoint(before: float | None, after: float | None) -> float:
    """Section 6.4: the position for a drop between the card above (`before`) and below (`after`)."""
    if before is None and after is None:
        return 1.0
    if before is None:
        assert after is not None
        return after - 1.0
    if after is None:
        return before + 1.0
    return (before + after) / 2


def needs_renumber(before: float | None, after: float | None) -> bool:
    """Section 6.4: two neighbours within 1e-6 of each other mean the column is renumbered first."""
    if before is None or after is None:
        return False
    return abs(after - before) <= RENUMBER_GAP


def renumbered_positions(count: int) -> list[float]:
    """Section 6.4: 1.0, 2.0, 3.0 and so on, in the column's current order."""
    return [float(i) for i in range(1, count + 1)]
