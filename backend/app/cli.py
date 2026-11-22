"""`npm run seed` and `npm run clear` (R4, spec 5.6, REL-10).

    python -m app.cli seed [--yes]
    python -m app.cli clear [--yes]

Each asks "Type yes to continue" unless `--yes` is given, then runs in one transaction. Exit
codes: 0 when done, 1 when not confirmed, 2 on error. The database file is never deleted, and
both work while the app is running (WAL and the busy timeout let them share the file).
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Callable
from typing import TextIO

from sqlalchemy.exc import SQLAlchemyError

from app.config import ConfigError, Settings, load_settings
from app.db import create_db_engine, transaction, upgrade_to_head
from app.seed import clear_all, describe, load_sample_data

QUESTIONS = {
    "seed": "This replaces all data with the sample data. Type yes to continue: ",
    "clear": "This deletes all data. Type yes to continue: ",
}

DONE, NOT_CONFIRMED, FAILED = 0, 1, 2


def _confirmed(command: str, ask: Callable[[str], str]) -> bool:
    try:
        return ask(QUESTIONS[command]).strip().lower() == "yes"
    except EOFError:  # no terminal to answer from
        return False


def run(command: str, settings: Settings, out: TextIO, err: TextIO) -> int:
    engine = create_db_engine(settings.db_path)
    try:
        upgrade_to_head(engine)  # a new or older file gets the current schema first (DEP-4)
        with transaction(engine) as conn:
            if command == "seed":
                found = load_sample_data(conn, settings.clock.now())
                print(f"Sample data loaded: {describe(found)}.", file=out)
            else:
                found = clear_all(conn)
                print(f"All data deleted: {describe(found)} removed.", file=out)
    except SQLAlchemyError as exc:
        print(f"Couldn't {command} the database at {settings.db_path} ({type(exc).__name__}).", file=err)
        print("Nothing was changed. If Accountable is busy, try again in a moment.", file=err)
        return FAILED
    finally:
        engine.dispose()
    return DONE


def main(
    argv: list[str] | None = None,
    ask: Callable[[str], str] = input,
    out: TextIO | None = None,
    err: TextIO | None = None,
) -> int:
    out = out or sys.stdout
    err = err or sys.stderr
    parser = argparse.ArgumentParser(prog="accountable", description="Reset or empty the Accountable database.")
    parser.add_argument("command", choices=("seed", "clear"))
    parser.add_argument("--yes", action="store_true", help="skip the question")
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return FAILED
    try:
        settings = load_settings()
    except ConfigError as exc:
        print(f"Accountable can't {args.command}: {exc}", file=err)
        return FAILED
    if not args.yes and not _confirmed(args.command, ask):
        print("Nothing was changed.", file=out)
        return NOT_CONFIRMED
    return run(args.command, settings, out, err)


if __name__ == "__main__":
    sys.exit(main())
