"""The local-only trust boundary (SEC-1 to SEC-3, SEC-7, ADR-002).

- The Host header must be 127.0.0.1 or localhost on an allowed port (SEC-2, DNS rebinding).
- POST, PATCH, PUT and DELETE must come from the app's own origin (SEC-3, cross-site requests).
- Bodies must be JSON (415) and at most 1 MB (413).
- No CORS headers are ever added, so other websites can't read responses.

The allowed hosts and origins come from Settings, so a hosted deployment changes configuration,
not this code.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from app.errors import error_body

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

    from app.config import Settings

MAX_BODY_BYTES = 1024 * 1024
CHANGING_METHODS = frozenset({"POST", "PATCH", "PUT", "DELETE"})


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return value.decode("latin-1")
    return None


async def _refuse(send: Send, status: int, code: str) -> None:
    body = json.dumps(error_body(code)).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": body})


class SecurityMiddleware:
    def __init__(self, app: ASGIApp, settings: Settings) -> None:
        self.app = app
        self.allowed_hosts = settings.allowed_hosts
        self.allowed_origins = settings.allowed_origins

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        host = (_header(scope, b"host") or "").lower()
        if host not in self.allowed_hosts:
            await _refuse(send, 403, "forbidden_origin")
            return

        method = scope["method"]
        if method in CHANGING_METHODS and _header(scope, b"origin") not in self.allowed_origins:
            await _refuse(send, 403, "forbidden_origin")
            return

        length_header = _header(scope, b"content-length")
        chunked = "chunked" in (_header(scope, b"transfer-encoding") or "").lower()
        try:
            length = int(length_header) if length_header is not None else 0
        except ValueError:
            await _refuse(send, 400, "bad_request")
            return
        has_body = length > 0 or chunked

        if has_body:
            content_type = (_header(scope, b"content-type") or "").split(";")[0].strip().lower()
            if content_type != "application/json":
                await _refuse(send, 415, "unsupported_media_type")
                return
            if length > MAX_BODY_BYTES:
                await _refuse(send, 413, "too_large")
                return

        if not has_body:
            await self.app(scope, receive, send)
            return

        # Read the whole body first (at most 1 MB), so a streamed body that passes the limit is
        # refused before the app sees any of it. Then hand the app the body as it arrived.
        chunks: list[bytes] = []
        received = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            received += len(chunk)
            if received > MAX_BODY_BYTES:
                await _refuse(send, 413, "too_large")
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        body = b"".join(chunks)
        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
