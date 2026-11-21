"""GET /api/health (OBS-5, spec 5.5)."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.config import APP_VERSION
from app.db import schema_version
from app.logging import log

router = APIRouter()


@router.get("/api/health")
def health(request: Request) -> JSONResponse:
    try:
        with request.app.state.engine.connect() as conn:
            version = schema_version(conn)
    except SQLAlchemyError:
        log.warning("health check could not read the database")
        body = {"status": "error", "database": "error", "schema_version": None, "app_version": APP_VERSION}
        return JSONResponse(body, status_code=503)
    body = {"status": "ok", "database": "ok", "schema_version": version, "app_version": APP_VERSION}
    return JSONResponse(body)
