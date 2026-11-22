"""Organizations (spec 5.3, R10, R30, R31, R44, R50). HTTP only: parse, call a service, shape the answer."""

from fastapi import APIRouter, Request, Response

from app.schemas import Organization, OrganizationCreate, OrganizationDeleteImpact, OrganizationUpdate, TimelineEntry
from app.services import deletes, records, timeline, unit_of_work

router = APIRouter(prefix="/api/organizations")


@router.get("")
def list_organizations(request: Request) -> list[Organization]:
    with unit_of_work(request.app.state.engine) as conn:
        return records.list_organizations(conn)


@router.post("", status_code=201)
def create_organization(request: Request, body: OrganizationCreate) -> Organization:
    with unit_of_work(request.app.state.engine) as conn:
        return records.create_organization(conn, body, request.app.state.clock.now())


@router.get("/{organization_id}")
def get_organization(request: Request, organization_id: int) -> Organization:
    with unit_of_work(request.app.state.engine) as conn:
        return records.get_organization(conn, organization_id)


@router.patch("/{organization_id}")
def update_organization(request: Request, organization_id: int, body: OrganizationUpdate) -> Organization:
    with unit_of_work(request.app.state.engine) as conn:
        return records.update_organization(conn, organization_id, body, request.app.state.clock.now())


@router.delete("/{organization_id}", status_code=204)
def delete_organization(request: Request, organization_id: int) -> Response:
    with unit_of_work(request.app.state.engine) as conn:
        deletes.delete_organization(conn, organization_id)
    return Response(status_code=204)


@router.get("/{organization_id}/timeline")
def organization_timeline(request: Request, organization_id: int) -> list[TimelineEntry]:
    with unit_of_work(request.app.state.engine) as conn:
        return timeline.organization_timeline(conn, organization_id)


@router.get("/{organization_id}/delete-impact")
def organization_delete_impact(request: Request, organization_id: int) -> OrganizationDeleteImpact:
    with unit_of_work(request.app.state.engine) as conn:
        return deletes.organization_impact(conn, organization_id)
