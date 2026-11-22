"""OBS-1 to OBS-4, SEC-8: request IDs, one log line per request, path templates, no bodies or values."""

import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.logging import LOG_BACKUPS, LOG_MAX_BYTES, log


def _log_text(settings: Settings) -> str:
    for handler in log.handlers:
        handler.flush()
    return (Path(settings.log_dir) / "accountable.log").read_text(encoding="utf-8")


def test_OBS3_every_response_has_a_unique_request_id(client: TestClient) -> None:
    ids = {client.get("/api/health").headers["X-Request-ID"] for _ in range(3)}
    assert len(ids) == 3
    assert all(re.fullmatch(r"[0-9a-f]{32}", i) for i in ids)


def test_OBS3_error_responses_carry_the_request_id_in_header_and_body(client: TestClient) -> None:
    response = client.get("/api/nothing-here")
    assert response.status_code == 404
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]


def test_OBS1_one_line_per_request_with_id_method_template_status_and_duration(
    client: TestClient, settings: Settings
) -> None:
    request_id = client.get("/api/health").headers["X-Request-ID"]
    lines = [line for line in _log_text(settings).splitlines() if request_id in line]
    assert len(lines) == 1
    assert re.search(
        rf"^\d{{4}}-\d\d-\d\d \d\d:\d\d:\d\d INFO request id={request_id} method=GET path=/api/health status=200 "
        r"duration_ms=\d+$",
        lines[0],
    )


def test_SEC8_paths_are_logged_as_templates_and_never_with_values(
    app: FastAPI, client: TestClient, settings: Settings
) -> None:
    @app.post("/api/echo/{item_id}")
    def echo(item_id: int, payload: dict[str, str]) -> dict[str, int]:
        return {"id": item_id}

    secret_name = "Jo Bloggs-Unique"
    secret_email = "jo.unique@example.com"
    response = client.post("/api/echo/4242?q=private-query", json={"name": secret_name, "email": secret_email})
    assert response.status_code == 200
    text = _log_text(settings)
    assert "path=/api/echo/{item_id} status=200" in text
    for value in ("4242", "private-query", secret_name, secret_email):
        assert value not in text


def test_SEC8_refused_requests_log_the_template_not_the_raw_path(client: TestClient, settings: Settings) -> None:
    client.get("/api/health", headers={"Host": "evil.example"})
    client.get("/api/organisations/secret-name-in-path")
    text = _log_text(settings)
    assert "path=/api/health status=403" in text
    assert "secret-name-in-path" not in text
    assert "path=<unmatched> status=404" in text


def test_OBS2_log_file_rotates_at_5_mb_keeping_3(client: TestClient, settings: Settings) -> None:
    client.get("/api/health")
    assert (LOG_MAX_BYTES, LOG_BACKUPS) == (5 * 1024 * 1024, 3)
    assert (Path(settings.log_dir) / "accountable.log").exists()


def test_SEC8_VS07_record_endpoints_never_log_bodies_ids_or_values(client: TestClient, settings: Settings) -> None:
    """A full round on real endpoints: create, read, edit, search-style list, delete. Only templates reach the log."""
    values = ("Zanzibar Unique Org", "zara.unique@example.com", "+44 7700 900123", "Secret note text 98765")
    org = client.post("/api/organizations", json={"name": values[0], "notes": values[3]}).json()
    contact = client.post(
        "/api/contacts",
        json={"name": "Zara Unique", "organization_id": org["id"], "email": values[1], "phone": values[2]},
    ).json()
    client.patch(f"/api/contacts/{contact['id']}", json={"job_title": "Head of Secrets"})
    client.get(f"/api/organizations/{org['id']}/timeline")
    client.post("/api/contacts", json={"name": "", "organization_id": org["id"], "email": "not-an-email-unique"})
    client.delete(f"/api/contacts/{contact['id']}")
    text = _log_text(settings)
    for value in (*values, "Zara Unique", "Head of Secrets", "not-an-email-unique"):
        assert value not in text
    assert "method=POST path=/api/organizations status=201" in text
    assert "method=PATCH path=/api/contacts/{contact_id} status=200" in text
    assert "method=POST path=/api/contacts status=422" in text
    assert "method=DELETE path=/api/contacts/{contact_id} status=204" in text
    assert "path=/api/organizations/{organization_id}/timeline status=200" in text
