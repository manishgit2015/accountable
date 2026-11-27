"""Shared test fixtures (spec 13.2).

Every test that needs a database gets a new, migrated temporary file and a fixed clock.
The real database, backend/data/accountable.db, is never used: the run stops if
ACCOUNTABLE_DB points at it, and the fixtures refuse it too (RK-23). Supabase is never used
either (ADR-027): the run stops if DATABASE_URL is set, runs in test mode even when started
with `uv run pytest` directly, and every test reads a missing `.env` in place of the real one.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine

import app.config as app_config
from app.config import DEFAULT_DB_PATH, TEST_MODE_VAR, FixedClock, Settings
from app.db import create_db_engine, upgrade_to_head
from app.main import create_app

# Saturday 21 November 2026, 14:30 local time.
FIXED_NOW = datetime(2026, 11, 21, 14, 30, 0)
API_BASE = "http://127.0.0.1:8000"
APP_ORIGIN = "http://127.0.0.1:5173"


def _is_default_db(path: Path) -> bool:
    return path.resolve() == DEFAULT_DB_PATH.resolve()


def pytest_configure(config: pytest.Config) -> None:
    raw = os.environ.get("ACCOUNTABLE_DB", "").strip()
    if raw and _is_default_db(Path(raw)):
        raise pytest.UsageError(
            f"ACCOUNTABLE_DB points at the real database ({DEFAULT_DB_PATH}). Tests must use a temporary file."
        )
    if os.environ.get("DATABASE_URL", "").strip():
        raise pytest.UsageError("DATABASE_URL is set. The tests never use Supabase: unset it and run them again.")
    # `uv run pytest` without npm test: still test mode, so nothing reads .env or reaches Supabase.
    os.environ.setdefault(TEST_MODE_VAR, "pytest")


@pytest.fixture(autouse=True)
def _no_real_env_file(tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> None:
    """Every test reads a `.env` that doesn't exist, even one that leaves test mode."""
    monkeypatch.setattr(app_config, "ENV_FILE", tmp_path_factory.mktemp("env") / ".env")
    if not os.environ.get("ACCOUNTABLE_DB", "").strip():
        monkeypatch.setenv("ACCOUNTABLE_DB", str(tmp_path_factory.mktemp("db") / "test.db"))


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(FIXED_NOW)


@pytest.fixture
def settings(tmp_path: Path, clock: FixedClock) -> Settings:
    s = Settings(db_path=tmp_path / "test.db", log_dir=tmp_path / "logs", clock=clock, test_mode=True)
    assert not _is_default_db(s.db_path), "tests must never use the real database"
    return s


@pytest.fixture
def engine(settings: Settings) -> Iterator[Engine]:
    eng = create_db_engine(settings.db_path)
    upgrade_to_head(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def app(settings: Settings, engine: Engine) -> Iterator[FastAPI]:
    application = create_app(settings)
    yield application
    application.state.engine.dispose()


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    """A client that looks like the browser behind the Vite proxy: local Host and the app's Origin."""
    with TestClient(app, base_url=API_BASE, headers={"Origin": APP_ORIGIN}, raise_server_exceptions=False) as c:
        yield c
