"""V-B12: `seed` and `clear`: the question, --yes, exit codes, and working beside an open
connection (R4, spec 5.6, REL-10, T2.7)."""

import io
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, inspect, select

from app import cli
from app.config import BACKEND_DIR
from app.db import create_db_engine, organizations
from app.seed import counts

LOADED = "Sample data loaded: 12 organizations, 40 contacts, 45 deals, 150 activities."


@pytest.fixture
def db_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "cli.db"
    monkeypatch.setenv("ACCOUNTABLE_DB", str(path))
    return path


def _run(*argv: str, answer: str | BaseException | None = None) -> tuple[int, str, str, list[str]]:
    asked: list[str] = []

    def ask(question: str) -> str:
        asked.append(question)
        if isinstance(answer, BaseException):
            raise answer
        assert answer is not None, "the command asked a question it shouldn't have"
        return answer

    out, err = io.StringIO(), io.StringIO()
    code = cli.main(list(argv), ask=ask, out=out, err=err)
    return code, out.getvalue(), err.getvalue(), asked


def _counts(path: Path) -> dict[str, int]:
    engine = create_db_engine(path)
    try:
        with engine.connect() as conn:
            return counts(conn)
    finally:
        engine.dispose()


def test_R4_seed_asks_and_does_nothing_unless_the_answer_is_yes(db_path: Path) -> None:
    for answer in ("no", "", "y", "yes please"):
        code, out, _, asked = _run("seed", answer=answer)
        assert (code, out) == (1, "Nothing was changed.\n")
        assert asked == ["This replaces all data with the sample data. Type yes to continue: "]
    assert not db_path.exists()


def test_R4_seed_with_yes_loads_the_sample_data_and_says_so(db_path: Path) -> None:
    code, out, err, _ = _run("seed", answer=" yes ")
    assert (code, out, err) == (0, LOADED + "\n", "")
    assert _counts(db_path) == {"organizations": 12, "contacts": 40, "deals": 45, "activities": 150}


def test_spec56_yes_flag_skips_the_question(db_path: Path) -> None:
    code, out, _, asked = _run("seed", "--yes")
    assert (code, out.strip(), asked) == (0, LOADED, [])


def test_R4_clear_asks_then_empties_every_table_and_keeps_the_schema(db_path: Path) -> None:
    _run("seed", "--yes")
    code, out, _, asked = _run("clear", answer="no")
    assert code == 1 and asked == ["This deletes all data. Type yes to continue: "]
    assert _counts(db_path)["deals"] == 45
    code, out, _, _ = _run("clear", answer="yes")
    assert (code, out.strip()) == (
        0,
        "All data deleted: 12 organizations, 40 contacts, 45 deals, 150 activities removed.",
    )
    assert _counts(db_path) == {"organizations": 0, "contacts": 0, "deals": 0, "activities": 0}
    engine = create_db_engine(db_path)
    assert "alembic_version" in inspect(engine).get_table_names()
    engine.dispose()
    assert _run("clear", "--yes")[0] == 0  # clearing an empty database is fine


def test_spec56_no_terminal_to_answer_from_counts_as_no(db_path: Path) -> None:
    assert _run("seed", answer=EOFError())[0] == 1


def test_spec56_bad_arguments_and_errors_exit_2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    assert _run("reset", "--yes")[0] == 2
    folder = tmp_path / "a-folder.db"
    folder.mkdir()
    monkeypatch.setenv("ACCOUNTABLE_DB", str(folder))
    code, out, err, _ = _run("seed", "--yes")
    assert code == 2 and out == ""
    assert "Couldn't seed the database" in err and "Nothing was changed" in err
    monkeypatch.setenv("ACCOUNTABLE_LOG_LEVEL", "LOUD")
    assert _run("clear", "--yes")[0] == 2


def test_REL10_seed_and_clear_work_while_the_app_has_the_database_open(
    monkeypatch: pytest.MonkeyPatch, client: TestClient, engine: Engine, settings
) -> None:  # type: ignore[no-untyped-def]
    # Point the commands at the app's own (test) database, with a reader holding it open.
    monkeypatch.setenv("ACCOUNTABLE_DB", str(settings.db_path))
    client.post("/api/organizations", json={"name": "Typed by hand"})
    with engine.connect() as reader:
        reader.begin()
        assert reader.execute(select(organizations.c.name)).scalars().all() == ["Typed by hand"]
        assert _run("seed", "--yes")[0] == 0
    names = [o["name"] for o in client.get("/api/organizations").json()]
    assert len(names) == 12 and "Typed by hand" not in names  # the running app sees it on its next read
    assert _run("clear", "--yes")[0] == 0
    assert client.get("/api/deals").json() == []


def _real_command(db_path: Path, *args: str, answer: str | None = None) -> subprocess.CompletedProcess[str]:
    """`python -m app.cli`, as `npm run seed` and `npm run clear` run it. One process per test keeps each under
    NFR-15's 1 second."""
    env = {**os.environ, "ACCOUNTABLE_DB": str(db_path)}
    command = [sys.executable, "-m", "app.cli", *args]
    return subprocess.run(command, cwd=BACKEND_DIR, env=env, input=answer, capture_output=True, text=True)


def test_spec56_the_real_seed_command_exits_0_and_says_what_it_loaded(db_path: Path) -> None:
    done = _real_command(db_path, "seed", "--yes")
    assert done.returncode == 0, done.stderr
    assert done.stdout.strip() == LOADED
    assert _counts(db_path)["deals"] == 45


def test_spec56_the_real_clear_command_exits_1_without_yes_and_changes_nothing(db_path: Path) -> None:
    refused = _real_command(db_path, "clear", answer="nope\n")
    assert refused.returncode == 1
    assert "Type yes to continue" in refused.stdout and "Nothing was changed." in refused.stdout
