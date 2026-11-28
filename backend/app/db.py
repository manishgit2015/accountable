"""The data layer: engine, connection settings, tables and transactions (spec 6.1–6.3, ENG-4).

This and the migrations are the only modules that know the database is SQLite. Everything
else uses SQLAlchemy Core expressions. The only text SQL in the app is the PRAGMA statements
in the connection hook below (decision E-1, checked by test_db.py).
"""

from __future__ import annotations

import sqlite3
import ssl
from collections.abc import Callable, Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from alembic.runtime.migration import MigrationContext
from sqlalchemy import (
    CheckConstraint,
    Column,
    Connection,
    Engine,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    event,
)
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import DBAPIError, InterfaceError

from app.config import Settings
from app.rules import ACTIVITY_TYPES, CONTACT_STATUSES, MAX_VALUE, STAGES

BUSY_TIMEOUT_MS = 5000

# SQLite migrations copy a table and drop the old one (batch mode). With foreign keys on, that drop would
# cascade: deleting a deal's activities, or clearing links to it. So migrations run with them off, and the
# links are checked before the migration is committed (DEP-4, E-8).
FOREIGN_KEYS_OFF = ("PRAGMA foreign_keys = OFF",)
FOREIGN_KEYS_ON = ("PRAGMA foreign_keys = ON",)
FOREIGN_KEY_CHECK = ("PRAGMA foreign_key_check",)

# Postgres through Supabase's session pooler (spec 6.3, REL-6, REL-13).
POSTGRES_POOL_SIZE = 5
POSTGRES_TIMEOUT_S = 10
LOCK_TIMEOUT_MS = 5000

# Spec 6.3. Each must be set outside a transaction, so the hook runs them in autocommit mode.
CONNECTION_PRAGMAS = (
    "PRAGMA foreign_keys = ON",
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = FULL",
    f"PRAGMA busy_timeout = {BUSY_TIMEOUT_MS}",
)

metadata = MetaData(
    naming_convention={
        "ix": "ix_%(table_name)s_%(column_0_N_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
    }
)


def _timestamps() -> list[Column[Any]]:
    return [Column("created_at", String, nullable=False), Column("updated_at", String, nullable=False)]


def _people() -> list[Column[Any]]:
    """Who added and who last changed a record (R110): null for sample data (R113). Users are never deleted,
    so there's no delete rule (ADR-022)."""
    return [
        Column("created_by", String, ForeignKey("users.id"), index=True),
        Column("updated_by", String, ForeignKey("users.id"), index=True),
    ]


users = Table(
    "users",
    metadata,
    Column("id", String, primary_key=True),  # the person's Supabase user ID
    Column("email", String, nullable=False),
    Column("name", String),
    Column("last_seen_at", String, nullable=False),
)


organizations = Table(
    "organizations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String, nullable=False),
    Column("website", String),
    Column("industry", String),
    Column("notes", String),
    *_timestamps(),
    *_people(),
)

contacts = Table(
    "contacts",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="SET NULL"), index=True),
    Column("name", String, nullable=False),
    Column("email", String),
    Column("phone", String),
    Column("job_title", String),
    Column("status", String, nullable=False, server_default="lead"),
    *_timestamps(),
    *_people(),
)
contacts.append_constraint(CheckConstraint(contacts.c.status.in_(CONTACT_STATUSES), name="status"))

deals = Table(
    "deals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("organization_id", Integer, ForeignKey("organizations.id", ondelete="SET NULL"), index=True),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="SET NULL"), index=True),
    Column("name", String, nullable=False),
    Column("stage", String, nullable=False),
    Column("value", Integer, nullable=False),
    Column("probability", Integer, nullable=False),
    Column("close_date", String, nullable=False),
    Column("position", Float, nullable=False),
    Column("closed_at", String),
    *_timestamps(),
    *_people(),
    Index(None, "stage", "position"),
    Index(None, "closed_at"),
)
deals.append_constraint(CheckConstraint(deals.c.stage.in_(STAGES), name="stage"))
deals.append_constraint(CheckConstraint(deals.c.value.between(0, MAX_VALUE), name="value"))
deals.append_constraint(CheckConstraint(deals.c.probability.between(0, 100), name="probability"))

activities = Table(
    "activities",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("type", String, nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), index=True),
    Column("deal_id", Integer, ForeignKey("deals.id", ondelete="CASCADE"), index=True),
    Column("description", String, nullable=False),
    Column("occurred_at", String, nullable=False),
    Column("follow_up_date", String),
    Column("done", Integer, nullable=False, server_default="0"),
    *_timestamps(),
    *_people(),
    Index(None, "occurred_at"),
    Index(None, "follow_up_date", "done"),
)
activities.append_constraint(CheckConstraint(activities.c.type.in_(ACTIVITY_TYPES), name="type"))
activities.append_constraint(
    CheckConstraint(activities.c.contact_id.is_(None) != activities.c.deal_id.is_(None), name="one_parent")
)

stage_changes = Table(
    "stage_changes",
    metadata,
    Column("id", Integer, primary_key=True),
    # Indexed by ix_stage_changes_deal_id_changed_at below, which leads with deal_id.
    Column("deal_id", Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False),
    Column("from_stage", String),
    Column("to_stage", String, nullable=False),
    Column("changed_at", String, nullable=False),
    Index(None, "deal_id", "changed_at"),
)


def _pragmas(dbapi_connection: sqlite3.Connection, pragmas: tuple[str, ...], outside_transaction: bool = True) -> list:
    """Run SQLite PRAGMA statements, the only text SQL in the app (E-1), and return their rows.

    Most PRAGMAs must run outside a transaction, so autocommit is on while they run. Turning it on commits
    any open transaction, so callers roll back first unless they mean to keep it.
    """
    if outside_transaction:
        dbapi_connection.autocommit = True
    rows = [row for pragma in pragmas for row in dbapi_connection.execute(pragma).fetchall()]
    if outside_transaction:
        # From here on the driver opens a transaction for every statement, DDL included, so a
        # failed migration rolls back completely (REL-9) and each request is atomic (REL-2).
        dbapi_connection.autocommit = False
    return rows


def _on_connect(dbapi_connection: sqlite3.Connection, _record: object) -> None:
    """Apply spec 6.3's settings to every new connection."""
    _pragmas(dbapi_connection, CONNECTION_PRAGMAS)


def create_db_engine(db_path: Path) -> Engine:
    """An engine for the database file, creating its folder (never the file's contents) if needed."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"autocommit": False, "check_same_thread": False},
        # Error messages never carry field values into the log (SEC-8).
        hide_parameters=True,
    )
    event.listen(engine, "connect", _on_connect)
    return engine


def postgres_url(database_url: str) -> URL:
    """DATABASE_URL for the pg8000 driver. Its query (such as sslmode) is dropped: TLS is set below."""
    return make_url(database_url).set(drivername="postgresql+pg8000", query={})


def tls_context() -> ssl.SSLContext:
    """TLS that encrypts the connection without checking the server's certificate (ADR-028).

    The engineer's decision: like libpq's sslmode=require, no CA file is needed. The traffic and the
    password are encrypted, but a man in the middle wouldn't be detected (accepted risk, spec 16.2).
    """
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def create_postgres_engine(database_url: str) -> Engine:
    """An engine for Postgres on Supabase. Builds the pool but doesn't connect (V-B02)."""
    return create_engine(
        postgres_url(database_url),
        connect_args={
            "ssl_context": tls_context(),
            "timeout": POSTGRES_TIMEOUT_S,
            "startup_params": {"options": f"-c lock_timeout={LOCK_TIMEOUT_MS}"},
            "application_name": "accountable",
        },
        pool_size=POSTGRES_POOL_SIZE,
        max_overflow=0,
        pool_timeout=POSTGRES_TIMEOUT_S,
        # A connection lost while idle is replaced on the next request, rather than failing it (REL-13).
        pool_pre_ping=True,
        hide_parameters=True,
    )


def engine_for(settings: Settings) -> Engine:
    """The app's engine: Postgres when DATABASE_URL is set, otherwise the SQLite file."""
    if settings.database_url:
        return create_postgres_engine(settings.database_url)
    return create_db_engine(settings.db_path)


def describe_database(settings: Settings) -> str:
    """The database for logs and messages: the SQLite path, or the Postgres host with no user or password (OBS-4)."""
    if not settings.database_url:
        return str(settings.db_path)
    url = make_url(settings.database_url)
    return f"Postgres at {url.host}:{url.port or 5432}"


def is_unreachable(exc: BaseException) -> bool:
    """The database couldn't be reached, or the connection was lost (REL-13), as opposed to a locked row."""
    return isinstance(exc, DBAPIError) and (exc.connection_invalidated or isinstance(exc, InterfaceError))


def is_locked(exc: BaseException) -> bool:
    """A lock held past busy_timeout (SQLite) or lock_timeout (Postgres) (REL-6)."""
    if not isinstance(exc, DBAPIError):
        return False
    text = str(exc.orig).lower()
    return "locked" in text or "lock timeout" in text


def upsert_user(conn: Connection, user_id: str, email: str, name: str | None, last_seen_at: str) -> None:
    """Add a person's users row, or update it, in one statement (section 6.5, R114).

    One write, not a read then a write: two first requests from the same browser would otherwise race, and
    SQLite refuses at once to turn a read into a write after another commit (503 busy), while Postgres would
    refuse the second insert (500). INSERT ... ON CONFLICT is written differently by each dialect.
    """
    if conn.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as dialect_insert
    else:
        from sqlalchemy.dialects.sqlite import insert as dialect_insert
    values = {"email": email, "name": name, "last_seen_at": last_seen_at}
    statement = dialect_insert(users).values(id=user_id, **values)
    conn.execute(
        statement.on_conflict_do_update(
            index_elements=[users.c.id], set_={key: statement.excluded[key] for key in values}
        )
    )


@contextmanager
def transaction(engine: Engine) -> Generator[Connection]:
    """One transaction: committed if the block finishes, rolled back if it raises (REL-2)."""
    with engine.begin() as conn:
        yield conn


def schema_version(conn: Connection) -> str | None:
    """The Alembic revision the database is at, or None for a new, empty file."""
    return MigrationContext.configure(conn).get_current_revision()


ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def upgrade_to_head(
    engine: Engine, after_migrations: Callable[[Connection, str | None], None] | None = None
) -> tuple[str | None, str | None]:
    """Run every pending migration in one transaction (DEP-4). Returns the revision before and after.

    `after_migrations(conn, before)` runs in the same transaction, after the migrations and before the link
    check and the commit: the start-up loads a new database's sample data there, so the tables and the data
    are kept or undone together (review REV-003). If anything fails, the transaction rolls back and the
    database is left as it was (REL-9).
    """
    from alembic import command
    from alembic.config import Config

    config = Config(str(ALEMBIC_INI))
    with engine.connect() as conn:
        before = schema_version(conn)
        conn.rollback()
        sqlite = conn.dialect.name == "sqlite"
        raw: Any = conn.connection.dbapi_connection if sqlite else None
        if sqlite:
            _pragmas(raw, FOREIGN_KEYS_OFF)
        # Our own transaction: Alembic joins one that's open instead of committing its own, so the
        # migrations and the link check are kept or undone together.
        migration = conn.begin()
        try:
            config.attributes["connection"] = conn
            command.upgrade(config, "head")
            if after_migrations is not None:
                after_migrations(conn, before)
            if sqlite and _pragmas(raw, FOREIGN_KEY_CHECK, outside_transaction=False):
                raise MigrationError("A migration would break links between records. Nothing was changed.")
            migration.commit()
        except BaseException:
            migration.rollback()  # before foreign keys go back on, which would commit (REL-9)
            raise
        finally:
            if sqlite:
                _pragmas(raw, FOREIGN_KEYS_ON)
        after = schema_version(conn)
        conn.rollback()
    return before, after


class MigrationError(Exception):
    """A migration finished but left the data inconsistent, so it was rolled back."""
