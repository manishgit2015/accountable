"""People: how a person is shown (R105), and the `users` table that keeps their name (R114, ADR-022)."""

from __future__ import annotations

import threading

from sqlalchemy import Engine

from app.config import Clock
from app.db import transaction, upsert_user


def display_name(name: str | None, email: str) -> str:
    return name.strip() if name and name.strip() else email


def initials(name: str | None, email: str) -> str:
    """The first letters of the first two words of the name, or the email's first letter, in capitals."""
    words = (name or "").split()
    if words:
        return "".join(word[0] for word in words[:2]).upper()
    return email[:1].upper()


class Directory:
    """Keeps the `users` table in step with whoever signs in (section 6.5, R114, ADR-022).

    A person's row is added on their first signed-in request, and updated when their email or name has
    changed, or once a day for `last_seen_at`, which is kept to the day. What was last written is kept
    in memory, so most requests don't touch the database for it, and the write is one upsert, so two
    first requests at once can't conflict. The row is written before the request's own work, so a
    record's `created_by` always finds it.
    """

    def __init__(self, engine: Engine, clock: Clock) -> None:
        self._engine = engine
        self._clock = clock
        self._lock = threading.Lock()
        self._written: dict[str, tuple[str, str | None, str]] = {}

    def remember(self, person_id: str, email: str, name: str | None) -> None:
        today = self._clock.today().isoformat()
        wanted = (email, name, today)
        with self._lock:
            if self._written.get(person_id) == wanted:
                return
        with transaction(self._engine) as conn:
            upsert_user(conn, person_id, email, name, today)
        with self._lock:
            self._written[person_id] = wanted
