"""V-B14: the spec 5.2 error format and each status code (T1.2), including those the record
endpoints produce: 404 for a missing ID, 409 stale_position and 422 field rules (Phase 2).
The 403, 413 and 415 cases are in test_security.py.
"""

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.errors import AppError
from app.logging import log


def _assert_error(response, status: int, code: str) -> dict:  # type: ignore[no-untyped-def]
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    error = body["error"]
    assert error["code"] == code
    assert isinstance(error["message"], str) and error["message"]
    assert error["request_id"] == response.headers["X-Request-ID"]
    return error


def test_spec52_unknown_route_is_404_not_found(client: TestClient) -> None:
    _assert_error(client.get("/api/nope"), 404, "not_found")


def test_spec52_malformed_json_is_400_bad_request(app: FastAPI, client: TestClient) -> None:
    @app.post("/api/echo")
    def echo(payload: dict[str, str]) -> dict[str, str]:
        return payload

    response = client.post("/api/echo", content=b'{"name": ', headers={"Content-Type": "application/json"})
    _assert_error(response, 400, "bad_request")


def test_spec52_app_error_is_answered_in_the_format_with_fields(app: FastAPI, client: TestClient) -> None:
    @app.get("/api/refuse")
    def refuse() -> None:
        raise AppError(422, "validation_failed", fields={"name": "Enter a name."})

    error = _assert_error(client.get("/api/refuse"), 422, "validation_failed")
    assert error["fields"] == {"name": "Enter a name."}
    assert error["message"] == "Check the highlighted fields."


def test_REL6_locked_database_is_503_busy(app: FastAPI, client: TestClient) -> None:
    @app.get("/api/locked")
    def locked() -> None:
        raise OperationalError("UPDATE deals", {}, sqlite3.OperationalError("database is locked"))

    error = _assert_error(client.get("/api/locked"), 503, "busy")
    assert error["message"] == "Accountable is busy. Try again."


def test_SEC7_crash_is_500_without_stack_trace_and_logged_with_request_id(
    app: FastAPI, client: TestClient, settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    @app.get("/api/crash")
    def crash() -> None:
        raise RuntimeError("internal detail that must not leak")

    response = client.get("/api/crash")
    error = _assert_error(response, 500, "internal")
    assert "internal detail" not in response.text
    assert "Traceback" not in response.text
    for handler in log.handlers:
        handler.flush()
    text = (settings.log_dir / "accountable.log").read_text(encoding="utf-8")
    assert f"unexpected error id={error['request_id']}" in text
    assert "Traceback" in text and "internal detail that must not leak" in text


def test_spec52_record_endpoints_answer_400_404_409_and_422_in_the_format(client: TestClient) -> None:
    response = client.post("/api/organizations", content=b'{"name": ', headers={"Content-Type": "application/json"})
    _assert_error(response, 400, "bad_request")
    error = _assert_error(client.get("/api/deals/9"), 404, "not_found")
    assert error["message"] == "That record doesn't exist." and "fields" not in error
    error = _assert_error(client.post("/api/organizations", json={"name": ""}), 422, "validation_failed")
    assert error["fields"] == {"name": "Enter a name."}
    org = client.post("/api/organizations", json={"name": "Acme"}).json()["id"]
    jo = client.post("/api/contacts", json={"name": "Jo", "organization_id": org}).json()["id"]
    body = {
        "name": "D",
        "organization_id": org,
        "contact_id": jo,
        "stage": "new",
        "value": 1,
        "close_date": "2027-01-01",
    }
    first = client.post("/api/deals", json=body).json()["id"]
    second = client.post("/api/deals", json=body).json()["id"]
    response = client.post(f"/api/deals/{second}/move", json={"stage": "proposal", "before_id": first})
    error = _assert_error(response, 409, "stale_position")
    assert error["message"] == "The board changed. Try again."
