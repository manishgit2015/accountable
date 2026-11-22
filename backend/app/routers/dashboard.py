"""GET /api/dashboard (spec 5.5, R70–R79). HTTP only."""

from fastapi import APIRouter, Request

from app.schemas import Dashboard
from app.services import dashboard, unit_of_work

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard(request: Request) -> Dashboard:
    with unit_of_work(request.app.state.engine) as conn:
        return dashboard.dashboard(conn, request.app.state.clock.now())
