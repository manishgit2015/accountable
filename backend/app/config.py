"""Configuration (DEP-2) and the one injectable clock (R16, R77, ADR-013).

Settings come from the environment, and outside test mode also from the git-ignored `.env`, where a
variable already in the environment wins. The one secret is the password inside `DATABASE_URL`
(SEC-9), which is never logged. Test mode is `ACCOUNTABLE_TEST_AUTH_KEYS` being set, which only the
test runs do (SEC-17): it never reads `.env`, refuses `DATABASE_URL`, and refuses the default SQLite
file, so no test can reach Supabase or the real data (ADR-027). Every "now" and "today" in the app
goes through a Clock, so tests can fix time.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Protocol

from dotenv import dotenv_values

APP_VERSION = "0.1.0"

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "accountable.db"
DEFAULT_LOG_DIR = BACKEND_DIR / "logs"
# The git-ignored settings file at the repository's root (DEP-2). Read at call time, so tests can move it.
ENV_FILE = BACKEND_DIR.parent / ".env"
TEST_MODE_VAR = "ACCOUNTABLE_TEST_AUTH_KEYS"
POSTGRES_SCHEMES = ("postgresql://", "postgres://")

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


def _port(env: dict[str, str], name: str, default: int) -> int:
    raw = env.get(name, "").strip()
    if not raw:
        return default
    if not raw.isdigit() or not 1 <= int(raw) <= 65535:
        raise ConfigError(f"{name} must be a port number from 1 to 65535, not {raw!r}.")
    return int(raw)


def _flag(env: dict[str, str], name: str) -> bool:
    return env.get(name, "").strip().lower() in ("1", "true", "yes")


@dataclass
class Settings:
    db_path: Path = DEFAULT_DB_PATH
    api_port: int = DEFAULT_API_PORT
    web_port: int = DEFAULT_WEB_PORT
    log_level: str = "INFO"
    log_dir: Path = DEFAULT_LOG_DIR
    reload: bool = False
    clock: Clock = field(default_factory=SystemClock)
    # Postgres on Supabase (DATABASE_URL). None means the SQLite file at db_path: tests, seed and clear only.
    database_url: str | None = None
    test_mode: bool = False

    def require_database(self) -> None:
        """A start for real use needs Supabase: there's no fallback to the SQLite file (ADR-027)."""
        if not self.test_mode and not self.database_url:
            raise ConfigError("DATABASE_URL is missing. Add it to .env, or to Render's settings.")

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


def _fixed_now(env: dict[str, str]) -> datetime | None:
    """ACCOUNTABLE_FIXED_NOW: tests only. The end-to-end run sets it (scripts/run-tests.mjs) so the backend's
    "now" is the browser's fixed clock in e2e/fixtures.ts (engineer's decision, Phase 4). `npm run dev` never
    sets it, so the app uses the computer's clock."""
    raw = env.get("ACCOUNTABLE_FIXED_NOW", "").strip()
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


def _environment(env_file: Path | None) -> tuple[dict[str, str], bool]:
    """The process environment, over `.env` unless in test mode, and whether this is test mode."""
    test_mode = bool(os.environ.get(TEST_MODE_VAR, "").strip())
    env = dict(os.environ)
    if not test_mode:
        path = env_file or ENV_FILE
        from_file = {k: v for k, v in dotenv_values(path).items() if v is not None} if path.is_file() else {}
        env = {**from_file, **env}
    return env, test_mode


def _database_url(env: dict[str, str], test_mode: bool) -> str | None:
    url = env.get("DATABASE_URL", "").strip() or None
    if url is None:
        return None
    if test_mode:
        raise ConfigError(
            f"{TEST_MODE_VAR} (test mode) and DATABASE_URL are both set. "
            "Tests only use a temporary local SQLite file, never Supabase: unset DATABASE_URL."
        )
    if not url.startswith(POSTGRES_SCHEMES):
        # Never echo the value: it holds the database password (SEC-9).
        raise ConfigError("DATABASE_URL must be a Postgres address starting with postgresql://.")
    return url


def _db_path(env: dict[str, str], test_mode: bool) -> Path:
    raw = env.get("ACCOUNTABLE_DB", "").strip()
    path = Path(raw).resolve() if raw else DEFAULT_DB_PATH
    if test_mode and path == DEFAULT_DB_PATH.resolve():
        raise ConfigError(f"Test mode never uses {DEFAULT_DB_PATH}: set ACCOUNTABLE_DB to a temporary file.")
    return path


def load_settings(env_file: Path | None = None) -> Settings:
    """Read DEP-2's settings from the environment and, outside test mode, `.env` (E-2, ADR-027)."""
    env, test_mode = _environment(env_file)
    fixed = _fixed_now(env)
    level = env.get("ACCOUNTABLE_LOG_LEVEL", "").strip().upper() or "INFO"
    if level not in ("DEBUG", "INFO", "WARNING", "ERROR"):
        raise ConfigError(f"ACCOUNTABLE_LOG_LEVEL must be DEBUG, INFO, WARNING or ERROR, not {level!r}.")
    return Settings(
        db_path=_db_path(env, test_mode),
        api_port=_port(env, "ACCOUNTABLE_API_PORT", DEFAULT_API_PORT),
        web_port=_port(env, "ACCOUNTABLE_WEB_PORT", DEFAULT_WEB_PORT),
        log_level=level,
        reload=_flag(env, "ACCOUNTABLE_RELOAD"),
        clock=FixedClock(fixed) if fixed else SystemClock(),
        database_url=_database_url(env, test_mode),
        test_mode=test_mode,
    )
