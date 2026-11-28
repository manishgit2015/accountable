"""Who's signed in: checking each request's token (R101, R102, SEC-13, SEC-14, SEC-18, ADR-023, ADR-025).

Every API route but health needs `Authorization: Bearer <token>`. In real use the token is the access token
Supabase Auth gave the browser: a JWT signed with one of the project's signing keys, which are fetched from
SUPABASE_URL and cached for at most 10 minutes, and fetched again when a token names a key we don't know, at
most once every 30 seconds whatever asks, and never while holding the lock other requests need (REV-001). In
test mode it's signed with the test run's key instead (SEC-17), and checked the same way. The person comes
from the token's claims only, never from the request. Tokens are never logged or stored.
"""

from __future__ import annotations

import contextlib
import json
import threading
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Request

from app.config import Settings
from app.errors import AppError

AUDIENCE = "authenticated"
LEEWAY_S = 60
KEYS_MAX_AGE_S = 600
FETCH_TIMEOUT_S = 5
# At most one fetch of Supabase's keys this often, whatever asks for it: an unknown key name (which anyone
# can put in a token's header), a stale cache, or a retry while Supabase is down (review REV-001).
MIN_FETCH_INTERVAL_S = 30
ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True)
class Person:
    """The signed-in person, from the token (SEC-14). `name` is the display name in their user metadata."""

    id: str
    email: str
    name: str | None


class Unauthorized(AppError):
    def __init__(self) -> None:
        super().__init__(401, "unauthorized")


def fetch_jwks(url: str) -> dict[str, Any]:
    """Supabase's public signing keys. Only called outside test mode."""
    with urllib.request.urlopen(url, timeout=FETCH_TIMEOUT_S) as response:  # noqa: S310 (https from settings)
        return json.load(response)


class TokenChecker:
    """Checks tokens against a key set: Supabase's (cached, SEC-13) or the test run's (SEC-17)."""

    def __init__(
        self,
        settings: Settings,
        fetch: Callable[[str], dict[str, Any]] = fetch_jwks,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self.issuer = settings.token_issuer
        self._fetch = fetch
        self._now = now
        self._lock = threading.Lock()
        self._keys: dict[str, jwt.PyJWK] = {}
        self._fetched_at: float | None = None  # the last fetch that worked
        self._attempted_at: float | None = None  # the last fetch tried, worked or not
        self._fetching = False
        self._first_fetch = threading.Event()  # set once the first fetch has worked or failed
        if settings.test_mode:
            self._jwks_url = None
            self._keys = _public_keys(settings.test_auth_keys or {"keys": []})
        else:
            self._jwks_url = f"{self.issuer}/.well-known/jwks.json"

    def _claim_fetch(self, kid: str) -> bool:
        """Whether this request should fetch the keys now: it records the attempt, under the lock, so
        no other request fetches until MIN_FETCH_INTERVAL_S has passed (REV-001)."""
        with self._lock:
            now = self._now()
            if self._fetching:
                return False
            if self._attempted_at is not None and now - self._attempted_at < MIN_FETCH_INTERVAL_S:
                return False
            stale = self._fetched_at is None or now - self._fetched_at > KEYS_MAX_AGE_S
            if not stale and kid in self._keys:
                return False
            self._fetching = True
            self._attempted_at = now
            return True

    def _refresh(self) -> None:
        """Fetch Supabase's keys without holding the lock, so other requests go on with the cached keys.
        If Supabase can't be reached, the keys we have are kept."""
        assert self._jwks_url is not None
        keys: dict[str, jwt.PyJWK] | None = None
        with contextlib.suppress(OSError, ValueError):
            keys = _public_keys(self._fetch(self._jwks_url))
        with self._lock:
            if keys is not None:
                self._keys = keys
                self._fetched_at = self._now()
            self._fetching = False
        self._first_fetch.set()

    def _key(self, kid: str) -> jwt.PyJWK | None:
        if self._jwks_url is None:
            return self._keys.get(kid)
        if self._claim_fetch(kid):
            self._refresh()
        elif not self._first_fetch.is_set():
            # The very first fetch is under way: there are no keys to check with until it ends.
            self._first_fetch.wait(FETCH_TIMEOUT_S + 1)
        return self._keys.get(kid)

    def person(self, token: str) -> Person:
        """The person a valid token names, or Unauthorized for anything else (SEC-13)."""
        try:
            kid = jwt.get_unverified_header(token).get("kid")
            key = self._key(kid) if isinstance(kid, str) else None
            if key is None:
                raise Unauthorized
            claims = jwt.decode(
                token,
                key,
                algorithms=ALGORITHMS,
                audience=AUDIENCE,
                issuer=self.issuer,
                leeway=LEEWAY_S,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError as exc:
            raise Unauthorized from exc
        email = claims.get("email")
        if not isinstance(claims.get("sub"), str) or not isinstance(email, str) or not email:
            raise Unauthorized
        metadata = claims.get("user_metadata")
        name = metadata.get("name") if isinstance(metadata, dict) else None
        name = name.strip() if isinstance(name, str) and name.strip() else None
        return Person(id=claims["sub"], email=email, name=name)


def _public_keys(jwks: dict[str, Any]) -> dict[str, jwt.PyJWK]:
    """The signing keys by `kid`, public parts only: a private `d` is dropped, so it can only check."""
    keys: dict[str, jwt.PyJWK] = {}
    for raw in jwks.get("keys", []):
        if not isinstance(raw, dict) or not isinstance(raw.get("kid"), str):
            continue
        public = {k: v for k, v in raw.items() if k not in ("d", "p", "q", "dp", "dq", "qi")}
        try:
            keys[raw["kid"]] = jwt.PyJWK(public)
        except jwt.PyJWTError:
            continue
    return keys


def bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise Unauthorized
    return token.strip()


def signed_in(request: Request) -> Person:
    """FastAPI dependency for every route but health: the signed-in person, or 401 (R101)."""
    checker: TokenChecker = request.app.state.token_checker
    person = checker.person(bearer_token(request))
    request.app.state.directory.remember(person.id, person.email, person.name)  # section 6.5
    request.state.person = person
    return person
