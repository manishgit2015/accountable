"""The services: every business operation, one per concern (ENG-1).

Services take their connection and the time as arguments, never from globals, and never import
FastAPI. They raise the errors below, which the app answers in the spec 5.2 format.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Connection, Engine

from app.db import transaction


class ServiceError(Exception):
    """An expected refusal. `code` is a spec 5.2 code, and `fields` the messages per field."""

    code = "internal"

    def __init__(self, fields: dict[str, str] | None = None) -> None:
        super().__init__(self.code)
        self.fields = fields


class NotFound(ServiceError):
    """No record has that ID (404)."""

    code = "not_found"


class Invalid(ServiceError):
    """A field rule failed (422), for example R23 or a link to a record that doesn't exist."""

    code = "validation_failed"


class StalePosition(ServiceError):
    """A move refers to a card that's no longer where the request says (409, spec 5.4)."""

    code = "stale_position"


@contextmanager
def unit_of_work(engine: Engine) -> Iterator[Connection]:
    """One transaction for one request (REL-2): committed if it finishes, rolled back if it raises.

    Routers open it here, so they never reach into the data layer themselves.
    """
    with transaction(engine) as conn:
        yield conn
