"""GET /api/search (section 5.3, R121, R122). HTTP only."""

from fastapi import APIRouter, Request

from app.schemas import SearchResults
from app.services import search, unit_of_work

router = APIRouter()


@router.get("/api/search")
def get_search(request: Request, q: str = "") -> SearchResults:
    with unit_of_work(request.app.state.engine) as conn:
        return search.search(conn, q)
