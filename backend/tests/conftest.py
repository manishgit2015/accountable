"""Shared test fixtures (spec 13.2).

Every test that needs a database gets a new, migrated temporary file and a fixed clock.
The real database, backend/data/accountable.db, is never used: the run stops if
ACCOUNTABLE_DB points at it, and the fixtures refuse it too (RK-23).
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

from app.config import DEFAULT_DB_PATH, FixedClock, Settings
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


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock(FIXED_NOW)


@pytest.fixture
def settings(tmp_path: Path, clock: FixedClock) -> Settings:
    s = Settings(db_path=tmp_path / "test.db", log_dir=tmp_path / "logs", clock=clock)
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
