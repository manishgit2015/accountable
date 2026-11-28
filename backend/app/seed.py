"""The sample data (R4, R80–R84), and clearing every table (spec 5.6, 6.5).

The names and scenarios start from docs/mockups/shared/data.js, so the app matches mockup 1 at
first run. Every date is relative to "now", passed in, so the data always looks current (R83).
The generator is deterministic (a fixed random seed). Each deal is walked through its stages
with rules.py, which gives its stage history, probability, close date, closed_at and its
contact's status, rather than setting those by hand. Names are made up (R84), and every web
and email address uses the reserved .example domain.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Connection, delete, func, insert, select, update

from app import rules
from app.db import activities, contacts, deals, organizations, stage_changes

RANDOM_SEED = 2026
TABLES_TO_CLEAR = (activities, stage_changes, deals, contacts, organizations)  # children first

# name, industry, notes. Twelve organizations across eight industries (R80).
ORGANIZATIONS = [
    ("Northwind Logistics", "Logistics", "Runs 140 vans across the north-west."),
    ("Bramble & Oak", "Professional services", "Architecture practice, two offices."),
    ("Kestrel Health", "Healthcare", "Group of six outpatient clinics."),
    ("Harbor Street Coffee", "Hospitality", "Twelve coffee shops and a roastery."),
    ("Lumen Studio", "Creative services", None),
    ("Fernhill Foods", "Food production", "Chilled ready meals for supermarkets."),
    ("Atlas Fabrication", "Manufacturing", "Three plants. Buys per plant."),
    ("Copperline Energy", "Energy", "Regional grid and solar operator."),
    ("Juniper Lane Interiors", "Retail", None),
    ("Silverbirch Analytics", "Software", "Small data consultancy."),
    ("Tidewater Marine Supply", "Logistics", None),
    ("Oakridge Dental Group", "Healthcare", "Eight practices, growing."),
]

# name, organization index, job title, status when no deal of theirs is won. 40 contacts (R80).
CONTACTS = [
    ("Priya Raman", 0, "Operations Director", "qualified"),
    ("Owen Fletcher", 0, "Fleet Manager", "lead"),
    ("Sasha Kim", 0, "Finance Lead", "lead"),
    ("Tom Ashworth", 1, "Managing Partner", "qualified"),
    ("Ellie Marsh", 1, "Office Manager", "lead"),
    ("Rafael Duarte", 1, "IT Coordinator", "lead"),
    ("Dana Whitfield", 2, "Head of Digital", "qualified"),
    ("Martin Hale", 2, "Clinical Director", "lead"),
    ("Aisha Bello", 2, "Procurement Manager", "qualified"),
    ("Luis Ortega", 3, "Founder", "qualified"),
    ("Chloe Bennett", 3, "Store Operations", "lead"),
    ("Ines Laurent", 4, "Studio Director", "qualified"),
    ("Jonah Weiss", 4, "Producer", "lead"),
    ("Grace Okafor", 5, "Supply Chain Manager", "qualified"),
    ("Harry Lund", 5, "Quality Lead", "lead"),
    ("Mei Tanaka", 5, "Sales Director", "lead"),
    ("Marcus Bell", 6, "Plant Manager", "qualified"),
    ("Nadia Petrova", 6, "Health and Safety Lead", "lead"),
    ("Callum Reid", 6, "Engineering Manager", "qualified"),
    ("Hannah Price", 7, "Head of Analytics", "qualified"),
    ("Victor Osei", 7, "Grid Operations Manager", "lead"),
    ("Freya Lindqvist", 7, "CFO", "lead"),
    ("Isla Moreno", 8, "Owner", "lead"),
    ("Ben Carver", 8, "Showroom Manager", "lead"),
    ("Zara Hussain", 8, "Buyer", "qualified"),
    ("Leo Brandt", 9, "Managing Director", "qualified"),
    ("Amara Nwosu", 9, "Lead Consultant", "lead"),
    ("Theo Grant", 9, "Operations Manager", "lead"),
    ("Ruby Fischer", 10, "Purchasing Manager", "lead"),
    ("Sam Okoro", 10, "Warehouse Supervisor", "lead"),
    ("Erin Walsh", 10, "General Manager", "qualified"),
    ("Kofi Mensah", 11, "Practice Manager", "lead"),
    ("Lena Novak", 11, "Clinical Lead", "lead"),
    ("Patrick Doyle", 11, "Director", "qualified"),
    ("Joanna Pike", 2, "IT Manager", "lead"),
    ("Arjun Mehta", 3, "Head of Marketing", "lead"),
    ("Fiona Grieve", 6, "Purchasing Officer", "lead"),
    ("Daniel Romero", 7, "Project Engineer", "lead"),
    ("Holly Turner", 9, "Office Manager", "lead"),
    ("Yusuf Aziz", 11, "Finance Manager", "lead"),
]


@dataclass(frozen=True)
class DealPlan:
    """One sample deal: its name, organization, contact and where its history ends."""

    name: str
    org: int
    contact: int
    value: int
    stage: str
    close_offset: int  # open deals: days from today to the close date
    closed: datetime | None = None  # closed deals: when they were won or lost
    last_move: datetime | None = None  # open deals: when they reached their stage


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _clamp(moment: datetime, now: datetime, floor: datetime | None = None) -> datetime:
    """Keep a generated moment in the past (and after `floor`), whatever time of day it is now."""
    moment = min(moment, now - timedelta(minutes=1))
    return max(moment, floor) if floor else moment


def _at(now: datetime, days_ago: int, hour: int, minute: int) -> datetime:
    return datetime.combine(now.date() - timedelta(days=days_ago), time(hour, minute))


def _month_back(today: date, months: int, day: int) -> date:
    index = today.year * 12 + today.month - 1 - months
    return date(index // 12, index % 12 + 1, day)


def _deal_plans(now: datetime, rng: random.Random) -> list[DealPlan]:
    """45 deals at every stage (R80, R81). The open ones and this month's closed ones are mockup 1's."""
    month_start = datetime.combine(now.date().replace(day=1), time())
    this_month = lambda days, h, m: _clamp(_at(now, days, h, m), now, month_start)  # noqa: E731
    open_deals = [
        # name, org, contact, value, stage, close date offset (the mockup's, from its "today")
        ("Fleet telematics pilot", 0, 0, 18000, "new", 28),
        ("Website rebuild", 1, 3, 9500, "new", 51),
        ("Annual support plan", 2, 6, 24000, "new", 63),
        ("POS rollout, 12 stores", 3, 9, 31000, "new", 77),
        ("Showroom lighting", 8, 22, 7200, "new", 40),
        ("Warehouse scanners", 0, 0, 42000, "qualified", 22),
        ("Clinic scheduling suite", 2, 6, 56000, "qualified", -6),
        ("Brand refresh", 4, 11, 14500, "qualified", 49),
        ("Cold-chain monitoring", 5, 13, 27000, "qualified", 40),
        ("ERP migration", 6, 16, 88000, "proposal", 30),
        ("Field sales tablets", 5, 13, 36000, "proposal", -10),
        ("Data warehouse", 7, 19, 64000, "proposal", 56),
        ("Loyalty app", 3, 9, 22000, "proposal", 15),
        ("Plant safety training", 6, 16, 19500, "negotiation", 8),
        ("Grid analytics licence", 7, 19, 120000, "negotiation", 25),
        ("Office network upgrade", 1, 3, 16000, "negotiation", -14),
        ("Telehealth integration", 2, 6, 48000, "negotiation", 18),
        ("Cloud backup service", 9, 25, 11000, "negotiation", -2),
    ]
    plans = [
        DealPlan(
            name=name,
            org=org,
            contact=contact,
            value=value,
            stage=stage,
            close_offset=offset,
            # Grid analytics moved to Negotiation 2 days ago, as in the mockup's recent activity.
            last_move=_clamp(_at(now, 2, 15, 20), now) if name == "Grid analytics licence" else None,
        )
        for name, org, contact, value, stage, offset in open_deals
    ]
    plans += [
        DealPlan("Route optimisation", 0, 0, 34000, "won", 0, closed=_clamp(_at(now, 0, 9, 42), now, month_start)),
        DealPlan("Packaging line sensors", 6, 16, 14500, "won", 0, closed=this_month(8, 14, 48)),
        DealPlan("Studio licences", 4, 11, 8000, "won", 0, closed=this_month(15, 11, 40)),
        DealPlan("Spare parts portal", 6, 16, 5000, "won", 0, closed=this_month(17, 16, 5)),
        DealPlan("Solar monitoring", 7, 19, 52000, "lost", 0, closed=this_month(11, 17, 5)),
    ]
    # A won and a lost deal in each of the 11 months before this one (R81).
    earlier = [
        ("Driver app", 0),
        ("Depot wifi", 0),
        ("Planning software", 1),
        ("Print management", 1),
        ("Patient reminders", 2),
        ("Lab results portal", 2),
        ("Barista training", 3),
        ("Roastery sensors", 3),
        ("Asset library", 4),
        ("Render farm hours", 4),
        ("Label printers", 5),
        ("Recipe costing", 5),
        ("CNC monitoring", 6),
        ("Welding cell audit", 6),
        ("Meter data platform", 7),
        ("Outage alerts", 7),
        ("Showroom booking site", 8),
        ("Stock counting", 8),
        ("Dashboard hosting", 9),
        ("Inventory audit", 10),
        ("Chandlery web shop", 10),
        ("Patient intake forms", 11),
    ]
    contacts_by_org: dict[int, list[int]] = {}
    for index, (_, org, _, _) in enumerate(CONTACTS):
        contacts_by_org.setdefault(org, []).append(index)
    for months_back in range(1, 12):
        for outcome in ("won", "lost"):
            name, org = earlier.pop(0)
            closed_day = _month_back(now.date(), months_back, rng.randint(3, 26))
            plans.append(
                DealPlan(
                    name=name,
                    org=org,
                    contact=rng.choice(contacts_by_org[org]),
                    value=rng.randrange(4000, 90000, 500),
                    stage=outcome,
                    close_offset=0,
                    closed=datetime.combine(closed_day, time(rng.randint(9, 17), rng.choice((0, 15, 30, 45)))),
                )
            )
    return plans


def _path(plan: DealPlan, rng: random.Random) -> list[str]:
    """The stages a deal went through, from the one it was created at to the one it's at now (R83)."""
    start = rng.choice(("new", "new", "qualified"))
    open_order = list(rules.OPEN_STAGES)
    if plan.stage in rules.OPEN_STAGES:
        first = min(open_order.index(start), open_order.index(plan.stage))
        return open_order[first : open_order.index(plan.stage) + 1]
    if plan.stage == "won":
        return [*open_order[open_order.index(start) :], "won"]
    furthest = rng.randint(open_order.index(start), len(open_order) - 1)  # lost after reaching some stage
    return [*open_order[open_order.index(start) : furthest + 1], "lost"]


def _history_times(end: datetime, steps: int, rng: random.Random) -> list[datetime]:
    """Moments for each step of a path, oldest first, ending at `end`."""
    times = [end]
    for _ in range(steps - 1):
        previous = times[0] - timedelta(days=rng.randint(4, 16), hours=rng.randint(0, 5))
        times.insert(0, previous)
    return times


class NotEmptyError(Exception):
    """Sample data would be added to a database that already holds records (E-8)."""


def load_sample_data(conn: Connection, now: datetime, *, replace: bool = True) -> dict[str, int]:
    """Put the sample data in, on the caller's transaction. Returns the counts.

    `replace=True` (`npm run seed`, local SQLite only) first deletes every row. `replace=False` (a new
    database's first start, which may be Supabase) deletes nothing, and refuses a database that has records.
    """
    rng = random.Random(RANDOM_SEED)
    if replace:
        clear_all(conn)
    elif any(counts(conn).values()):
        raise NotEmptyError("The database already has records, so sample data wasn't added.")
    stamp = lambda moment: moment.isoformat(timespec="seconds")  # noqa: E731
    created = stamp(now - timedelta(days=420))

    org_ids = []
    for name, industry, notes in ORGANIZATIONS:
        website = f"https://www.{_slug(name)}.example"
        row = {"name": name, "industry": industry, "website": website, "notes": notes}
        org_ids.append(_insert(conn, organizations, **row, created_at=created, updated_at=created))

    contact_ids = []
    for name, org, job_title, status in CONTACTS:
        email = f"{_slug(name).replace('-', '.')}@{_slug(ORGANIZATIONS[org][0])}.example"
        phone = f"+1 555 {rng.randint(100, 999)} {rng.randint(1000, 9999)}"
        row = {"name": name, "email": email, "phone": phone, "job_title": job_title, "status": status}
        contact_ids.append(
            _insert(conn, contacts, organization_id=org_ids[org], **row, created_at=created, updated_at=created)
        )

    deal_ids: dict[str, int] = {}
    deal_spans: dict[str, tuple[datetime, datetime]] = {}
    column_counts: dict[str, int] = {}
    for plan in _deal_plans(now, rng):
        path = _path(plan, rng)
        end = plan.closed or plan.last_move or _clamp(_at(now, rng.randint(1, 12), rng.randint(9, 17), 0), now)
        times = _history_times(end, len(path), rng)
        entered_close = now.date() + timedelta(days=plan.close_offset or rng.randint(10, 40))
        # Walk the deal through its stages with the rules (R15–R18).
        effects = rules.creation_effects(path[0], entered_close, times[0])
        history = [(None, path[0], times[0])]
        becomes_customer = False
        for stage, moment in zip(path[1:], times[1:], strict=True):
            state = rules.DealState(effects.stage, effects.probability, effects.close_date, effects.closed_at)
            history.append((effects.stage, stage, moment))
            effects = rules.stage_change_effects(state, stage, moment)
            becomes_customer = becomes_customer or effects.contact_becomes_customer
        column_counts[plan.stage] = column_counts.get(plan.stage, 0) + 1
        deal_id = _insert(
            conn,
            deals,
            organization_id=org_ids[plan.org],
            contact_id=contact_ids[plan.contact],
            name=plan.name,
            stage=effects.stage,
            value=plan.value,
            probability=effects.probability,
            close_date=effects.close_date.isoformat(),
            position=float(column_counts[plan.stage]),  # in the mockup's board order
            closed_at=stamp(effects.closed_at) if effects.closed_at else None,
            created_at=stamp(times[0]),
            updated_at=stamp(times[-1]),
        )
        for from_stage, to_stage, moment in history:
            conn.execute(
                insert(stage_changes).values(
                    deal_id=deal_id, from_stage=from_stage, to_stage=to_stage, changed_at=stamp(moment)
                )
            )
        if becomes_customer:  # R17
            conn.execute(update(contacts).where(contacts.c.id == contact_ids[plan.contact]).values(status="customer"))
        deal_ids[plan.name] = deal_id
        deal_spans[plan.name] = (times[0], effects.closed_at or now)

    for row in _activity_rows(now, rng, contact_ids, deal_ids, deal_spans):
        # Added when it happened, or now for one planned ahead. No person: it's sample data (R113).
        row["created_at"] = row["updated_at"] = stamp(min(row["occurred_at"], now))
        row["occurred_at"] = stamp(row["occurred_at"])
        if row.get("follow_up_date") is not None:
            row["follow_up_date"] = row["follow_up_date"].isoformat()
        conn.execute(insert(activities).values(**row))
    return counts(conn)


def _activity_rows(
    now: datetime,
    rng: random.Random,
    contact_ids: list[int],
    deal_ids: dict[str, int],
    deal_spans: dict[str, tuple[datetime, datetime]],
) -> list[dict[str, Any]]:
    """150 activities (R80), with follow-ups overdue, due today, this week, later and done (R82)."""
    today = now.date()
    by_name = {name: index for index, (name, *_rest) in enumerate(CONTACTS)}

    def on_contact(name: str) -> dict[str, Any]:
        return {"contact_id": contact_ids[by_name[name]], "deal_id": None}

    def on_deal(name: str) -> dict[str, Any]:
        return {"contact_id": None, "deal_id": deal_ids[name]}

    def item(
        kind: str, text: str, parent: dict[str, Any], when: datetime, due: int | None = None, done: bool = False
    ) -> dict[str, Any]:
        follow_up = today + timedelta(days=due) if due is not None else None
        return {
            "type": kind,
            "description": text,
            **parent,
            "occurred_at": when,
            "follow_up_date": follow_up,
            "done": int(done),
        }

    rows = [
        # Mockup 1's recent activity.
        item(
            "call",
            "Talked through pilot scope, wants 20 vans",
            on_contact("Priya Raman"),
            _clamp(_at(now, 1, 16, 10), now),
        ),
        item(
            "email",
            "Sent the security questionnaire",
            on_deal("Telehealth integration"),
            _clamp(_at(now, 1, 11, 5), now),
        ),
        item("note", "Prefers quotes split by plant", on_contact("Marcus Bell"), _clamp(_at(now, 2, 10, 2), now)),
        item("call", "Budget approved for Q1, wants a phased plan", on_contact("Hannah Price"), _at(now, 9, 9, 30)),
        item("email", "Sent the revised website timeline", on_deal("Website rebuild"), _at(now, 14, 13, 15)),
        # Mockup 1's follow-ups: overdue, today and in the next 7 days.
        item("email", "Send revised ERP quote", on_deal("ERP migration"), _at(now, 6, 10, 0), due=-3),
        item("call", "Chase decision on scheduling suite", on_contact("Dana Whitfield"), _at(now, 5, 15, 30), due=-2),
        item("call", "Confirm pilot start date", on_contact("Priya Raman"), _at(now, 3, 11, 0), due=0),
        item("email", "Email safety training agenda", on_deal("Plant safety training"), _at(now, 4, 9, 45), due=0),
        item("note", "Demo grid analytics to the CFO", on_deal("Grid analytics licence"), _at(now, 3, 14, 0), due=3),
        item("call", "Check loyalty app scope", on_contact("Luis Ortega"), _at(now, 4, 16, 20), due=5),
        item("email", "Send contract draft", on_deal("Telehealth integration"), _at(now, 2, 10, 30), due=6),
        # Planned activity, in the future (R13).
        item("call", "Workshop booked with the plant managers", on_deal("ERP migration"), _at(now, -2, 10, 0)),
        item("note", "Site visit planned at the roastery", on_contact("Luis Ortega"), _at(now, -4, 9, 30)),
    ]
    # Nine follow-ups due later, and eight done.
    later_open = [
        "Warehouse scanners",
        "Data warehouse",
        "Cold-chain monitoring",
        "Brand refresh",
        "Annual support plan",
        "POS rollout, 12 stores",
        "Fleet telematics pilot",
        "Showroom lighting",
        "Loyalty app",
    ]
    for index, name in enumerate(later_open):
        rows.append(
            item("call", f"Check in on {name.lower()}", on_deal(name), _at(now, 7 + index, 11, 0), due=10 + index * 7)
        )
    for index, name in enumerate(
        [
            "Owen Fletcher",
            "Ellie Marsh",
            "Aisha Bello",
            "Mei Tanaka",
            "Callum Reid",
            "Zara Hussain",
            "Erin Walsh",
            "Patrick Doyle",
        ]
    ):
        rows.append(
            item(
                "email",
                f"Send {name.split()[0]} the follow-up notes",
                on_contact(name),
                _at(now, 20 + index * 3, 10, 15),
                due=-(15 + index * 3) + 4,
                done=True,
            )
        )

    templates = {
        "call": [
            "Intro call, interested in a demo",
            "Discussed timeline and budget",
            "Left a voicemail",
            "Walked through the proposal",
            "Talked about next quarter's plans",
        ],
        "email": [
            "Sent pricing options",
            "Shared two case studies",
            "Sent the meeting notes",
            "Answered questions on support hours",
            "Sent a calendar invite for the demo",
        ],
        "note": [
            "Decision maker is the finance lead",
            "Wants to start after the holidays",
            "Comparing us with two other vendors",
            "Happy with the trial so far",
            "Needs sign-off from the board",
        ],
    }
    deal_names = list(deal_ids)
    while len(rows) < 150:
        kind = rng.choice(("call", "email", "note"))
        text = rng.choice(templates[kind])
        if rng.random() < 0.55:
            name = rng.choice(deal_names)
            start, end = deal_spans[name]
            # A working-hours moment while the deal was open (or up to now).
            days = rng.randint(0, max((end.date() - start.date()).days, 0))
            when = datetime.combine(
                start.date() + timedelta(days=days), time(rng.randint(9, 17), rng.choice((5, 25, 50)))
            )
            rows.append(item(kind, text, on_deal(name), _clamp(min(max(when, start), end), now)))
        else:
            name = rng.choice(CONTACTS)[0]
            rows.append(
                item(
                    kind,
                    text,
                    on_contact(name),
                    _clamp(_at(now, rng.randint(1, 150), rng.randint(9, 17), rng.choice((0, 20, 40))), now),
                )
            )
    return rows


def _insert(conn: Connection, table: Any, **values: Any) -> int:
    key = conn.execute(insert(table).values(**values)).inserted_primary_key
    assert key is not None
    return int(key[0])


def counts(conn: Connection) -> dict[str, int]:
    return {
        table.name: int(conn.execute(select(func.count()).select_from(table)).scalar_one())
        for table in (organizations, contacts, deals, activities)
    }


def clear_all(conn: Connection) -> dict[str, int]:
    """Empty every table on the caller's transaction (spec 6.5). The schema stays. Returns what was there."""
    before = counts(conn)
    for table in TABLES_TO_CLEAR:
        conn.execute(delete(table))
    return before


def describe(found: dict[str, int]) -> str:
    """ "12 organizations, 40 contacts, 45 deals, 150 activities" """
    return ", ".join(f"{found[name]} {name}" for name in ("organizations", "contacts", "deals", "activities"))
