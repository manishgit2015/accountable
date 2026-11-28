"""GET /api/me: the signed-in person (section 5.3, R105, R106)."""

from fastapi import APIRouter, Depends

from app.auth import Person, signed_in
from app.people import display_name, initials

router = APIRouter()


@router.get("/api/me")
def me(person: Person = Depends(signed_in)) -> dict[str, str]:  # noqa: B008 (FastAPI's dependency style)
    return {
        "id": person.id,
        "name": display_name(person.name, person.email),
        "email": person.email,
        "initials": initials(person.name, person.email),
    }
