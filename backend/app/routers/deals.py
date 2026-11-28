"""Deals (spec 5.3, 5.4, R12, R15–R18, R23, R30, R33, R52, R63, R67). HTTP only."""

from fastapi import APIRouter, Request, Response

from app.schemas import Deal, DealCreate, DealDeleteImpact, DealMove, DealUpdate, MoveResult, TimelineEntry
from app.services import deletes, moves, records, timeline, unit_of_work

router = APIRouter(prefix="/api/deals")


@router.get("")
def list_deals(request: Request) -> list[Deal]:
    with unit_of_work(request.app.state.engine) as conn:
        return records.list_deals(conn, request.app.state.clock.today())


@router.post("", status_code=201)
def create_deal(request: Request, body: DealCreate) -> Deal:
    with unit_of_work(request.app.state.engine) as conn:
        return records.create_deal(conn, body, request.app.state.clock.now(), by=request.state.person.id)


@router.get("/{deal_id}")
def get_deal(request: Request, deal_id: int) -> Deal:
    with unit_of_work(request.app.state.engine) as conn:
        return records.get_deal(conn, deal_id, request.app.state.clock.today())


@router.patch("/{deal_id}")
def update_deal(request: Request, deal_id: int, body: DealUpdate) -> Deal:
    """A stage change here follows the same rules as /move, through services/moves.py (R15–R18, R67)."""
    with unit_of_work(request.app.state.engine) as conn:
        return records.update_deal(conn, deal_id, body, request.app.state.clock.now(), by=request.state.person.id)


@router.post("/{deal_id}/move")
def move_deal(request: Request, deal_id: int, body: DealMove) -> MoveResult:
    with unit_of_work(request.app.state.engine) as conn:
        return moves.move(conn, deal_id, body, request.app.state.clock.now(), by=request.state.person.id)


@router.delete("/{deal_id}", status_code=204)
def delete_deal(request: Request, deal_id: int) -> Response:
    with unit_of_work(request.app.state.engine) as conn:
        deletes.delete_deal(conn, deal_id)
    return Response(status_code=204)


@router.get("/{deal_id}/timeline")
def deal_timeline(request: Request, deal_id: int) -> list[TimelineEntry]:
    with unit_of_work(request.app.state.engine) as conn:
        return timeline.deal_timeline(conn, deal_id)


@router.get("/{deal_id}/delete-impact")
def deal_delete_impact(request: Request, deal_id: int) -> DealDeleteImpact:
    with unit_of_work(request.app.state.engine) as conn:
        return deletes.deal_impact(conn, deal_id)
