"""The FastAPI app factory and the backend's start-up (OBS-4, REL-9, DEP-4).

`python -m app.main` (run by `npm run dev`) checks the port, migrates the database, logs the
start-up lines and serves on 127.0.0.1 only (SEC-1). Any start-up failure prints one clear
line and exits with a non-zero code.
"""

from __future__ import annotations

import errno
import socket
import sys

from fastapi import FastAPI
from fastapi.routing import APIRoute
from sqlalchemy.exc import SQLAlchemyError

from app.config import APP_VERSION, BACKEND_DIR, ConfigError, Settings, load_settings
from app.db import create_db_engine, upgrade_to_head
from app.errors import UnexpectedErrorMiddleware, register_error_handlers
from app.logging import RequestContextMiddleware, configure_logging, log
from app.routers import health
from app.security import SecurityMiddleware

HOST = "127.0.0.1"
ROUTERS = [health.router]


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app. Tests pass their own Settings, with a temporary database and a fixed clock."""
    settings = settings or load_settings()
    configure_logging(settings)
    # No interactive docs: they load scripts from a CDN, and the app makes no outside requests (R2).
    app = FastAPI(title="Accountable", version=APP_VERSION, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.clock = settings.clock
    app.state.engine = create_db_engine(settings.db_path)

    # Added innermost first, so a request passes: request ID and logging, security, errors.
    app.add_middleware(UnexpectedErrorMiddleware)
    app.add_middleware(SecurityMiddleware, settings=settings)
    api_routes: list[APIRoute] = []
    app.add_middleware(RequestContextMiddleware, routes=api_routes)
    register_error_handlers(app)

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


def prepare_database(settings: Settings) -> tuple[str | None, str | None]:
    """Bring the database to the latest schema. Never deletes, resets or reseeds an existing file."""
    engine = create_db_engine(settings.db_path)
    try:
        return upgrade_to_head(engine)
    except SQLAlchemyError as exc:
        raise StartupError(
            f"Couldn't open or upgrade the database at {settings.db_path} ({type(exc).__name__}). "
            "It was left unchanged. See backend/logs/accountable.log, and the runbook in docs/STATUS.md."
        ) from exc
    finally:
        engine.dispose()


def run() -> None:
    try:
        settings = load_settings()
        configure_logging(settings)
        check_port_free(settings.api_port)
        before, after = prepare_database(settings)
    except ConfigError as exc:
        print(f"Accountable can't start: {exc}", file=sys.stderr)
        sys.exit(1)
    except StartupError as exc:
        log.debug("start-up failed", exc_info=exc.__cause__)
        print(f"Accountable can't start: {exc}", file=sys.stderr)
        sys.exit(1)

    new_database = before is None
    log.info("Accountable %s starting. Open %s", APP_VERSION, settings.web_address)
    log.info("database %s (schema %s%s)", settings.db_path, after, ", new" if new_database else "")
    log.info("sample data loaded: no")  # Seeding a new database arrives with T2.6.
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
