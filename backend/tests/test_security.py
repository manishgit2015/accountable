"""V-S01–V-S03 and V-S06 (T1.3): the local-only trust boundary.

V-S04, V-S05, V-S07 (logs) and V-S10 are completed in T4.1, and the unknown-field 422 of V-S06
with the record endpoints in Phase 2.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.security import MAX_BODY_BYTES


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
