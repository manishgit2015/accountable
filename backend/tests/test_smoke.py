"""Smoke test: the API answers its health check (OBS-5)."""

from fastapi.testclient import TestClient


def test_OBS5_health_answers_ok_with_schema_and_version(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "schema_version": "0001_initial",
        "app_version": "0.1.0",
    }
    assert response.headers["X-Request-ID"]
