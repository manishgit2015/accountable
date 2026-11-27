"""Performance data (V-P01, NFR-1–NFR-3, NFR-13): a multiple of the intent's volume.

The intent's volume is about 1,000 contacts, 500 deals and 5,000 activities. `npm run test:perf`
generates twice that (NFR-13) into its temporary database:

    python -m app.perfdata [--scale 2]

It replaces every row in the database named by ACCOUNTABLE_DB, in one transaction. It runs only in
test mode, where settings refuse DATABASE_URL and the real file (backend/data/accountable.db), so it
can never overwrite real data, on Supabase or on this computer (ADR-027).
Like seed.py, deals are walked through their stages with rules.py, so stage history,
probability, close dates, closed_at and customer status fit together. The generator is
deterministic (a fixed random seed) and dates are relative to the clock.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import datetime, time, timedelta
from typing import Any

from sqlalchemy import Connection, insert, update

from app import rules
from app.config import ConfigError, load_settings
from app.db import (
    activities,
    contacts,
    create_db_engine,
    deals,
    organizations,
    stage_changes,
    transaction,
    upgrade_to_head,
)
from app.seed import _insert, clear_all, counts, describe

# The intent's volume (intent section on performance), per 1 × scale.
BASE_VOLUME = {"organizations": 100, "contacts": 1000, "deals": 500, "activities": 5000}
RANDOM_SEED = 4242

WORDS = [
    "Acme",
    "Birch",
    "Cedar",
    "Delta",
    "Ember",
    "Falcon",
    "Granite",
    "Harbor",
    "Indigo",
    "Juniper",
    "Kestrel",
    "Lumen",
    "Maple",
    "Nimbus",
    "Orchid",
    "Pioneer",
    "Quartz",
    "Riverside",
    "Summit",
    "Tidewater",
    "Umber",
    "Vantage",
    "Willow",
    "Xenon",
    "Yardley",
    "Zenith",
]
SUFFIXES = ("Logistics", "Health", "Foods", "Studio", "Energy", "Analytics", "Interiors", "Fabrication", "Group")
INDUSTRIES = ("Logistics", "Healthcare", "Hospitality", "Manufacturing", "Energy", "Software", "Retail", "Food")
FIRST = [
    "Priya",
    "Owen",
    "Sasha",
    "Tom",
    "Ellie",
    "Rafael",
    "Dana",
    "Martin",
    "Aisha",
    "Luis",
    "Chloe",
    "Ines",
    "Jonah",
    "Grace",
    "Harry",
    "Mei",
    "Marcus",
    "Nadia",
    "Callum",
    "Hannah",
    "Victor",
    "Freya",
    "Isla",
    "Ben",
    "Zara",
    "Leo",
    "Amara",
    "Theo",
    "Ruby",
    "Sam",
    "Erin",
    "Kofi",
    "Lena",
    "Patrick",
    "Joanna",
    "Arjun",
]
LAST = [
    "Raman",
    "Fletcher",
    "Kim",
    "Ashworth",
    "Marsh",
    "Duarte",
    "Whitfield",
    "Hale",
    "Bello",
    "Ortega",
    "Bennett",
    "Laurent",
    "Weiss",
    "Okafor",
    "Lund",
    "Tanaka",
    "Bell",
    "Petrova",
    "Reid",
    "Price",
    "Osei",
    "Lindqvist",
    "Moreno",
    "Carver",
    "Hussain",
    "Brandt",
    "Nwosu",
    "Grant",
    "Fischer",
    "Okoro",
]
TITLES = ("Operations Director", "Finance Lead", "Office Manager", "Head of Digital", "Buyer", "Founder", "CFO")
DEAL_WORDS = ("Fleet", "Website", "Support", "POS", "Lighting", "Scanner", "Analytics", "Backup", "Network", "ERP")
DEAL_KINDS = ("pilot", "rollout", "renewal", "upgrade", "licence", "migration", "plan", "integration")
NOTES = {
    "call": ("Discussed pricing", "Walked through the demo", "Checked the timeline", "Left a voicemail"),
    "email": ("Sent the proposal", "Shared the case study", "Followed up on the quote", "Sent the contract"),
    "note": ("Decision maker is the finance lead", "Comparing two vendors", "Needs board sign-off"),
}


def generate(conn: Connection, now: datetime, scale: int = 2) -> dict[str, int]:
    """Replace every row with `scale` × the intent's volume, on the caller's transaction."""
    rng = random.Random(RANDOM_SEED)
    clear_all(conn)
    volume = {name: count * scale for name, count in BASE_VOLUME.items()}
    stamp = lambda moment: moment.isoformat(timespec="seconds")  # noqa: E731
    created = stamp(now - timedelta(days=500))
    today = now.date()

    org_ids = []
    for i in range(volume["organizations"]):
        name = f"{rng.choice(WORDS)} {rng.choice(SUFFIXES)} {i + 1}"
        row = {"name": name, "industry": rng.choice(INDUSTRIES), "website": f"https://org{i + 1}.example"}
        org_ids.append(_insert(conn, organizations, **row, notes=None, created_at=created, updated_at=created))

    contact_ids, contact_org = [], []
    for i in range(volume["contacts"]):
        org = org_ids[i % len(org_ids)]
        row = {
            "name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
            "email": f"person{i + 1}@org{org}.example",
            "phone": f"+1 555 {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
            "job_title": rng.choice(TITLES),
            "status": rng.choice(("lead", "lead", "qualified")),
        }
        contact_ids.append(_insert(conn, contacts, organization_id=org, **row, created_at=created, updated_at=created))
        contact_org.append(org)

    deal_ids: list[int] = []
    deal_spans: list[tuple[datetime, datetime]] = []
    history_rows: list[dict[str, Any]] = []
    customers: set[int] = set()
    positions: dict[str, int] = {}
    open_order = list(rules.OPEN_STAGES)
    for i in range(volume["deals"]):
        contact_index = rng.randrange(len(contact_ids))
        # About 60% open across the four open stages, the rest closed over the last 12 months.
        stage = rng.choice((*open_order, *open_order, *open_order, "won", "won", "lost", "lost"))
        start = rng.choice(("new", "new", "qualified"))
        if stage in rules.OPEN_STAGES:
            first = min(open_order.index(start), open_order.index(stage))
            path = open_order[first : open_order.index(stage) + 1]
            end = now - timedelta(days=rng.randint(1, 60), hours=rng.randint(0, 8))
        else:
            furthest = rng.randint(open_order.index(start), len(open_order) - 1)
            path = [*open_order[open_order.index(start) : furthest + 1], stage]
            end = now - timedelta(days=rng.randint(0, 360), hours=rng.randint(0, 8))
        end = min(end, now - timedelta(minutes=1))
        times = [end]
        for _ in range(len(path) - 1):
            times.insert(0, times[0] - timedelta(days=rng.randint(3, 20), hours=rng.randint(0, 6)))
        effects = rules.creation_effects(path[0], today + timedelta(days=rng.randint(-20, 90)), times[0])
        history = [(None, path[0], times[0])]
        for next_stage, moment in zip(path[1:], times[1:], strict=True):
            state = rules.DealState(effects.stage, effects.probability, effects.close_date, effects.closed_at)
            history.append((effects.stage, next_stage, moment))
            effects = rules.stage_change_effects(state, next_stage, moment)
            if effects.contact_becomes_customer:
                customers.add(contact_ids[contact_index])
        positions[stage] = positions.get(stage, 0) + 1
        deal_id = _insert(
            conn,
            deals,
            organization_id=contact_org[contact_index],
            contact_id=contact_ids[contact_index],
            name=f"{rng.choice(DEAL_WORDS)} {rng.choice(DEAL_KINDS)} {i + 1}",
            stage=effects.stage,
            value=rng.randrange(1000, 150000, 500),
            probability=effects.probability,
            close_date=effects.close_date.isoformat(),
            position=float(positions[stage]),
            closed_at=stamp(effects.closed_at) if effects.closed_at else None,
            created_at=stamp(times[0]),
            updated_at=stamp(times[-1]),
        )
        history_rows += [
            {"deal_id": deal_id, "from_stage": a, "to_stage": b, "changed_at": stamp(at)} for a, b, at in history
        ]
        deal_ids.append(deal_id)
        deal_spans.append((times[0], effects.closed_at or now))
    conn.execute(insert(stage_changes), history_rows)
    if customers:
        conn.execute(update(contacts).where(contacts.c.id.in_(customers)).values(status="customer"))

    activity_rows = []
    for _ in range(volume["activities"]):
        kind = rng.choice(("call", "email", "note"))
        if rng.random() < 0.5:
            index = rng.randrange(len(deal_ids))
            start, end = deal_spans[index]
            span = max(int((end - start).total_seconds() // 60), 1)
            when = start + timedelta(minutes=rng.randrange(span))
            parent = {"contact_id": None, "deal_id": deal_ids[index]}
        else:
            when = datetime.combine(today - timedelta(days=rng.randint(1, 400)), time(rng.randint(9, 17)))
            parent = {"contact_id": rng.choice(contact_ids), "deal_id": None}
        follow_up = None
        done = 0
        if rng.random() < 0.15:  # follow-ups overdue, today, this week and later, some done
            follow_up = (today + timedelta(days=rng.randint(-15, 45))).isoformat()
            done = int(rng.random() < 0.3)
        activity_rows.append(
            {
                "type": kind,
                "description": rng.choice(NOTES[kind]),
                **parent,
                "occurred_at": stamp(min(when, now - timedelta(minutes=1))),
                "follow_up_date": follow_up,
                "done": done,
            }
        )
    conn.execute(insert(activities), activity_rows)
    return counts(conn)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="perfdata", description="Fill a test database with performance data.")
    parser.add_argument("--scale", type=int, default=2, help="multiple of the intent's volume (default 2)")
    args = parser.parse_args(argv)
    try:
        settings = load_settings()
    except ConfigError as exc:
        print(f"perfdata: {exc}", file=sys.stderr)
        return 2
    if not settings.test_mode or settings.database_url:
        print("perfdata only runs in test mode (npm run test:perf), on a temporary SQLite file.", file=sys.stderr)
        return 2
    engine = create_db_engine(settings.db_path)
    try:
        upgrade_to_head(engine)
        with transaction(engine) as conn:
            found = generate(conn, settings.clock.now(), args.scale)
    finally:
        engine.dispose()
    print(f"Performance data ({args.scale} x the intent's volume): {describe(found)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
