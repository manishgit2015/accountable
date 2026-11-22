"""Contacts (spec 5.3, R11, R30, R32, R34, R51). HTTP only: parse, call a service, shape the answer."""

from fastapi import APIRouter, Request, Response

from app.schemas import Contact, ContactCreate, ContactDeleteImpact, ContactUpdate, TimelineEntry
from app.services import deletes, records, timeline, unit_of_work

router = APIRouter(prefix="/api/contacts")


@router.get("")
def list_contacts(request: Request) -> list[Contact]:
    with unit_of_work(request.app.state.engine) as conn:
        return records.list_contacts(conn)


@router.post("", status_code=201)
def create_contact(request: Request, body: ContactCreate) -> Contact:
    with unit_of_work(request.app.state.engine) as conn:
        return records.create_contact(conn, body, request.app.state.clock.now())


@router.get("/{contact_id}")
def get_contact(request: Request, contact_id: int) -> Contact:
    with unit_of_work(request.app.state.engine) as conn:
        return records.get_contact(conn, contact_id)


@router.patch("/{contact_id}")
def update_contact(request: Request, contact_id: int, body: ContactUpdate) -> Contact:
    with unit_of_work(request.app.state.engine) as conn:
        return records.update_contact(conn, contact_id, body, request.app.state.clock.now())


@router.delete("/{contact_id}", status_code=204)
def delete_contact(request: Request, contact_id: int) -> Response:
    with unit_of_work(request.app.state.engine) as conn:
        deletes.delete_contact(conn, contact_id)
    return Response(status_code=204)


@router.get("/{contact_id}/timeline")
def contact_timeline(request: Request, contact_id: int) -> list[TimelineEntry]:
    with unit_of_work(request.app.state.engine) as conn:
        return timeline.contact_timeline(conn, contact_id)


@router.get("/{contact_id}/delete-impact")
def contact_delete_impact(request: Request, contact_id: int) -> ContactDeleteImpact:
    with unit_of_work(request.app.state.engine) as conn:
        return deletes.contact_impact(conn, contact_id)
