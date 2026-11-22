"""Configuration (DEP-2) and the one injectable clock (R16, R77, ADR-013).

Every setting is optional and has a default. There are no secrets. Every "now" and "today"
in the app goes through a Clock, so tests can fix time.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Protocol

APP_VERSION = "0.1.0"

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "accountable.db"
DEFAULT_LOG_DIR = BACKEND_DIR / "logs"

DEFAULT_API_PORT = 8000
DEFAULT_WEB_PORT = 5173
# The test environment's ports (DEP-1). They're always allowed by the Host and Origin
# checks (plan T1.3), and like the defaults they're only reachable on this computer.
TEST_API_PORT = 8001
TEST_WEB_PORT = 5174

LOCAL_HOSTNAMES = ("127.0.0.1", "localhost")


class Clock(Protocol):
    """Local time with no time zone (ADR-013)."""

    def now(self) -> datetime: ...

    def today(self) -> date: ...


class SystemClock:
    """The computer's local clock, to the second."""

    def now(self) -> datetime:
        return datetime.now().replace(microsecond=0)

    def today(self) -> date:
        return self.now().date()


@dataclass
class FixedClock:
    """A clock that always says the same time. Used by tests."""

    at: datetime

    def now(self) -> datetime:
        return self.at

    def today(self) -> date:
        return self.at.date()


class ConfigError(ValueError):
    """A setting has a value the app can't use."""


def _port(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    if not raw.isdigit() or not 1 <= int(raw) <= 65535:
        raise ConfigError(f"{name} must be a port number from 1 to 65535, not {raw!r}.")
    return int(raw)


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes")


@dataclass
class Settings:
    db_path: Path = DEFAULT_DB_PATH
    api_port: int = DEFAULT_API_PORT
    web_port: int = DEFAULT_WEB_PORT
    log_level: str = "INFO"
    log_dir: Path = DEFAULT_LOG_DIR
    reload: bool = False
    clock: Clock = field(default_factory=SystemClock)

    @property
    def allowed_ports(self) -> tuple[int, ...]:
        return tuple(dict.fromkeys((self.api_port, self.web_port, TEST_API_PORT, TEST_WEB_PORT)))

    @property
    def allowed_hosts(self) -> frozenset[str]:
        """Host header values accepted by the API (SEC-2)."""
        return frozenset(f"{name}:{port}" for name in LOCAL_HOSTNAMES for port in self.allowed_ports)

    @property
    def allowed_origins(self) -> frozenset[str]:
        """Origin header values accepted on changing requests (SEC-3)."""
        web_ports = dict.fromkeys((self.web_port, TEST_WEB_PORT))
        return frozenset(f"http://{name}:{port}" for name in LOCAL_HOSTNAMES for port in web_ports)

    @property
    def web_address(self) -> str:
        return f"http://127.0.0.1:{self.web_port}"


def _fixed_now() -> datetime | None:
    """ACCOUNTABLE_FIXED_NOW: tests only. The end-to-end run sets it (scripts/run-tests.mjs) so the backend's
    "now" is the browser's fixed clock in e2e/fixtures.ts (engineer's decision, Phase 4). `npm run dev` never
    sets it, so the app uses the computer's clock."""
    raw = os.environ.get("ACCOUNTABLE_FIXED_NOW", "").strip()
    if not raw:
        return None
    try:
        moment = datetime.fromisoformat(raw)
    except ValueError as exc:
        raise ConfigError(
            f"ACCOUNTABLE_FIXED_NOW must be a local date and time like 2026-11-21T14:30, not {raw!r}."
        ) from exc
    if moment.tzinfo is not None:
        raise ConfigError("ACCOUNTABLE_FIXED_NOW is local time with no time zone (ADR-013).")
    return moment.replace(microsecond=0)


def load_settings() -> Settings:
    """Read the ACCOUNTABLE_* environment variables (DEP-2, E-2, and the test-only ACCOUNTABLE_FIXED_NOW)."""
    raw_db = os.environ.get("ACCOUNTABLE_DB", "").strip()
    fixed = _fixed_now()
    level = os.environ.get("ACCOUNTABLE_LOG_LEVEL", "").strip().upper() or "INFO"
    if level not in ("DEBUG", "INFO", "WARNING", "ERROR"):
        raise ConfigError(f"ACCOUNTABLE_LOG_LEVEL must be DEBUG, INFO, WARNING or ERROR, not {level!r}.")
    return Settings(
        db_path=Path(raw_db).resolve() if raw_db else DEFAULT_DB_PATH,
        api_port=_port("ACCOUNTABLE_API_PORT", DEFAULT_API_PORT),
        web_port=_port("ACCOUNTABLE_WEB_PORT", DEFAULT_WEB_PORT),
        log_level=level,
        reload=_flag("ACCOUNTABLE_RELOAD"),
        clock=FixedClock(fixed) if fixed else SystemClock(),
    )
