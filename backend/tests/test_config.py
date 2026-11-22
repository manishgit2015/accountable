"""DEP-2 and the test-only ACCOUNTABLE_FIXED_NOW (engineer's decision, Phase 4): the e2e backend's clock can be
fixed to match the browser's; without it the app uses the computer's clock."""

from datetime import datetime

import pytest

from app.config import ConfigError, FixedClock, SystemClock, load_settings


def test_RK14_without_fixed_now_the_app_uses_the_computers_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ACCOUNTABLE_FIXED_NOW", raising=False)
    assert isinstance(load_settings().clock, SystemClock)


def test_RK14_fixed_now_fixes_now_and_today(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ACCOUNTABLE_FIXED_NOW", "2026-11-21T14:30:00")
    clock = load_settings().clock
    assert isinstance(clock, FixedClock)
    assert clock.now() == datetime(2026, 11, 21, 14, 30)
    assert clock.today().isoformat() == "2026-11-21"


@pytest.mark.parametrize("raw", ["tomorrow", "2026-13-01T10:00", "2026-11-21T14:30:00+05:30"])
def test_RK14_a_bad_fixed_now_stops_with_a_clear_message(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("ACCOUNTABLE_FIXED_NOW", raw)
    with pytest.raises(ConfigError, match="ACCOUNTABLE_FIXED_NOW"):
        load_settings()
