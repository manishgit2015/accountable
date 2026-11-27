"""ADR-027, ADR-028, V-B02, V-B12, V-B18: real use connects to Postgres on Supabase from DATABASE_URL; test
mode, the tests, seed and clear only ever use a local SQLite file. No test here connects to Postgres: the
engine is built and inspected, and the connection itself is checked by hand (plan D6)."""

import io
import ssl
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, insert
from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.pool import QueuePool

import app.config as app_config
from app import cli, db, main, perfdata
from app.config import DEFAULT_DB_PATH, TEST_MODE_VAR, ConfigError, Settings, load_settings
from app.seed import NotEmptyError, counts, load_sample_data

# Made up. Built from parts so no full address with a password sits in the source.
HOST = "aws-0-eu-west-2.pooler.supabase.com"
SECRET = "pw-" + "made-up"
URL = f"postgresql://postgres.abcdefghij:{SECRET}@{HOST}:5432/postgres"


@pytest.fixture
def real_use(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    """Leave test mode, as `npm run dev` would, with a `.env` the test writes."""
    monkeypatch.delenv(TEST_MODE_VAR, raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    env_file = tmp_path / ".env"
    monkeypatch.setattr(app_config, "ENV_FILE", env_file)
    return env_file


# --- Settings (D1) ---


def test_ADR027_outside_test_mode_database_url_comes_from_env_file(real_use: Path) -> None:
    real_use.write_text(f"DATABASE_URL={URL}\n", encoding="utf-8")
    settings = load_settings()
    assert settings.database_url == URL
    assert not settings.test_mode


def test_ADR027_the_environment_wins_over_env_file(real_use: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    real_use.write_text("DATABASE_URL=postgresql://from-file/postgres\n", encoding="utf-8")
    monkeypatch.setenv("DATABASE_URL", URL)
    assert load_settings().database_url == URL


def test_ADR027_test_mode_never_reads_env_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(f"DATABASE_URL={URL}\nACCOUNTABLE_LOG_LEVEL=DEBUG\n", encoding="utf-8")
    monkeypatch.setattr(app_config, "ENV_FILE", env_file)
    monkeypatch.setenv(TEST_MODE_VAR, "key")
    settings = load_settings()
    assert settings.test_mode
    assert settings.database_url is None
    assert settings.log_level == "INFO"


def test_SEC17_test_mode_refuses_database_url_without_showing_it(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(TEST_MODE_VAR, "key")
    monkeypatch.setenv("DATABASE_URL", URL)
    with pytest.raises(ConfigError, match="both set") as raised:
        load_settings()
    assert SECRET not in str(raised.value)


def test_RK23_test_mode_refuses_the_real_sqlite_file(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(TEST_MODE_VAR, "key")
    monkeypatch.setenv("ACCOUNTABLE_DB", str(DEFAULT_DB_PATH))
    with pytest.raises(ConfigError, match="never uses"):
        load_settings()


def test_SEC9_a_database_url_that_isnt_postgres_is_refused_without_showing_it(
    real_use: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", f"mysql://user:{SECRET}@{HOST}/db")
    with pytest.raises(ConfigError, match="postgresql://") as raised:
        load_settings()
    assert SECRET not in str(raised.value)


def test_ADR027_a_real_start_needs_database_url(real_use: Path) -> None:
    settings = load_settings()
    with pytest.raises(ConfigError, match=r"DATABASE_URL is missing\. Add it to \.env"):
        settings.require_database()


def test_ADR027_test_mode_and_supabase_settings_need_no_database_url(settings: Settings) -> None:
    settings.require_database()  # test mode: the SQLite file is fine
    Settings(database_url=URL).require_database()


# --- The Postgres engine (D2), built without connecting ---


def test_VB02_the_postgres_engine_uses_pg8000_and_the_pooler_without_connecting() -> None:
    engine = db.create_postgres_engine(URL + "?sslmode=require")
    try:
        assert engine.dialect.driver == "pg8000"
        assert engine.url.host == HOST
        assert engine.url.port == 5432
        assert dict(engine.url.query) == {}  # pg8000 takes TLS from ssl_context, not sslmode
        assert engine.dialect.dbapi is not None
        assert isinstance(engine.pool, QueuePool)
        assert engine.pool.checkedout() == 0  # built, never connected
    finally:
        engine.dispose()


def test_VB02_the_postgres_engine_has_the_spec_63_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict = {}
    monkeypatch.setattr(db, "create_engine", lambda url, **kwargs: seen.update(url=url, **kwargs))
    db.create_postgres_engine(URL)
    args = seen["connect_args"]
    assert args["timeout"] == 10
    assert args["startup_params"] == {"options": "-c lock_timeout=5000"}
    assert seen["pool_size"] == 5
    assert seen["max_overflow"] == 0
    assert seen["pool_pre_ping"] is True
    assert seen["hide_parameters"] is True
    assert seen["url"].drivername == "postgresql+pg8000"


def test_ADR028_the_connection_is_tls_without_a_ca_file_or_certificate_check(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: dict = {}
    monkeypatch.setattr(db, "create_engine", lambda url, **kwargs: seen.update(kwargs))
    db.create_postgres_engine(URL)
    context = seen["connect_args"]["ssl_context"]
    assert isinstance(context, ssl.SSLContext)  # always encrypted: pg8000 uses TLS when given a context
    assert context.verify_mode == ssl.CERT_NONE
    assert context.check_hostname is False


def test_ADR027_engine_for_picks_postgres_only_with_database_url(settings: Settings) -> None:
    sqlite = db.engine_for(settings)
    postgres = db.engine_for(Settings(database_url=URL))
    try:
        assert sqlite.dialect.name == "sqlite"
        assert postgres.dialect.name == "postgresql"
        assert isinstance(postgres.pool, QueuePool)
    finally:
        sqlite.dispose()
        postgres.dispose()


def test_OBS4_SEC8_the_database_is_described_without_user_or_password(settings: Settings) -> None:
    described = db.describe_database(Settings(database_url=URL))
    assert described == f"Postgres at {HOST}:5432"
    assert SECRET not in described
    assert "postgres.abcdefghij" not in described
    assert db.describe_database(settings) == str(settings.db_path)


# --- Start-up (D3) ---


def test_REL9_a_real_start_without_database_url_stops_with_one_line(
    real_use: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(main, "prepare_database", lambda _s: pytest.fail("must not open any database"))
    with pytest.raises(SystemExit) as stopped:
        main.run()
    assert stopped.value.code == 1
    assert "DATABASE_URL is missing" in capsys.readouterr().err


def test_REL9_an_unreachable_postgres_stops_start_up_naming_only_the_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unreachable(_engine: Engine) -> None:
        raise InterfaceError("connect", {}, OSError("Can't create a connection"))

    monkeypatch.setattr(main, "upgrade_to_head", unreachable)
    with pytest.raises(main.StartupError) as raised:
        main.prepare_database(Settings(database_url=URL))
    message = str(raised.value)
    assert f"Postgres at {HOST}:5432" in message
    assert SECRET not in message
    assert "left unchanged" in message


def test_E8_a_new_database_with_records_is_never_seeded_or_cleared(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If the migrations created the schema but records are somehow there, nothing is deleted or added."""
    engine = db.create_db_engine(settings.db_path)
    db.upgrade_to_head(engine)
    stamp = "2026-11-21T14:30:00"
    with db.transaction(engine) as conn:
        conn.execute(insert(db.organizations).values(name="Real", created_at=stamp, updated_at=stamp))
    monkeypatch.setattr(main, "upgrade_to_head", lambda _engine: (None, "0001"))
    with pytest.raises(main.StartupError, match="already has records"):
        main.prepare_database(settings)
    with engine.connect() as conn:
        assert counts(conn)["organizations"] == 1
    engine.dispose()


def test_E8_sample_data_without_replace_adds_only(engine: Engine, settings: Settings) -> None:
    with db.transaction(engine) as conn:
        found = load_sample_data(conn, settings.clock.now(), replace=False)
    assert found["organizations"] == 12
    with pytest.raises(NotEmptyError), db.transaction(engine) as conn:
        load_sample_data(conn, settings.clock.now(), replace=False)


# --- Running (REL-13, REL-6 on Postgres) ---


def test_REL13_a_lost_database_is_503_database_unavailable(app: FastAPI, client: TestClient) -> None:
    @app.get("/api/unreachable")
    def unreachable() -> None:
        raise InterfaceError("SELECT 1", {}, OSError("network is unreachable"))

    response = client.get("/api/unreachable")
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "database_unavailable"
    assert error["message"] == "Accountable can't reach its database. Try again in a minute."


def test_REL13_a_connection_dropped_mid_request_is_503_database_unavailable(app: FastAPI, client: TestClient) -> None:
    @app.get("/api/dropped")
    def dropped() -> None:
        raise OperationalError("SELECT 1", {}, Exception("server closed the connection"), connection_invalidated=True)

    assert client.get("/api/dropped").json()["error"]["code"] == "database_unavailable"


def test_REL6_a_postgres_lock_timeout_is_503_busy(app: FastAPI, client: TestClient) -> None:
    @app.get("/api/lock-timeout")
    def lock_timeout() -> None:
        raise OperationalError("UPDATE deals", {}, Exception("canceling statement due to lock timeout"))

    assert client.get("/api/lock-timeout").json()["error"]["code"] == "busy"


# --- Commands (D4) ---


@pytest.mark.parametrize("command", ["seed", "clear"])
def test_R4_E6_seed_and_clear_refuse_database_url_before_asking(
    real_use: Path, monkeypatch: pytest.MonkeyPatch, command: str
) -> None:
    real_use.write_text(f"DATABASE_URL={URL}\n", encoding="utf-8")
    monkeypatch.setattr(cli, "run", lambda *_args: pytest.fail("must not touch any database"))
    out, err = io.StringIO(), io.StringIO()
    code = cli.main([command, "--yes"], ask=lambda _q: pytest.fail("must refuse before asking"), out=out, err=err)
    assert code == 2
    assert err.getvalue().strip() == (
        f"npm run {command} only works on a local database. It won't change the team's data on Supabase."
    )
    assert SECRET not in err.getvalue() + out.getvalue()


def test_ADR027_perfdata_runs_only_in_test_mode(
    real_use: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(perfdata, "create_db_engine", lambda _path: pytest.fail("must not open a database"))
    assert perfdata.main([]) == 2
    assert "only runs in test mode" in capsys.readouterr().err
