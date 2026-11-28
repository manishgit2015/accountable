"""Section 7.4, DEP-9, SEC-1, SEC-2, SEC-3, V-S15: the backend serving the built frontend, and running on Render.

The built frontend is a small stand-in written here, so these tests don't depend on `npm run build`.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.config as app_config
from app import main
from app.config import TEST_MODE_VAR, ConfigError, Settings, load_settings
from app.routers.sign_in_for_tests import make_test_token
from tests.conftest import API_BASE, PRIYA

INDEX = "<!doctype html><title>Accountable</title><div id=root></div>"
PUBLIC = "https://accountable.onrender.com"


@pytest.fixture
def dist(tmp_path: Path) -> Path:
    built = tmp_path / "dist"
    (built / "assets").mkdir(parents=True)
    (built / "index.html").write_text(INDEX, encoding="utf-8")
    (built / "assets" / "index-abc123.js").write_text("console.log('app')", encoding="utf-8")
    (built / "favicon.svg").write_text("<svg/>", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("not for the browser", encoding="utf-8")
    return built


@pytest.fixture
def served(settings: Settings, dist: Path, engine) -> Iterator[TestClient]:  # type: ignore[no-untyped-def]
    built = replace(settings, frontend_dist=dist)
    application = main.create_app(built)
    token = make_test_token(built, PRIYA)
    headers = {"Origin": "http://127.0.0.1:8000", "Authorization": f"Bearer {token}"}
    with TestClient(application, base_url=API_BASE, headers=headers, raise_server_exceptions=False) as client:
        yield client
    application.state.engine.dispose()


# --- The built frontend (section 7.4, DEP-9) ---


@pytest.mark.parametrize("path", ["/", "/deals", "/deals/3", "/organizations/12/anything"])
def test_spec74_every_app_address_gets_the_built_page(served: TestClient, path: str) -> None:
    response = served.get(path)
    assert response.status_code == 200
    assert response.text == INDEX
    assert response.headers["cache-control"] == "no-cache"


def test_spec74_built_files_are_sent_and_hashed_assets_kept(served: TestClient) -> None:
    asset = served.get("/assets/index-abc123.js")
    assert (asset.status_code, asset.text) == (200, "console.log('app')")
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert served.get("/favicon.svg").headers["cache-control"] == "no-cache"


def test_spec74_the_api_still_answers_and_an_unknown_api_address_is_a_json_404(served: TestClient) -> None:
    assert served.get("/api/health").json()["status"] == "ok"
    assert served.get("/api/me").json()["email"] == "priya@test.example"
    for path in ("/api/nothing-here", "/api"):
        response = served.get(path)
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize(
    ("method", "path", "status"),
    [
        ("POST", "/api/nothing-here", 404),
        ("PATCH", "/api/nothing-here/3", 404),
        ("DELETE", "/api", 404),
        ("POST", "/api/test/sign-in", 404),  # outside test mode, the test sign-in doesn't exist (SEC-17)
        ("PUT", "/api/organizations", 405),  # the route is there, the method isn't (spec 5.2)
        ("DELETE", "/api/dashboard", 405),
        ("POST", "/deals", 404),  # pages are only read
    ],
)
def test_spec52_with_the_page_served_other_methods_keep_their_404_and_405(
    served_real: TestClient, method: str, path: str, status: int
) -> None:
    response = served_real.request(method, path, json={})
    assert response.status_code == status, response.text
    assert response.json()["error"]["code"] == ("not_found" if status == 404 else "method_not_allowed")


@pytest.fixture
def served_real(dist: Path, tmp_path: Path, engine, settings: Settings) -> Iterator[TestClient]:  # type: ignore[no-untyped-def]
    """The built page served outside test mode, as `npm run start` and Render run it."""
    real = replace(
        settings, test_mode=False, test_auth_keys=None, frontend_dist=dist, supabase_url="https://abc.supabase.co"
    )
    application = main.create_app(real)
    with TestClient(application, base_url=API_BASE, headers={"Origin": "http://127.0.0.1:8000"}) as client:
        yield client
    application.state.engine.dispose()


@pytest.mark.parametrize("path", ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"])
def test_SEC6_nothing_outside_the_built_folder_can_be_read(served: TestClient, path: str) -> None:
    response = served.get(path)
    assert "not for the browser" not in response.text


def test_SEC3_the_page_npm_run_start_serves_can_change_records(served: TestClient) -> None:
    """The page comes from the API port then, so that's the app's own origin (DEP-9)."""
    assert served.post("/api/organizations", json={"name": "Acme"}).status_code == 201


def test_SEC3_without_a_built_page_the_api_port_is_no_origin_of_the_apps(client: TestClient) -> None:
    response = client.post("/api/organizations", json={"name": "Acme"}, headers={"Origin": "http://127.0.0.1:8000"})
    assert response.status_code == 403


def test_spec74_without_a_build_there_is_no_page_only_the_api(client: TestClient) -> None:
    assert client.get("/").status_code == 404
    assert client.get("/api/health").status_code == 200


# --- Render (SEC-1, SEC-2, SEC-3, DEP-2, DEP-8) ---


@pytest.fixture
def on_render(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Render's environment: RENDER and PORT set by Render, the rest entered in its settings."""
    monkeypatch.delenv(TEST_MODE_VAR, raising=False)
    monkeypatch.setattr(app_config, "ENV_FILE", tmp_path / ".env")
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("PORT", "10000")
    monkeypatch.setenv("ACCOUNTABLE_PUBLIC_URL", PUBLIC)
    monkeypatch.setenv("DATABASE_URL", "postgresql://u@aws-0-x.pooler.supabase.com:5432/postgres")
    monkeypatch.setenv("SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")


def test_SEC1_DEP2_on_render_the_service_listens_on_every_interface_on_PORT(on_render: None) -> None:
    settings = load_settings()
    assert (settings.on_render, settings.bind_host, settings.api_port) == (True, "0.0.0.0", 10000)
    assert settings.public_url == PUBLIC


def test_SEC1_off_render_it_listens_on_this_computer_only(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("PORT", "10000")  # PORT alone means nothing here
    settings = load_settings()
    assert (settings.on_render, settings.bind_host) == (False, "127.0.0.1")
    assert settings.api_port != 10000


def test_SEC17_test_mode_is_never_render(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RENDER", "true")
    assert load_settings().bind_host == "127.0.0.1"


def test_REL9_on_render_the_public_url_is_needed(on_render: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ACCOUNTABLE_PUBLIC_URL")
    with pytest.raises(ConfigError, match="ACCOUNTABLE_PUBLIC_URL is missing"):
        load_settings()


@pytest.mark.parametrize(
    "url", ["http://accountable.onrender.com", "accountable.onrender.com", f"{PUBLIC}/app", "https://"]
)
def test_DEP2_the_public_url_must_be_a_bare_https_address(
    on_render: None, monkeypatch: pytest.MonkeyPatch, url: str
) -> None:
    monkeypatch.setenv("ACCOUNTABLE_PUBLIC_URL", url)
    with pytest.raises(ConfigError, match="https address"):
        load_settings()


@pytest.fixture
def render_client(settings: Settings, engine) -> Iterator[TestClient]:  # type: ignore[no-untyped-def]
    """The app as Render runs it, reached through its HTTPS address (test sign-in still signs the tokens)."""
    hosted = replace(settings, public_url=PUBLIC)
    application: FastAPI = main.create_app(hosted)
    token = make_test_token(hosted, PRIYA)
    with TestClient(application, base_url=PUBLIC, headers={"Authorization": f"Bearer {token}"}) as client:
        yield client
    application.state.engine.dispose()


def test_SEC2_VS15_the_public_host_is_accepted_and_others_still_refused(render_client: TestClient) -> None:
    assert render_client.get("/api/health").status_code == 200
    assert render_client.get("/api/health", headers={"Host": "accountable.onrender.com:443"}).status_code == 200
    refused = render_client.get("/api/health", headers={"Host": "evil.example"})
    assert refused.status_code == 403


def test_SEC3_VS15_changes_from_the_public_address_are_accepted_and_from_others_refused(
    render_client: TestClient,
) -> None:
    ok = render_client.post("/api/organizations", json={"name": "Acme"}, headers={"Origin": PUBLIC})
    assert ok.status_code == 201
    for origin in ("https://evil.example", "http://accountable.onrender.com", f"{PUBLIC}.evil.example"):
        refused = render_client.post("/api/organizations", json={"name": "Acme"}, headers={"Origin": origin})
        assert refused.status_code == 403, origin


def test_SEC1_run_hands_uvicorn_the_settings_bind_and_port(monkeypatch: pytest.MonkeyPatch, settings: Settings) -> None:
    import uvicorn

    calls: list[dict] = []
    hosted = replace(settings, on_render=True, public_url=PUBLIC, api_port=0)
    monkeypatch.setattr(main, "load_settings", lambda: hosted)
    monkeypatch.setattr(main, "check_port_free", lambda port, host: calls.append({"checked": (host, port)}))
    monkeypatch.setattr(main, "prepare_database", lambda _s: ("0002_people", "0002_people", False))
    monkeypatch.setattr(uvicorn, "run", lambda *args, **kwargs: calls.append(kwargs))
    main.run()
    assert calls[0] == {"checked": ("0.0.0.0", 0)}
    assert (calls[1]["host"], calls[1]["port"]) == ("0.0.0.0", 0)
