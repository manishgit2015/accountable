"""The error format and codes of spec 5.2 (REL-6).

Every error body is {"error": {"code", "message", "fields"?, "request_id"}}. A database that
stays locked becomes 503 "busy", one that can't be reached 503 "database_unavailable" (REL-13).
Anything unexpected becomes a generic 500, with the stack trace only in the log.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.db import is_locked, is_unreachable
from app.logging import current_request_id, log
from app.schemas import MISSING_MESSAGES

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

MESSAGES = {
    "bad_request": "The request couldn't be read. Send valid JSON.",
    "forbidden_origin": "This request isn't allowed from here.",
    "not_found": "That record doesn't exist.",
    "stale_position": "The board changed. Try again.",
    "too_large": "The request is too large.",
    "unsupported_media_type": "Send the request as JSON.",
    "validation_failed": "Check the highlighted fields.",
    "busy": "Accountable is busy. Try again.",
    "database_unavailable": "Accountable can't reach its database. Try again in a minute.",
    "internal": "Something went wrong. Try again, and check the terminal if it keeps happening.",
    "method_not_allowed": "That action isn't available here.",
}


class AppError(Exception):
    """An expected error, answered in the spec 5.2 format."""

    def __init__(
        self, status: int, code: str, message: str | None = None, fields: dict[str, str] | None = None
    ) -> None:
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message or MESSAGES.get(code, MESSAGES["internal"])
        self.fields = fields


def error_body(code: str, message: str | None = None, fields: dict[str, str] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message or MESSAGES.get(code, MESSAGES["internal"])}
    if fields:
        error["fields"] = fields
    error["request_id"] = current_request_id()
    return {"error": error}


def error_response(
    status: int, code: str, message: str | None = None, fields: dict[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(error_body(code, message, fields), status_code=status)


def _field_name(loc: tuple[Any, ...]) -> str:
    parts = [str(p) for p in loc if p != "body"]
    return ".".join(parts) if parts else "_"


def validation_fields(errors: Sequence[Mapping[str, Any]]) -> dict[str, str]:
    """Turn Pydantic errors into one plain message per field."""
    fields: dict[str, str] = {}
    for err in errors:
        cause = (err.get("ctx") or {}).get("error")
        field = getattr(cause, "field", None) or _field_name(tuple(err.get("loc", ())))
        kind = err.get("type")
        if isinstance(cause, ValueError):
            message = str(cause)
        elif kind == "missing":
            message = MISSING_MESSAGES.get(field, "This is required.")
        elif kind == "extra_forbidden":
            message = "This field isn't allowed."
        elif field == "_":
            message = "Send a JSON object."
        else:
            message = "This value isn't valid."
        fields.setdefault(field, message)
    return fields


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc.status, exc.code, exc.message, exc.fields)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = list(exc.errors())
    if any(e.get("type") == "json_invalid" for e in errors):
        return error_response(400, "bad_request")
    return error_response(422, "validation_failed", fields=validation_fields(errors))


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = {404: "not_found", 405: "method_not_allowed", 413: "too_large", 415: "unsupported_media_type"}.get(
        exc.status_code, "bad_request"
    )
    return error_response(exc.status_code, code)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)


class UnexpectedErrorMiddleware:
    """Innermost of the app's middleware: a locked or unreachable database is 503, anything else unexpected 500.

    The stack trace goes to the log with the request ID, never to the response (V-S07).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:
            if started:
                log.exception("error after the response started id=%s", current_request_id())
                raise
            if is_locked(exc):
                log.warning("database busy id=%s", current_request_id())
                status, code = 503, "busy"
            elif is_unreachable(exc):
                log.warning("database unreachable id=%s (%s)", current_request_id(), type(exc).__name__)
                status, code = 503, "database_unavailable"
            else:
                log.exception("unexpected error id=%s", current_request_id())
                status, code = 500, "internal"
            body = json.dumps(error_body(code)).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": status,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
                }
            )
            await send({"type": "http.response.body", "body": body})
