"""Activities (spec 5.3, R13, R53, R55). There's no GET by ID for activities. HTTP only."""

from fastapi import APIRouter, Request, Response

from app.schemas import Activity, ActivityCreate, ActivityUpdate
from app.services import deletes, records, unit_of_work

router = APIRouter(prefix="/api/activities")


@router.get("")
def list_activities(request: Request) -> list[Activity]:
    with unit_of_work(request.app.state.engine) as conn:
        return records.list_activities(conn)


@router.post("", status_code=201)
def create_activity(request: Request, body: ActivityCreate) -> Activity:
    with unit_of_work(request.app.state.engine) as conn:
        return records.create_activity(conn, body, request.app.state.clock.now())


@router.patch("/{activity_id}")
def update_activity(request: Request, activity_id: int, body: ActivityUpdate) -> Activity:
    with unit_of_work(request.app.state.engine) as conn:
        return records.update_activity(conn, activity_id, body)


@router.delete("/{activity_id}", status_code=204)
def delete_activity(request: Request, activity_id: int) -> Response:
    with unit_of_work(request.app.state.engine) as conn:
        deletes.delete_activity(conn, activity_id)
    return Response(status_code=204)
