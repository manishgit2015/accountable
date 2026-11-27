"""The FastAPI app factory and the backend's start-up (OBS-4, REL-9, DEP-4).

`python -m app.main` (run by `npm run dev`) checks the port, migrates the database, logs the
start-up lines and serves on 127.0.0.1 only (SEC-1). Any start-up failure prints one clear
line and exits with a non-zero code.
"""

from __future__ import annotations

import errno
import socket
import sys

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError

from app.config import APP_VERSION, BACKEND_DIR, ConfigError, FixedClock, Settings, load_settings
from app.db import describe_database, engine_for, transaction, upgrade_to_head
from app.errors import UnexpectedErrorMiddleware, error_response, register_error_handlers
from app.logging import RequestContextMiddleware, configure_logging, log
from app.routers import activities, contacts, dashboard, deals, health, organizations
from app.security import SecurityMiddleware
from app.services import ServiceError

HOST = "127.0.0.1"
ROUTERS = [health.router, organizations.router, contacts.router, deals.router, activities.router, dashboard.router]

# The status for each service refusal (spec 5.2).
SERVICE_STATUS = {"not_found": 404, "validation_failed": 422, "stale_position": 409}


async def _service_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ServiceError)
    return error_response(SERVICE_STATUS.get(exc.code, 500), exc.code, fields=exc.fields)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app. Tests pass their own Settings, with a temporary database and a fixed clock."""
    settings = settings or load_settings()
    configure_logging(settings)
    # No interactive docs: they load scripts from a CDN, and the app makes no outside requests (R2).
    app = FastAPI(title="Accountable", version=APP_VERSION, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.clock = settings.clock
    app.state.engine = engine_for(settings)

    # Added innermost first, so a request passes: request ID and logging, security, errors.
    app.add_middleware(UnexpectedErrorMiddleware)
    app.add_middleware(SecurityMiddleware, settings=settings)
    api_routes: list[APIRoute] = []
    app.add_middleware(RequestContextMiddleware, routes=api_routes)
    register_error_handlers(app)
    app.add_exception_handler(ServiceError, _service_error)

    for router in ROUTERS:
        app.include_router(router)
        api_routes.extend(r for r in router.routes if isinstance(r, APIRoute))
    return app


class StartupError(Exception):
    """A reason the backend can't start, as one line for the terminal (REL-9)."""


def check_port_free(port: int) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind((HOST, port))
        except OSError as exc:
            if exc.errno in (errno.EADDRINUSE, errno.EACCES, getattr(errno, "WSAEADDRINUSE", -1), 10013):
                raise StartupError(
                    f"Port {port} is already in use. Close the other copy of Accountable, "
                    "or the program using that port, and run npm run dev again."
                ) from exc
            raise


def prepare_database(settings: Settings) -> tuple[str | None, str | None, bool]:
    """Bring the database to the latest schema, and fill a new one with the sample data (R4).

    Returns the revision before and after, and whether sample data was loaded. Never deletes,
    resets or reseeds an existing database (REL-9, E-8): only a database this call created is
    seeded, and only by adding rows.
    """
    from app.seed import NotEmptyError, load_sample_data

    engine = engine_for(settings)
    try:
        before, after = upgrade_to_head(engine)
        if before is not None:
            return before, after, False
        with transaction(engine) as conn:
            load_sample_data(conn, settings.clock.now(), replace=False)
        return before, after, True
    except NotEmptyError as exc:
        raise StartupError(f"{exc} Nothing was changed ({describe_database(settings)}).") from exc
    except SQLAlchemyError as exc:
        raise StartupError(
            f"Couldn't reach, open or upgrade the database ({describe_database(settings)}, {type(exc).__name__}). "
            "It was left unchanged. See backend/logs/accountable.log, and the runbook in docs/STATUS.md."
        ) from exc
    finally:
        engine.dispose()


def run() -> None:
    try:
        settings = load_settings()
        settings.require_database()
        configure_logging(settings)
        check_port_free(settings.api_port)
        before, after, seeded = prepare_database(settings)
    except ConfigError as exc:
        print(f"Accountable can't start: {exc}", file=sys.stderr)
        sys.exit(1)
    except StartupError as exc:
        log.debug("start-up failed", exc_info=exc.__cause__)
        print(f"Accountable can't start: {exc}", file=sys.stderr)
        sys.exit(1)

    new_database = before is None
    log.info("Accountable %s starting. Open %s", APP_VERSION, settings.web_address)
    log.info("database %s (schema %s%s)", describe_database(settings), after, ", new" if new_database else "")
    log.info("sample data loaded: %s", "yes" if seeded else "no")
    if settings.test_mode:
        log.warning("test mode: ACCOUNTABLE_TEST_AUTH_KEYS is set, so only a local SQLite file is used (SEC-17)")
    if isinstance(settings.clock, FixedClock):
        log.warning("clock fixed at %s by ACCOUNTABLE_FIXED_NOW (tests only)", settings.clock.now().isoformat())
    log.info("API on http://%s:%s%s", HOST, settings.api_port, " (reload on)" if settings.reload else "")

    import uvicorn

    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host=HOST,
        port=settings.api_port,
        reload=settings.reload,
        reload_dirs=[str(BACKEND_DIR / "app")] if settings.reload else None,
        access_log=False,
        log_level="warning",
    )


if __name__ == "__main__":
    run()
