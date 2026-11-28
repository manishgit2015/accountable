"""POST /api/test/sign-in: test mode only (SEC-17, ADR-025, section 5.3).

The end-to-end tests and ui-check sign in as made-up test people with this, never with anyone's real
password and never through Supabase. The token is signed with the test run's key and checked by the same
code as Supabase's tokens (app/auth.py). main.py registers this router only in test mode, so without
ACCOUNTABLE_TEST_AUTH_KEYS the route doesn't exist (404).
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

import jwt
from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict

from app.auth import AUDIENCE, Unauthorized
from app.config import Settings

TOKEN_SECONDS = 3600
TEST_PASSWORD = "test"  # noqa: S105 (a made-up test person's password, for test mode only)


@dataclass(frozen=True)
class SignInPerson:
    id: str
    email: str
    name: str | None


TEST_PEOPLE = (
    SignInPerson("00000000-0000-4000-8000-000000000001", "priya@test.example", "Priya Shah"),
    SignInPerson("00000000-0000-4000-8000-000000000002", "sam@test.example", "Sam Lee"),
    # No display name, so the app shows the email (R105).
    SignInPerson("00000000-0000-4000-8000-000000000003", "noname@test.example", None),
)


class SignIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    password: str


router = APIRouter()


def make_test_token(settings: Settings, person: SignInPerson, seconds: int = TOKEN_SECONDS) -> str:
    """A token shaped like Supabase's, signed with the test run's private key."""
    assert settings.test_mode and settings.test_auth_keys, "test tokens exist only in test mode"
    private = next(k for k in settings.test_auth_keys["keys"] if k.get("d"))
    now = int(time.time())
    claims = {
        "iss": settings.token_issuer,
        "aud": AUDIENCE,
        "sub": person.id,
        "email": person.email,
        "user_metadata": {"name": person.name} if person.name else {},
        "role": "authenticated",
        "iat": now,
        "exp": now + seconds,
        "session_id": str(uuid.uuid4()),
    }
    return jwt.encode(claims, jwt.PyJWK(private).key, algorithm="ES256", headers={"kid": private["kid"]})


@router.post("/api/test/sign-in")
def sign_in(body: SignIn, request: Request) -> dict[str, object]:
    person = next((p for p in TEST_PEOPLE if p.email == body.email.strip().lower()), None)
    if person is None or body.password != TEST_PASSWORD:
        raise Unauthorized
    return {"access_token": make_test_token(request.app.state.settings, person), "expires_in": TOKEN_SECONDS}
