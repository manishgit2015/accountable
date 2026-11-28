"""Alembic environment: SQLite batch mode (ignored on Postgres), target metadata from app.db (ADR-004).

The connection always comes from app.db.upgrade_to_head, in config.attributes["connection"], so migrations
get the same settings (spec 6.3), run in one transaction (a failed migration changes nothing, REL-9), and on
SQLite run with foreign keys off and the links checked before commit.
"""

from alembic import context
from sqlalchemy import Connection

from app.db import metadata

config = context.config


def _run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    given = config.attributes.get("connection")
    if given is None:
        # app.db.upgrade_to_head runs them, with SQLite's foreign keys off so a table copy can't delete
        # rows, and checks the links before committing (DEP-4, E-8). A bare `alembic upgrade` would skip that.
        raise SystemExit("Run Accountable's migrations through the app: npm run dev or npm run start.")
    _run(given)


if context.is_offline_mode():
    raise SystemExit("Accountable's migrations run online only, against the database.")
run_migrations_online()
