"""Alembic environment: SQLite batch mode, target metadata from app.db (ADR-004).

The connection comes from app.db.create_db_engine, so migrations get the same settings
(spec 6.3) and run in one transaction: a failed migration changes nothing (REL-9).
A caller may pass its own connection in config.attributes["connection"].
"""

from alembic import context
from sqlalchemy import Connection

from app.config import load_settings
from app.db import create_db_engine, metadata

config = context.config


def _run(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    given = config.attributes.get("connection")
    if given is not None:
        _run(given)
        return
    engine = create_db_engine(load_settings().db_path)
    try:
        with engine.connect() as connection:
            _run(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Accountable's migrations run online only, against the database file.")
run_migrations_online()
