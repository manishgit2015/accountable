"""V-B04: contact request rules (R11, R21, R34) and the response shape (T1.6), and the API (T2.1):
organization required on create, status default, the cleared link kept on edit.
"""

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.errors import validation_fields
from app.schemas import Contact, ContactCreate, ContactUpdate
from tests.conftest import PRIYA


def problems(model: type[BaseModel], data: dict) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        model.model_validate(data)
    return validation_fields(caught.value.errors())


def test_R11_organization_is_required_on_create_and_status_defaults_to_lead() -> None:
    contact = ContactCreate.model_validate({"name": "Jo Bloggs", "organization_id": 3})
    assert contact.status == "lead"
    assert problems(ContactCreate, {"name": "Jo Bloggs"}) == {"organization_id": "Choose an organization."}


@pytest.mark.parametrize("status", ["lead", "qualified", "customer"])
def test_R11_status_is_one_of_three(status: str) -> None:
    assert ContactCreate.model_validate({"name": "Jo", "organization_id": 1, "status": status}).status == status
    assert problems(ContactCreate, {"name": "Jo", "organization_id": 1, "status": "vip"}) == {
        "status": "Choose a status."
    }


@pytest.mark.parametrize("email", ["jo@acme.example", "jo.bloggs+crm@mail.acme.co.uk"])
def test_R21_email_with_name_at_domain_tld_shape_is_accepted(email: str) -> None:
    assert ContactCreate.model_validate({"name": "Jo", "organization_id": 1, "email": email}).email == email


@pytest.mark.parametrize(
    "email", ["jo", "jo@acme", "@acme.example", "jo @acme.example", "jo@acme.", "jo@@acme.example"]
)
def test_R21_email_of_another_shape_is_refused(email: str) -> None:
    assert problems(ContactCreate, {"name": "Jo", "organization_id": 1, "email": email}) == {
        "email": "Enter an email like name@example.com."
    }


def test_R21_email_up_to_254_characters() -> None:
    email = "j" * (254 - len("@acme.example")) + "@acme.example"
    assert ContactCreate.model_validate({"name": "Jo", "organization_id": 1, "email": email}).email == email
    assert "email" in problems(ContactCreate, {"name": "Jo", "organization_id": 1, "email": "j" + email})


@pytest.mark.parametrize("phone", ["+44 (0)20 7946-0000", "555.123.4567", "0" * 40])
def test_R21_phone_of_digits_spaces_and_symbols_is_accepted(phone: str) -> None:
    assert ContactCreate.model_validate({"name": "Jo", "organization_id": 1, "phone": phone}).phone == phone


@pytest.mark.parametrize("phone", ["call me", "555-1234 ext 2", "0" * 41])
def test_R21_phone_with_other_characters_or_too_long_is_refused(phone: str) -> None:
    assert "phone" in problems(ContactCreate, {"name": "Jo", "organization_id": 1, "phone": phone})


def test_R21_job_title_up_to_100_characters() -> None:
    ContactCreate.model_validate({"name": "Jo", "organization_id": 1, "job_title": "t" * 100})
    assert "job_title" in problems(ContactCreate, {"name": "Jo", "organization_id": 1, "job_title": "t" * 101})


def test_R34_update_without_the_organization_leaves_it_alone_and_cannot_null_it() -> None:
    assert ContactUpdate.model_validate({"phone": "123"}).model_fields_set == {"phone"}
    assert problems(ContactUpdate, {"organization_id": None}) == {"organization_id": "Choose an organization."}
    cleared = ContactUpdate.model_validate({"email": None})
    assert cleared.model_fields_set == {"email"} and cleared.email is None


def test_spec53_contact_response_has_the_spec_fields() -> None:
    assert list(Contact.model_fields) == [
        "id",
        "organization_id",
        "organization_name",
        "name",
        "email",
        "phone",
        "job_title",
        "status",
        "created_at",
        "created_by",
        "updated_at",
        "updated_by",
    ]


# The API (T2.1) ------------------------------------------------------------------------------------


def _org(client: TestClient, name: str = "Acme Ltd") -> int:
    response = client.post("/api/organizations", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


def _create(client: TestClient, **fields) -> dict:
    response = client.post("/api/contacts", json=fields)
    assert response.status_code == 201, response.text
    return response.json()


def test_R11_create_needs_an_organization_and_defaults_to_lead(client: TestClient) -> None:
    org_id = _org(client)
    response = client.post("/api/contacts", json={"name": "Jo Bloggs"})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"organization_id": "Choose an organization."}
    contact = _create(client, name="Jo Bloggs", organization_id=org_id, email="jo@acme.example")
    assert contact == {
        "id": contact["id"],
        "organization_id": org_id,
        "organization_name": "Acme Ltd",
        "name": "Jo Bloggs",
        "email": "jo@acme.example",
        "phone": None,
        "job_title": None,
        "status": "lead",
        "created_at": "2026-11-21T14:30:00",
        "created_by": {"id": PRIYA.id, "name": "Priya Shah"},
        "updated_at": "2026-11-21T14:30:00",
        "updated_by": {"id": PRIYA.id, "name": "Priya Shah"},
    }
    assert client.get(f"/api/contacts/{contact['id']}").json() == contact


def test_R11_an_organization_that_does_not_exist_is_refused(client: TestClient) -> None:
    response = client.post("/api/contacts", json={"name": "Jo", "organization_id": 42})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"organization_id": "That organization doesn't exist. Choose another."}
    assert client.get("/api/contacts").json() == []


def test_R21_contact_field_rules_are_enforced_by_the_api(client: TestClient) -> None:
    org_id = _org(client)
    response = client.post(
        "/api/contacts", json={"name": "Jo", "organization_id": org_id, "email": "jo@", "phone": "call me"}
    )
    assert response.status_code == 422
    assert set(response.json()["error"]["fields"]) == {"email", "phone"}


def test_R47_list_is_sorted_by_name_with_the_organization_name(client: TestClient) -> None:
    acme, beta = _org(client), _org(client, "Beta Co")
    _create(client, name="zoe", organization_id=acme)
    _create(client, name="Adam", organization_id=beta, status="customer")
    listed = client.get("/api/contacts").json()
    assert [(c["name"], c["organization_name"], c["status"]) for c in listed] == [
        ("Adam", "Beta Co", "customer"),
        ("zoe", "Acme Ltd", "lead"),
    ]


def test_spec44_status_can_be_set_by_hand_to_any_other(client: TestClient) -> None:
    contact = _create(client, name="Jo", organization_id=_org(client), status="customer")
    for status in ("lead", "qualified", "customer"):
        assert client.patch(f"/api/contacts/{contact['id']}", json={"status": status}).json()["status"] == status


def test_R34_a_cleared_organization_is_kept_when_editing_other_fields(client: TestClient) -> None:
    org_id = _org(client)
    contact = _create(client, name="Jo", organization_id=org_id)
    assert client.delete(f"/api/organizations/{org_id}").status_code == 204
    cleared = client.get(f"/api/contacts/{contact['id']}").json()
    assert (cleared["organization_id"], cleared["organization_name"]) == (None, None)
    response = client.patch(f"/api/contacts/{contact['id']}", json={"job_title": "Buyer"})
    assert response.status_code == 200
    assert (response.json()["job_title"], response.json()["organization_id"]) == ("Buyer", None)
    # Filling the link back in is checked, and it can't be set back to empty.
    assert client.patch(f"/api/contacts/{contact['id']}", json={"organization_id": 999}).status_code == 422
    assert client.patch(f"/api/contacts/{contact['id']}", json={"organization_id": None}).status_code == 422
    new_org = _org(client, "New Co")
    moved = client.patch(f"/api/contacts/{contact['id']}", json={"organization_id": new_org}).json()
    assert (moved["organization_id"], moved["organization_name"]) == (new_org, "New Co")


def test_spec53_patch_clears_optional_fields_and_sets_updated_at(client: TestClient, clock) -> None:
    contact = _create(client, name="Jo", organization_id=_org(client), phone="+44 1234", email="jo@a.example")
    clock.at = clock.at.replace(day=22)
    changed = client.patch(f"/api/contacts/{contact['id']}", json={"phone": " ", "email": None}).json()
    assert (changed["phone"], changed["email"], changed["name"]) == (None, None, "Jo")
    assert changed["updated_at"] == "2026-11-22T14:30:00"


@pytest.mark.parametrize("method", ["get", "patch", "delete"])
def test_spec52_missing_contact_is_404(client: TestClient, method: str) -> None:
    kwargs = {"json": {"name": "B"}} if method == "patch" else {}
    assert getattr(client, method)("/api/contacts/77", **kwargs).status_code == 404
