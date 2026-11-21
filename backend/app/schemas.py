"""The API contract: request and response shapes for spec 5.3–5.5 (R10–R13, R21).

Frozen at checkpoint C1: a change after that is a contract change (plan, change control).

- Request models refuse unknown fields (spec 5.1), trim text, and treat blank text as empty (R21).
- A field's message is the one shown next to it in the form (R45, R48).
- Response models are separate from request models, so responses can grow without breaking requests.
- Dates are "YYYY-MM-DD", date-times local "YYYY-MM-DDTHH:MM:SS" with no time zone (ADR-013).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated, Any, ClassVar, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, model_validator

from app.rules import ACTIVITY_TYPES, CONTACT_STATUSES, MAX_VALUE, STAGES

Stage = Literal["new", "qualified", "proposal", "negotiation", "won", "lost"]
ContactStatus = Literal["lead", "qualified", "customer"]
ActivityType = Literal["note", "call", "email"]
TimelineKind = Literal["activity", "stage_change"]
SourceKind = Literal["organization", "contact", "deal"]

NAME_MAX = 200
EMAIL_MAX = 254
PHONE_MAX = 40
WEBSITE_MAX = 2048
SHORT_TEXT_MAX = 100
LONG_TEXT_MAX = 5000

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s.]+$")
_PHONE = re.compile(r"^[0-9 +()\-.]+$")
_HTTP_URL = re.compile(r"^https?://[^\s/?#]+[^\s]*$", re.IGNORECASE)
_BARE_DOMAIN = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d+)?([/?#]\S*)?$", re.I)
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$")


# The message for a required field that's missing or null, by field name (R11, R12, R13, R21).
MISSING_MESSAGES = {
    "name": "Enter a name.",
    "organization_id": "Choose an organization.",
    "contact_id": "Choose a contact.",
    "stage": "Choose a stage.",
    "value": "Enter a value.",
    "close_date": "Enter a close date.",
    "probability": "Enter a probability.",
    "status": "Choose a status.",
    "type": "Choose a type.",
    "description": "Enter a description.",
    "occurred_at": "Enter when it happened.",
    "done": "Choose done or not done.",
}


class FieldProblem(ValueError):
    """A rule failure for one field, raised where Pydantic can't tell which field it is."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


# Field rules (R21) ---------------------------------------------------------------------------------


def _text(value: Any) -> str | None:
    """Trim text, and treat a blank value as empty (R21)."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("Enter text.")
    trimmed = value.strip()
    return trimmed or None


def _required_text(message: str, maximum: int, what: str) -> Any:
    def check(value: Any) -> str:
        text = _text(value)
        if text is None:
            raise ValueError(message)
        if len(text) > maximum:
            raise ValueError(f"Keep the {what} to {maximum:,} characters or fewer.")
        return text

    return check


def _optional_text(maximum: int, what: str) -> Any:
    def check(value: Any) -> str | None:
        text = _text(value)
        if text is not None and len(text) > maximum:
            raise ValueError(f"Keep the {what} to {maximum:,} characters or fewer.")
        return text

    return check


def _email(value: Any) -> str | None:
    text = _text(value)
    if text is None:
        return None
    if len(text) > EMAIL_MAX:
        raise ValueError(f"Keep the email to {EMAIL_MAX} characters or fewer.")
    if not _EMAIL.match(text):
        raise ValueError("Enter an email like name@example.com.")
    return text


def _phone(value: Any) -> str | None:
    text = _text(value)
    if text is None:
        return None
    if len(text) > PHONE_MAX:
        raise ValueError(f"Keep the phone number to {PHONE_MAX} characters or fewer.")
    if not _PHONE.match(text):
        raise ValueError("Use only digits, spaces and + ( ) - . in a phone number.")
    return text


def _website(value: Any) -> str | None:
    """http:// and https:// are kept, a bare domain gets https:// in front, any other scheme is refused."""
    text = _text(value)
    if text is None:
        return None
    if _HTTP_URL.match(text):
        result = text
    elif _BARE_DOMAIN.match(text):
        result = f"https://{text}"
    else:
        raise ValueError("Enter a website like example.com or https://example.com.")
    if len(result) > WEBSITE_MAX:
        raise ValueError(f"Keep the website to {WEBSITE_MAX:,} characters or fewer.")
    return result


def _whole_number(minimum: int, maximum: int, message: str) -> Any:
    def check(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(message)
        if not minimum <= value <= maximum:
            raise ValueError(message)
        return value

    return check


def _id(message: str) -> Any:
    def check(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise ValueError(message)
        return value

    return check


def _date(message: str) -> Any:
    def check(value: Any) -> date:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if not isinstance(value, str) or not _DATE.match(value.strip()):
            raise ValueError(message)
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            raise ValueError(message) from None

    return check


def _optional_date(message: str) -> Any:
    required = _date(message)

    def check(value: Any) -> date | None:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        result: date = required(value)
        return result

    return check


def _local_datetime(value: Any) -> datetime:
    message = "Enter a date and time like 2026-11-21T14:30."
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not _DATETIME.match(value.strip()):
        raise ValueError(message)
    try:
        return datetime.fromisoformat(value.strip())
    except ValueError:
        raise ValueError(message) from None


def _choice(options: tuple[str, ...], message: str) -> Any:
    def check(value: Any) -> str:
        if not isinstance(value, str) or value not in options:
            raise ValueError(message)
        return value

    return check


def _flag(value: Any) -> bool:
    if not isinstance(value, bool):
        raise ValueError("Choose true or false.")
    return value


def _nullable(check: Any) -> Any:
    """For fields that may be null: null passes, anything else gets the field's rule."""

    def run(value: Any) -> Any:
        return None if value is None else check(value)

    return run


_name = _required_text("Enter a name.", NAME_MAX, "name")
_description = _required_text("Enter a description.", LONG_TEXT_MAX, "description")
_value = _whole_number(0, MAX_VALUE, "Enter a whole number of dollars from 0 to 1,000,000,000.")
_probability = _whole_number(0, 100, "Enter a whole-number percentage from 0 to 100.")
_close_date = _date("Enter a close date like 2026-12-31.")
_organization_id = _id("Choose an organization.")
_contact_id = _id("Choose a contact.")
_deal_id = _id("Choose a deal.")
_stage = _choice(STAGES, "Choose a stage.")
_status = _choice(CONTACT_STATUSES, "Choose a status.")
_type = _choice(ACTIVITY_TYPES, "Choose note, call or email.")

# Fields that are required where they appear (create bodies).
Name = Annotated[str, BeforeValidator(_name)]
Description = Annotated[str, BeforeValidator(_description)]
Value = Annotated[int, BeforeValidator(_value)]
CloseDate = Annotated[date, BeforeValidator(_close_date)]
OrganizationId = Annotated[int, BeforeValidator(_organization_id)]
ContactId = Annotated[int, BeforeValidator(_contact_id)]
StageField = Annotated[Stage, BeforeValidator(_stage)]

# Fields that may be left out or null (optional fields, and every field of a PATCH body).
Email = Annotated[str | None, BeforeValidator(_email)]
Phone = Annotated[str | None, BeforeValidator(_phone)]
Website = Annotated[str | None, BeforeValidator(_website)]
Industry = Annotated[str | None, BeforeValidator(_optional_text(SHORT_TEXT_MAX, "industry"))]
JobTitle = Annotated[str | None, BeforeValidator(_optional_text(SHORT_TEXT_MAX, "job title"))]
Notes = Annotated[str | None, BeforeValidator(_optional_text(LONG_TEXT_MAX, "notes"))]
FollowUpDate = Annotated[date | None, BeforeValidator(_optional_date("Enter a follow-up date like 2026-12-31."))]
MaybeName = Annotated[str | None, BeforeValidator(_nullable(_name))]
MaybeDescription = Annotated[str | None, BeforeValidator(_nullable(_description))]
MaybeValue = Annotated[int | None, BeforeValidator(_nullable(_value))]
MaybeProbability = Annotated[int | None, BeforeValidator(_nullable(_probability))]
MaybeCloseDate = Annotated[date | None, BeforeValidator(_nullable(_close_date))]
MaybeOccurredAt = Annotated[datetime | None, BeforeValidator(_nullable(_local_datetime))]
MaybeOrganizationId = Annotated[int | None, BeforeValidator(_nullable(_organization_id))]
MaybeContactId = Annotated[int | None, BeforeValidator(_nullable(_contact_id))]
MaybeDealId = Annotated[int | None, BeforeValidator(_nullable(_deal_id))]
MaybePositionId = Annotated[int | None, BeforeValidator(_nullable(_id("Choose a deal on the board.")))]
MaybeStage = Annotated[Stage | None, BeforeValidator(_nullable(_stage))]
MaybeStatus = Annotated[ContactStatus | None, BeforeValidator(_nullable(_status))]
MaybeType = Annotated[ActivityType | None, BeforeValidator(_nullable(_type))]
MaybeDone = Annotated[bool | None, BeforeValidator(_nullable(_flag))]
StatusField = Annotated[ContactStatus, BeforeValidator(_status)]
TypeField = Annotated[ActivityType, BeforeValidator(_type)]
Done = Annotated[bool, BeforeValidator(_flag)]


class Request(BaseModel):
    """Base for request bodies: unknown fields are refused with 422 (spec 5.1, SEC-7)."""

    model_config = ConfigDict(extra="forbid")


class UpdateRequest(Request):
    """Base for PATCH bodies: only the fields being changed are sent (spec 5.3).

    A required field may be left out, but not sent as null or blank. Optional fields sent as
    null or blank are cleared. Check `model_fields_set` for which fields were sent (R34).
    """

    NOT_NULLABLE: ClassVar[tuple[str, ...]] = ()

    @model_validator(mode="before")
    @classmethod
    def _refuse_null_for_required(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for field in cls.NOT_NULLABLE:
                if field in data and data[field] is None:
                    raise FieldProblem(field, MISSING_MESSAGES.get(field, "This is required."))
        return data


# Organizations (R10) -------------------------------------------------------------------------------


class OrganizationCreate(Request):
    name: Name
    website: Website = None
    industry: Industry = None
    notes: Notes = None


class OrganizationUpdate(UpdateRequest):
    NOT_NULLABLE = ("name",)
    name: MaybeName = None
    website: Website = None
    industry: Industry = None
    notes: Notes = None


class Organization(BaseModel):
    id: int
    name: str
    website: str | None
    industry: str | None
    notes: str | None
    contact_count: int
    open_deal_count: int
    open_value: int
    created_at: str
    updated_at: str


# Contacts (R11) ------------------------------------------------------------------------------------


class ContactCreate(Request):
    name: Name
    organization_id: OrganizationId  # required on create, for leads too (R11)
    email: Email = None
    phone: Phone = None
    job_title: JobTitle = None
    status: StatusField = "lead"


class ContactUpdate(UpdateRequest):
    # A link sent in a PATCH is checked; one left out is kept, even if a delete cleared it (R34).
    NOT_NULLABLE = ("name", "organization_id", "status")
    name: MaybeName = None
    organization_id: MaybeOrganizationId = None
    email: Email = None
    phone: Phone = None
    job_title: JobTitle = None
    status: MaybeStatus = None


class Contact(BaseModel):
    id: int
    organization_id: int | None
    organization_name: str | None
    name: str
    email: str | None
    phone: str | None
    job_title: str | None
    status: ContactStatus
    created_at: str
    updated_at: str


# Deals (R12, R15) ----------------------------------------------------------------------------------


class DealCreate(Request):
    name: Name
    organization_id: OrganizationId
    contact_id: ContactId
    stage: StageField
    value: Value
    close_date: CloseDate
    probability: MaybeProbability = None  # left out: the stage's usual one (R15, spec 5.3)


class DealUpdate(UpdateRequest):
    NOT_NULLABLE = ("name", "organization_id", "contact_id", "stage", "value", "close_date", "probability")
    name: MaybeName = None
    organization_id: MaybeOrganizationId = None
    contact_id: MaybeContactId = None
    stage: MaybeStage = None
    value: MaybeValue = None
    close_date: MaybeCloseDate = None
    probability: MaybeProbability = None


class DealMove(Request):
    """POST /api/deals/{id}/move (spec 5.4). `before_id` is the card above the drop, `after_id` below."""

    stage: StageField
    before_id: MaybePositionId = None
    after_id: MaybePositionId = None


class Deal(BaseModel):
    id: int
    organization_id: int | None
    organization_name: str | None
    contact_id: int | None
    contact_name: str | None
    name: str
    stage: Stage
    value: int
    probability: int
    expected_revenue: int
    close_date: str
    is_late: bool
    position: float
    closed_at: str | None
    created_at: str
    updated_at: str


class MoveResult(BaseModel):
    """The moved deal, plus any deal renumbered by the move (spec 5.4)."""

    deal: Deal
    renumbered: list[Deal]


# Activities (R13) ----------------------------------------------------------------------------------


class ActivityCreate(Request):
    type: TypeField
    description: Description
    contact_id: MaybeContactId = None
    deal_id: MaybeDealId = None
    occurred_at: MaybeOccurredAt = None  # left out: now (R13). May be in the future.
    follow_up_date: FollowUpDate = None
    done: Done = False

    @model_validator(mode="after")
    def _exactly_one_parent(self) -> ActivityCreate:
        if (self.contact_id is None) == (self.deal_id is None):
            raise FieldProblem("contact_id", "Log the activity on a contact or a deal, not both.")
        return self


class ActivityUpdate(UpdateRequest):
    NOT_NULLABLE = ("type", "description", "occurred_at", "done")
    type: MaybeType = None
    description: MaybeDescription = None
    occurred_at: MaybeOccurredAt = None
    follow_up_date: FollowUpDate = None
    done: MaybeDone = None


class Activity(BaseModel):
    id: int
    type: ActivityType
    contact_id: int | None
    deal_id: int | None
    description: str
    occurred_at: str
    follow_up_date: str | None
    done: bool


# Timelines and delete impact (spec 5.3) ------------------------------------------------------------


class Source(BaseModel):
    """The record a timeline entry came from (R54)."""

    kind: SourceKind
    id: int
    name: str


class TimelineEntry(BaseModel):
    kind: TimelineKind
    id: int
    type: ActivityType | None  # the activity type, or null for a stage change
    from_stage: Stage | None
    to_stage: Stage | None
    description: str | None  # null for a stage change
    at: str
    source: Source


class OrganizationDeleteImpact(BaseModel):
    contacts_kept: int
    deals_kept: int


class ContactDeleteImpact(BaseModel):
    deals_kept: int
    activities_deleted: int


class DealDeleteImpact(BaseModel):
    activities_deleted: int
    stage_changes_deleted: int


# Dashboard (spec 5.5) ------------------------------------------------------------------------------


class WonThisMonth(BaseModel):
    value: int
    count: int


class WinRate(BaseModel):
    won: int
    lost: int
    percent: int | None  # null when there are no closed deals (R70)


class Summary(BaseModel):
    open_value: int
    expected_revenue: int
    won_this_month: WonThisMonth
    win_rate: WinRate


class MonthFigures(BaseModel):
    month: str  # "YYYY-MM"
    revenue_won: int
    won: int
    lost: int


class FunnelStage(BaseModel):
    stage: Stage
    value: int


class OpenStage(BaseModel):
    stage: Stage
    count: int
    value: int
    expected: int


class FollowUp(Activity):
    """An open follow-up on the dashboard: the activity plus the record it belongs to (R76)."""

    source: Source


class FollowUps(BaseModel):
    overdue: list[FollowUp]
    today: list[FollowUp]
    next_7_days: list[FollowUp]
    later_count: int


class DashboardCounts(BaseModel):
    overdue_follow_ups: int
    late_deals: int


class Dashboard(BaseModel):
    today: str
    summary: Summary
    months: list[MonthFigures]  # always 12, oldest first
    funnel: list[FunnelStage]  # New to Won
    open_by_stage: list[OpenStage]
    follow_ups: FollowUps
    recent: list[TimelineEntry]  # the 10 latest activities and stage changes (R75)
    counts: DashboardCounts


class Health(BaseModel):
    status: Literal["ok", "error"]
    database: Literal["ok", "error"]
    schema_version: str | None
    app_version: str
