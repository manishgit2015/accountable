"""Request IDs and logging (OBS-1 to OBS-3, SEC-8, ADR-005).

One line per request with the time, request ID, method, path template, status and duration.
Never a body, a query string or a field value: paths are logged as their route templates,
such as /api/contacts/{id}.
"""

from __future__ import annotations

import logging
import sys
import time
import uuid
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler
from typing import TYPE_CHECKING, Any

from starlette.routing import Match

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

    from app.config import Settings

LOGGER_NAME = "accountable"
LOG_FILE_NAME = "accountable.log"
LOG_MAX_BYTES = 5 * 1024 * 1024
LOG_BACKUPS = 3
REQUEST_ID_HEADER = "X-Request-ID"

log = logging.getLogger(LOGGER_NAME)
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def current_request_id() -> str | None:
    return _request_id.get()


def configure_logging(settings: Settings) -> None:
    """Send the app's log to the terminal and to a rotating file (OBS-2)."""
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S")
    terminal = logging.StreamHandler(sys.stderr)
    file = RotatingFileHandler(
        settings.log_dir / LOG_FILE_NAME, maxBytes=LOG_MAX_BYTES, backupCount=LOG_BACKUPS, encoding="utf-8"
    )
    for old in list(log.handlers):
        log.removeHandler(old)
        old.close()
    for handler in (terminal, file):
        handler.setFormatter(formatter)
        log.addHandler(handler)
    log.setLevel(settings.log_level)
    log.propagate = False


def path_template(routes: list[Any], scope: Scope) -> str:
    """The route template for a request, never the raw path (SEC-8)."""
    route = scope.get("route")
    if route is not None and hasattr(route, "path_format"):
        return str(route.path_format)
    # Refused before routing (for example by the Host check): look the route up without running it.
    for candidate in routes:
        match, _ = candidate.matches(scope)
        if match != Match.NONE:
            return str(candidate.path_format)
    return "<unmatched>"


class RequestContextMiddleware:
    """The outermost middleware: gives every request an ID, adds it to the response and logs one line."""

    def __init__(self, app: ASGIApp, routes: list[Any]) -> None:
        self.app = app
        self.routes = routes  # the app's API routes, filled in as routers are included

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        token = _request_id.set(request_id)
        scope.setdefault("state", {})["request_id"] = request_id
        started = time.perf_counter()
        status = 500

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.lower().encode(), request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            duration_ms = round((time.perf_counter() - started) * 1000)
            log.info(
                "request id=%s method=%s path=%s status=%s duration_ms=%s",
                request_id,
                scope["method"],
                path_template(self.routes, scope),
                status,
                duration_ms,
            )
            _request_id.reset(token)
