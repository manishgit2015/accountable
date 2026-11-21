"""V-B04 (T1.6 part): contact request rules (R11, R21, R34) and the contact response shape.

The endpoints are added in T2.1.
"""

import pytest
from pydantic import ValidationError

from app.errors import validation_fields
from app.schemas import Contact, ContactCreate, ContactUpdate


def problems(model: type, data: dict) -> dict[str, str]:
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
        "updated_at",
    ]
