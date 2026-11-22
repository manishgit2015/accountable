"""V-S01–V-S07 and V-S10: the local-only trust boundary and the negative cases of spec section 10.

V-S01–V-S03 and V-S06 date from T1.3. T4.1 completes V-S04 (script text), V-S05 (SQL text), the
unknown-field 422 of V-S06 on the record endpoints, V-S07 (crash and logs, with test_logging.py and
test_errors.py) and the backend half of V-S10 (the API binds to 127.0.0.1 only; e2e/security.spec.ts
inspects the running servers' sockets, per E-4).
"""

import socket

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, inspect, select

from app import main
from app.config import Settings
from app.db import metadata
from app.security import MAX_BODY_BYTES

SCRIPT = "<script>alert(1)</script>"
IMG = '<img src=x onerror="alert(1)">'
SQL = "'; DROP TABLE deals; --"


@pytest.fixture
def echo(app: FastAPI) -> list[dict[str, object]]:
    """A changing endpoint that records what reached it, to prove refused requests change nothing."""
    seen: list[dict[str, object]] = []

    @app.post("/api/echo")
    def post(payload: dict[str, object]) -> dict[str, object]:
        seen.append(payload)
        return payload

    @app.patch("/api/echo")
    def patch(payload: dict[str, object]) -> dict[str, object]:
        seen.append(payload)
        return payload

    @app.delete("/api/echo")
    def delete() -> None:
        seen.append({"deleted": True})

    return seen


@pytest.mark.parametrize(
    "host", ["127.0.0.1:8000", "localhost:8000", "127.0.0.1:5173", "localhost:5173", "127.0.0.1:8001", "127.0.0.1:5174"]
)
def test_SEC2_local_hosts_on_api_web_and_test_ports_are_accepted(client: TestClient, host: str) -> None:
    assert client.get("/api/health", headers={"Host": host}).status_code == 200


@pytest.mark.parametrize(
    "host", ["evil.example", "evil.example:8000", "127.0.0.1", "127.0.0.1:9999", "192.168.1.20:8000", "[::1]:8000", ""]
)
def test_SEC2_VS01_foreign_host_is_403(client: TestClient, host: str) -> None:
    response = client.get("/api/health", headers={"Host": host})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden_origin"


@pytest.mark.parametrize("origin", ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174"])
def test_SEC3_the_apps_own_origin_may_change_data(client: TestClient, echo: list, origin: str) -> None:
    assert client.post("/api/echo", json={"a": 1}, headers={"Origin": origin}).status_code == 200
    assert echo == [{"a": 1}]


@pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "origin", ["https://evil.example", "http://127.0.0.1:8000", "http://127.0.0.1:9999", "null", None]
)
def test_SEC3_VS02_foreign_or_missing_origin_on_changes_is_403_and_changes_nothing(
    client: TestClient, echo: list, method: str, origin: str | None
) -> None:
    headers = {"Content-Type": "application/json"}
    request = client.build_request(method, "/api/echo", content=b'{"a": 1}', headers=headers)
    if origin is None:
        del request.headers["Origin"]
    else:
        request.headers["Origin"] = origin
    response = client.send(request)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden_origin"
    assert echo == []


def test_SEC3_reads_do_not_need_an_origin(client: TestClient) -> None:
    request = client.build_request("GET", "/api/health")
    del request.headers["Origin"]
    assert client.send(request).status_code == 200


def test_SEC3_VS03_no_cors_headers_even_when_asked(client: TestClient, echo: list) -> None:
    responses = [
        client.get("/api/health", headers={"Origin": "https://evil.example"}),
        client.post("/api/echo", json={"a": 1}),
        client.options(
            "/api/echo",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        ),
    ]
    for response in responses:
        assert not [h for h in response.headers if h.lower().startswith("access-control-")]


def test_SEC7_VS06_body_over_1_mb_is_413(client: TestClient, echo: list) -> None:
    big = b'{"a": "' + b"x" * (2 * 1024 * 1024) + b'"}'
    response = client.post("/api/echo", content=big, headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "too_large"
    assert echo == []


def test_SEC7_body_just_under_the_limit_is_accepted(client: TestClient, echo: list) -> None:
    body = b'{"a": "' + b"x" * (MAX_BODY_BYTES - 20) + b'"}'
    assert len(body) <= MAX_BODY_BYTES
    response = client.post("/api/echo", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 200


def test_SEC7_streamed_body_over_1_mb_is_413(client: TestClient, echo: list) -> None:
    def chunks():  # type: ignore[no-untyped-def]
        yield b'{"a": "'
        for _ in range(3):
            yield b"x" * (512 * 1024)
        yield b'"}'

    response = client.post("/api/echo", content=chunks(), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert echo == []


@pytest.mark.parametrize(
    "content_type", ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", None]
)
def test_SEC7_VS06_non_json_body_is_415(client: TestClient, echo: list, content_type: str | None) -> None:
    request = client.build_request("POST", "/api/echo", content=b'{"a": 1}')
    if content_type is None:
        request.headers.pop("Content-Type", None)
    else:
        request.headers["Content-Type"] = content_type
    response = client.send(request)
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media_type"
    assert echo == []


def test_SEC7_json_with_charset_is_accepted(client: TestClient, echo: list) -> None:
    response = client.post(
        "/api/echo", content=b'{"a": 1}', headers={"Content-Type": "application/json; charset=utf-8"}
    )
    assert response.status_code == 200


def _records(client: TestClient, text: str) -> dict[str, dict]:
    """One of each record type, with `text` in every free-text field."""
    org = client.post(
        "/api/organizations", json={"name": text, "industry": text, "notes": text, "website": "https://a.example"}
    )
    assert org.status_code == 201, org.text
    org_id = org.json()["id"]
    contact = client.post("/api/contacts", json={"name": text, "organization_id": org_id, "job_title": text})
    assert contact.status_code == 201, contact.text
    deal = client.post(
        "/api/deals",
        json={
            "name": text,
            "organization_id": org_id,
            "contact_id": contact.json()["id"],
            "stage": "new",
            "value": 1000,
            "close_date": "2026-12-31",
        },
    )
    assert deal.status_code == 201, deal.text
    activity = client.post("/api/activities", json={"type": "note", "description": text, "deal_id": deal.json()["id"]})
    assert activity.status_code == 201, activity.text
    return {
        "organizations": org.json(),
        "contacts": contact.json(),
        "deals": deal.json(),
        "activities": activity.json(),
    }


def _fetch(client: TestClient, kind: str, record_id: int) -> dict:
    """Read a record back. Activities have no single-record endpoint, so they come from the list."""
    if kind == "activities":
        response = client.get("/api/activities")
        assert response.status_code == 200
        return next(a for a in response.json() if a["id"] == record_id)
    response = client.get(f"/api/{kind}/{record_id}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    return response.json()


@pytest.mark.parametrize("text", [SCRIPT, IMG])
def test_SEC6_VS04_script_text_is_stored_and_returned_as_plain_text(client: TestClient, text: str) -> None:
    created = _records(client, text)
    for kind, record in created.items():
        body = _fetch(client, kind, record["id"])
        field = "description" if kind == "activities" else "name"
        assert body[field] == text, kind  # unchanged: no escaping, stripping or execution on the server
    org = client.get(f"/api/organizations/{created['organizations']['id']}").json()
    assert (org["industry"], org["notes"]) == (text, text)
    listed = [o["name"] for o in client.get("/api/organizations").json()]
    assert text in listed


def test_SEC5_VS05_sql_text_is_stored_as_text_and_the_tables_are_intact(client: TestClient, engine: Engine) -> None:
    tables_before = set(inspect(engine).get_table_names())
    created = _records(client, SQL)
    assert set(inspect(engine).get_table_names()) == tables_before
    assert {"organizations", "contacts", "deals", "activities", "stage_changes"} <= tables_before
    for kind, record in created.items():
        field = "description" if kind == "activities" else "name"
        assert _fetch(client, kind, record["id"])[field] == SQL
    # Searching-by-name style lookups and the dashboard still work on the same database.
    assert client.get("/api/deals").status_code == 200
    assert client.get("/api/dashboard").status_code == 200
    with engine.connect() as conn:
        deals = metadata.tables["deals"]
        assert conn.execute(select(func.count()).select_from(deals).where(deals.c.name == SQL)).scalar_one() == 1


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/api/organizations", {"name": "Acme", "is_admin": True}),
        ("/api/contacts", {"name": "Jo", "organization_id": 1, "is_admin": True}),
        ("/api/activities", {"type": "note", "description": "x", "contact_id": 1, "is_admin": True}),
    ],
)
def test_SEC7_VS06_unknown_field_is_422_and_saves_nothing(client: TestClient, path: str, body: dict) -> None:
    before = len(client.get(path).json())
    response = client.post(path, json=body)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert error["fields"]["is_admin"] == "This field isn't allowed."
    assert len(client.get(path).json()) == before


def test_SEC6_VS09_javascript_website_is_422_with_a_field_message(client: TestClient) -> None:
    response = client.post("/api/organizations", json={"name": "Acme", "website": "javascript:alert(1)"})
    assert response.status_code == 422
    assert "website" in response.json()["error"]["fields"]
    assert client.get("/api/organizations").json() == []


def test_SEC1_VS10_the_api_is_served_on_127_0_0_1_only(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> None:
    """The real start-up path hands uvicorn 127.0.0.1, never 0.0.0.0 or a LAN address (E-4)."""
    import uvicorn

    calls: list[dict] = []
    free_port = _free_port()
    settings.api_port = free_port
    monkeypatch.setattr(main, "load_settings", lambda: settings)
    monkeypatch.setattr(uvicorn, "run", lambda *args, **kwargs: calls.append(kwargs))
    main.run()
    assert len(calls) == 1
    assert calls[0]["host"] == "127.0.0.1"
    assert calls[0]["port"] == free_port
    assert main.HOST == "127.0.0.1"


def test_SEC1_VS10_the_port_check_binds_loopback_only(monkeypatch: pytest.MonkeyPatch) -> None:
    bound: list[tuple] = []
    real_bind = socket.socket.bind

    def spy(self: socket.socket, address: tuple) -> None:
        bound.append(address)
        real_bind(self, address)

    monkeypatch.setattr(socket.socket, "bind", spy)
    main.check_port_free(_free_port())
    assert bound and all(address[0] == "127.0.0.1" for address in bound)


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]
