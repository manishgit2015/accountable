"""V-B15, V-B14: the token check (R101, R102, R105, SEC-13, SEC-14, SEC-17, ADR-023, ADR-025).

Tokens are made here with the test run's key, or another one, so every way a token can be wrong is tried
without Supabase or the network. Supabase's key endpoint is replaced by a function that counts its calls.
"""

from __future__ import annotations

import base64
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import jwt
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.auth import KEYS_MAX_AGE_S, MIN_FETCH_INTERVAL_S, Person, TokenChecker, Unauthorized
from app.config import FixedClock, Settings
from app.main import SIGNED_IN_ROUTERS, create_app
from app.people import display_name, initials
from app.routers.sign_in_for_tests import TEST_PEOPLE
from tests.conftest import API_BASE, APP_ORIGIN
from tests.testkeys import make_test_keys

PRIYA = TEST_PEOPLE[0]


def _token(settings: Settings, keys: dict | None = None, header: dict | None = None, **changes: Any) -> str:
    """A token like the test sign-in's, with any claim changed (None removes it)."""
    private = (keys or settings.test_auth_keys or {})["keys"][0]
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": settings.token_issuer,
        "aud": "authenticated",
        "sub": PRIYA.id,
        "email": PRIYA.email,
        "user_metadata": {"name": PRIYA.name},
        "iat": now,
        "exp": now + 600,
    }
    for name, value in changes.items():
        if value is None:
            claims.pop(name, None)
        else:
            claims[name] = value
    return jwt.encode(
        claims, jwt.PyJWK(private).key, algorithm="ES256", headers={"kid": private["kid"], **(header or {})}
    )


def _signed_in_paths() -> list[tuple[str, str]]:
    """Every method and path behind sign-in, with 1 for each path parameter."""
    found = []
    for router in SIGNED_IN_ROUTERS:
        for route in router.routes:
            assert isinstance(route, APIRoute)
            for method in route.methods or ():
                found.append((method, re.sub(r"\{[^}]+\}", "1", route.path)))
    return sorted(found)


def test_R101_SEC13_every_route_but_health_refuses_a_missing_token_with_401(anonymous: TestClient) -> None:
    paths = _signed_in_paths()
    assert len(paths) >= 20  # every list, record, timeline, impact, move, dashboard and /api/me
    for method, path in paths:
        response = anonymous.request(method, path)
        assert response.status_code == 401, (method, path, response.text)
        error = response.json()["error"]
        assert (error["code"], error["message"]) == ("unauthorized", "Sign in to continue.")  # V-B14


def test_spec55_health_needs_no_sign_in(anonymous: TestClient) -> None:
    assert anonymous.get("/api/health").status_code == 200


@pytest.mark.parametrize(
    "authorization",
    ["", "Bearer", "Bearer ", "Basic abc", "Bearer not-a-token", "Bearer a.b.c", "bearer"],
)
def test_SEC13_a_missing_or_malformed_token_is_401(anonymous: TestClient, authorization: str) -> None:
    response = anonymous.get("/api/me", headers={"Authorization": authorization})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "case",
    [
        "expired",
        "wrong_issuer",
        "wrong_audience",
        "no_exp",
        "no_sub",
        "no_email",
        "other_key",
        "unknown_kid",
        "edited_payload",
        "alg_none",
    ],
)
def test_SEC13_a_token_that_isnt_valid_for_this_project_is_401(
    anonymous: TestClient, settings: Settings, case: str
) -> None:
    other = make_test_keys()
    assert settings.test_auth_keys
    other["keys"][0]["kid"] = settings.test_auth_keys["keys"][0]["kid"]  # same kid, different key
    tokens = {
        "expired": lambda: _token(settings, exp=int(time.time()) - 120),
        "wrong_issuer": lambda: _token(settings, iss="https://other.supabase.co/auth/v1"),
        "wrong_audience": lambda: _token(settings, aud="anon"),
        "no_exp": lambda: _token(settings, exp=None),
        "no_sub": lambda: _token(settings, sub=None),
        "no_email": lambda: _token(settings, email=None),
        "other_key": lambda: _token(settings, keys=other),
        "unknown_kid": lambda: _token(settings, header={"kid": "someone-elses"}),
        "edited_payload": lambda: _edit_payload(_token(settings), sub="00000000-0000-4000-8000-000000000999"),
        "alg_none": lambda: jwt.encode({"sub": PRIYA.id, "aud": "authenticated"}, key="", algorithm="none"),
    }
    response = anonymous.get("/api/me", headers={"Authorization": f"Bearer {tokens[case]()}"})
    assert response.status_code == 401, case


def _edit_payload(token: str, **claims: str) -> str:
    """The same signature over a payload someone changed."""
    header, _payload, signature = token.split(".")
    original = json.loads(base64.urlsafe_b64decode(_payload + "=" * (-len(_payload) % 4)))
    edited = base64.urlsafe_b64encode(json.dumps({**original, **claims}).encode()).rstrip(b"=").decode()
    return f"{header}.{edited}.{signature}"


def test_SEC13_60_seconds_of_clock_drift_are_allowed(anonymous: TestClient, settings: Settings) -> None:
    token = _token(settings, exp=int(time.time()) - 30)
    assert anonymous.get("/api/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_R105_SEC14_api_me_is_the_person_in_the_token(client: TestClient) -> None:
    assert client.get("/api/me").json() == {
        "id": PRIYA.id,
        "name": "Priya Shah",
        "email": "priya@test.example",
        "initials": "PS",
    }


def test_SEC14_nothing_but_the_token_says_who_is_asking(client: TestClient) -> None:
    sam = TEST_PEOPLE[1]
    response = client.get(f"/api/me?sub={sam.id}&email={sam.email}", headers={"X-User-Id": sam.id})
    assert response.json()["email"] == "priya@test.example"


def test_R105_someone_with_no_display_name_shows_by_email(anonymous: TestClient, settings: Settings) -> None:
    token = _token(settings, sub="00000000-0000-4000-8000-000000000003", email="noname@test.example", user_metadata={})
    me = anonymous.get("/api/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert (me["name"], me["initials"]) == ("noname@test.example", "N")


@pytest.mark.parametrize(
    ("name", "email", "shown", "letters"),
    [
        ("Priya Shah", "priya@x.example", "Priya Shah", "PS"),
        ("  Ana   María  López ", "ana@x.example", "Ana   María  López", "AM"),
        ("Cher", "cher@x.example", "Cher", "C"),
        (None, "sam@x.example", "sam@x.example", "S"),
        ("   ", "zed@x.example", "zed@x.example", "Z"),
        ("élodie durand", "e@x.example", "élodie durand", "ÉD"),
    ],
)
def test_R105_display_name_and_initials(name: str | None, email: str, shown: str, letters: str) -> None:
    assert display_name(name, email) == shown
    assert initials(name, email) == letters


# --- Supabase's signing keys: cached for 10 minutes, fetched again for an unknown key (SEC-13, ADR-023) ---


class FakeSupabase:
    """Stands in for SUPABASE_URL/auth/v1/.well-known/jwks.json, counting how often it's asked."""

    def __init__(self, jwks: dict) -> None:
        self.jwks = jwks
        self.calls: list[str] = []
        self.down = False

    def __call__(self, url: str) -> dict:
        self.calls.append(url)
        if self.down:
            raise OSError("Supabase is unreachable")
        return {"keys": [{k: v for k, v in key.items() if k != "d"} for key in self.jwks["keys"]]}


@pytest.fixture
def real_settings(tmp_path: Path) -> Settings:
    return Settings(
        db_path=tmp_path / "t.db",
        log_dir=tmp_path / "logs",
        clock=FixedClock(datetime(2026, 11, 21, 14, 30)),
        supabase_url="https://abcdefghij.supabase.co",
        frontend_dist=tmp_path / "no-dist",
    )


def test_ADR023_keys_are_fetched_once_and_cached_for_10_minutes(real_settings: Settings) -> None:
    keys = make_test_keys()
    supabase = FakeSupabase(keys)
    clock = [1000.0]
    checker = TokenChecker(real_settings, fetch=supabase, now=lambda: clock[0])
    token = _token(real_settings, keys=keys)
    assert checker.person(token) == Person(PRIYA.id, PRIYA.email, PRIYA.name)
    assert supabase.calls == ["https://abcdefghij.supabase.co/auth/v1/.well-known/jwks.json"]
    clock[0] += KEYS_MAX_AGE_S - 1
    checker.person(token)
    assert len(supabase.calls) == 1
    clock[0] += 2
    checker.person(token)
    assert len(supabase.calls) == 2


def test_ADR023_a_new_signing_key_is_fetched_once_the_interval_has_passed(real_settings: Settings) -> None:
    first, second = make_test_keys(), make_test_keys()
    supabase = FakeSupabase(first)
    clock = [0.0]
    checker = TokenChecker(real_settings, fetch=supabase, now=lambda: clock[0])
    checker.person(_token(real_settings, keys=first))
    supabase.jwks = {"keys": first["keys"] + second["keys"]}  # Supabase rotated its keys
    clock[0] += MIN_FETCH_INTERVAL_S + 1
    assert checker.person(_token(real_settings, keys=second)).email == PRIYA.email
    assert len(supabase.calls) == 2


def test_REV001_tokens_naming_made_up_keys_fetch_at_most_once_per_interval(real_settings: Settings) -> None:
    """Anyone can put any key name in a token's header, so unknown names mustn't each cost a fetch."""
    supabase = FakeSupabase(make_test_keys())
    stranger = make_test_keys()  # someone else's key, signing tokens under made-up names
    clock = [0.0]
    checker = TokenChecker(real_settings, fetch=supabase, now=lambda: clock[0])
    for n in range(50):
        with pytest.raises(Unauthorized):
            checker.person(_token(real_settings, keys=stranger, header={"kid": f"made-up-{n}"}))
    assert len(supabase.calls) == 1
    clock[0] += MIN_FETCH_INTERVAL_S + 1
    with pytest.raises(Unauthorized):
        checker.person(_token(real_settings, keys=stranger, header={"kid": "made-up-again"}))
    assert len(supabase.calls) == 2


def test_REV001_while_supabase_is_down_requests_dont_each_try_it_again(real_settings: Settings) -> None:
    keys = make_test_keys()
    supabase = FakeSupabase(keys)
    clock = [0.0]
    checker = TokenChecker(real_settings, fetch=supabase, now=lambda: clock[0])
    checker.person(_token(real_settings, keys=keys))
    supabase.down = True
    clock[0] += KEYS_MAX_AGE_S + 1  # the cache is stale, and Supabase doesn't answer
    for _ in range(20):
        assert checker.person(_token(real_settings, keys=keys)).id == PRIYA.id  # the cached keys still work
    assert len(supabase.calls) == 2  # one failed try, not twenty
    clock[0] += MIN_FETCH_INTERVAL_S + 1
    supabase.down = False
    checker.person(_token(real_settings, keys=keys))
    assert len(supabase.calls) == 3


def test_REV001_a_slow_fetch_doesnt_hold_up_requests_that_have_keys(real_settings: Settings) -> None:
    import threading

    keys = make_test_keys()
    supabase = FakeSupabase(keys)
    release = threading.Event()
    slow = {"on": False}

    def fetch(url: str) -> dict:
        if slow["on"]:
            release.wait(5)
        return supabase(url)

    clock = [0.0]
    checker = TokenChecker(real_settings, fetch=fetch, now=lambda: clock[0])
    token = _token(real_settings, keys=keys)
    checker.person(token)
    slow["on"] = True
    clock[0] += KEYS_MAX_AGE_S + 1
    fetching = threading.Thread(target=checker.person, args=(token,))
    fetching.start()  # this one refreshes the stale keys, and Supabase is slow
    try:
        done = threading.Event()
        other = threading.Thread(target=lambda: (checker.person(token), done.set()))
        other.start()
        assert done.wait(1), "a request with cached keys waited for the slow fetch"
    finally:
        release.set()
        fetching.join(5)


def test_REV001_the_first_fetch_is_waited_for_when_there_are_no_keys_yet(real_settings: Settings) -> None:
    import threading

    keys = make_test_keys()
    supabase = FakeSupabase(keys)
    started, release = threading.Event(), threading.Event()

    def fetch(url: str) -> dict:
        started.set()
        release.wait(5)
        return supabase(url)

    checker = TokenChecker(real_settings, fetch=fetch, now=lambda: 0.0)
    token = _token(real_settings, keys=keys)
    first = threading.Thread(target=checker.person, args=(token,))
    first.start()
    assert started.wait(5)
    results: list[str] = []
    second = threading.Thread(target=lambda: results.append(checker.person(token).id))
    second.start()
    release.set()
    first.join(5)
    second.join(5)
    assert results == [PRIYA.id]
    assert len(supabase.calls) == 1


def test_SEC13_supabase_unreachable_keeps_the_cached_keys_and_refuses_unknown_ones(real_settings: Settings) -> None:
    keys = make_test_keys()
    supabase = FakeSupabase(keys)
    clock = [0.0]
    checker = TokenChecker(real_settings, fetch=supabase, now=lambda: clock[0])
    checker.person(_token(real_settings, keys=keys))
    supabase.down = True
    clock[0] += KEYS_MAX_AGE_S + 1
    assert checker.person(_token(real_settings, keys=keys)).id == PRIYA.id
    with pytest.raises(Unauthorized):
        checker.person(_token(real_settings, keys=make_test_keys()))


def test_SEC13_real_use_checks_the_issuer_from_supabase_url(real_settings: Settings) -> None:
    keys = make_test_keys()
    checker = TokenChecker(real_settings, fetch=FakeSupabase(keys), now=lambda: 0.0)
    assert checker.issuer == "https://abcdefghij.supabase.co/auth/v1"
    with pytest.raises(Unauthorized):
        checker.person(_token(real_settings, keys=keys, iss="accountable-test/auth/v1"))


def test_SEC17_real_use_never_trusts_the_test_key(real_settings: Settings, settings: Settings) -> None:
    """A test token sent to an app outside test mode is refused because of its key, even with the real issuer."""
    checker = TokenChecker(real_settings, fetch=FakeSupabase(make_test_keys()), now=lambda: 0.0)
    with pytest.raises(Unauthorized):
        checker.person(_token(settings, iss=real_settings.token_issuer))


# --- The test sign-in (SEC-17, section 5.3) ---


def test_SEC17_test_sign_in_gives_a_token_the_api_accepts(anonymous: TestClient) -> None:
    signed = anonymous.post("/api/test/sign-in", json={"email": "sam@test.example", "password": "test"})
    assert signed.status_code == 200
    body = signed.json()
    assert body["expires_in"] == 3600
    me = anonymous.get("/api/me", headers={"Authorization": f"Bearer {body['access_token']}"}).json()
    assert (me["name"], me["initials"]) == ("Sam Lee", "SL")


@pytest.mark.parametrize(
    "details",
    [
        {"email": "priya@test.example", "password": "wrong"},
        {"email": "someone@example.com", "password": "test"},
        {"email": "", "password": ""},
    ],
)
def test_SEC17_test_sign_in_refuses_other_details_with_401(anonymous: TestClient, details: dict) -> None:
    assert anonymous.post("/api/test/sign-in", json=details).status_code == 401


def test_SEC17_without_test_mode_the_test_sign_in_doesnt_exist(real_settings: Settings) -> None:
    app: FastAPI = create_app(real_settings)
    try:
        with TestClient(app, base_url=API_BASE, headers={"Origin": APP_ORIGIN}) as client:
            response = client.post("/api/test/sign-in", json={"email": "priya@test.example", "password": "test"})
            assert response.status_code == 404
    finally:
        app.state.engine.dispose()
