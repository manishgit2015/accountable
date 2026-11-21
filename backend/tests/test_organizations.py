"""V-B03 (T1.6 part): organization request rules (R10, R21), and the 422 format they produce.

The CRUD endpoints, list counts and open value are added in T2.1.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.errors import validation_fields
from app.schemas import Organization, OrganizationCreate, OrganizationUpdate


def problems(model: type, data: dict) -> dict[str, str]:
    with pytest.raises(ValidationError) as caught:
        model.model_validate(data)
    return validation_fields(caught.value.errors())


def test_R10_name_is_required_and_the_rest_optional() -> None:
    org = OrganizationCreate.model_validate({"name": "Acme Ltd"})
    assert (org.name, org.website, org.industry, org.notes) == ("Acme Ltd", None, None, None)
    assert problems(OrganizationCreate, {}) == {"name": "Enter a name."}


def test_R21_text_is_trimmed_and_blank_counts_as_empty() -> None:
    org = OrganizationCreate.model_validate({"name": "  Acme Ltd ", "industry": "   ", "notes": " Hi "})
    assert (org.name, org.industry, org.notes) == ("Acme Ltd", None, "Hi")
    assert problems(OrganizationCreate, {"name": "   "}) == {"name": "Enter a name."}


def test_R21_names_are_1_to_200_characters() -> None:
    assert OrganizationCreate.model_validate({"name": "x" * 200}).name == "x" * 200
    assert problems(OrganizationCreate, {"name": "x" * 201}) == {"name": "Keep the name to 200 characters or fewer."}


def test_R21_industry_100_and_notes_5000_characters() -> None:
    OrganizationCreate.model_validate({"name": "A", "industry": "i" * 100, "notes": "n" * 5000})
    assert set(problems(OrganizationCreate, {"name": "A", "industry": "i" * 101, "notes": "n" * 5001})) == {
        "industry",
        "notes",
    }


@pytest.mark.parametrize(
    ("given", "saved"),
    [
        ("https://acme.example", "https://acme.example"),
        ("http://acme.example/about?x=1", "http://acme.example/about?x=1"),
        ("HTTPS://Acme.Example", "HTTPS://Acme.Example"),
        ("acme.example", "https://acme.example"),
        ("www.acme.co.uk/contact", "https://www.acme.co.uk/contact"),
        ("acme.example:8080", "https://acme.example:8080"),
    ],
)
def test_R21_website_keeps_http_and_https_and_prefixes_bare_domains(given: str, saved: str) -> None:
    assert OrganizationCreate.model_validate({"name": "A", "website": given}).website == saved


@pytest.mark.parametrize(
    "given",
    [
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "ftp://acme.example",
        "mailto:jo@acme.example",
        "acme",
        "https://",
        "http://acme example.com",
        "//acme.example",
    ],
)
def test_SEC6_R21_website_with_another_scheme_or_shape_is_refused(given: str) -> None:
    assert problems(OrganizationCreate, {"name": "A", "website": given}) == {
        "website": "Enter a website like example.com or https://example.com."
    }


def test_R21_website_up_to_2048_characters() -> None:
    ok = "https://acme.example/" + "p" * (2048 - len("https://acme.example/"))
    assert OrganizationCreate.model_validate({"name": "A", "website": ok}).website == ok
    assert "website" in problems(OrganizationCreate, {"name": "A", "website": ok + "p"})
    bare = "acme.example/" + "p" * (2048 - len("https://acme.example/"))  # 2048 once https:// is added
    assert len(OrganizationCreate.model_validate({"name": "A", "website": bare}).website or "") == 2048
    assert "website" in problems(OrganizationCreate, {"name": "A", "website": bare + "p"})


def test_SEC7_unknown_fields_are_refused() -> None:
    assert problems(OrganizationCreate, {"name": "A", "is_admin": True}) == {"is_admin": "This field isn't allowed."}
    assert problems(OrganizationUpdate, {"colour": "red"}) == {"colour": "This field isn't allowed."}


def test_R21_text_fields_refuse_non_text() -> None:
    assert problems(OrganizationCreate, {"name": 12}) == {"name": "Enter text."}


def test_spec53_update_takes_only_the_fields_sent() -> None:
    update = OrganizationUpdate.model_validate({"industry": "Retail"})
    assert update.model_fields_set == {"industry"}
    cleared = OrganizationUpdate.model_validate({"website": None, "notes": "  "})
    assert cleared.model_fields_set == {"website", "notes"}
    assert (cleared.website, cleared.notes) == (None, None)


def test_spec53_update_cannot_blank_the_name() -> None:
    assert problems(OrganizationUpdate, {"name": None}) == {"name": "Enter a name."}
    assert problems(OrganizationUpdate, {"name": "  "}) == {"name": "Enter a name."}


def test_spec53_organization_response_has_the_spec_fields() -> None:
    assert list(Organization.model_fields) == [
        "id",
        "name",
        "website",
        "industry",
        "notes",
        "contact_count",
        "open_deal_count",
        "open_value",
        "created_at",
        "updated_at",
    ]


def test_spec52_rule_failures_reach_the_client_as_422_with_a_message_per_field(
    app: FastAPI, client: TestClient
) -> None:
    @app.post("/api/check-organization")
    def check(body: OrganizationCreate) -> dict[str, str]:
        return {"name": body.name}

    response = client.post("/api/check-organization", json={"name": " ", "website": "javascript:alert(1)", "x": 1})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert error["fields"] == {
        "name": "Enter a name.",
        "website": "Enter a website like example.com or https://example.com.",
        "x": "This field isn't allowed.",
    }
    response = client.post("/api/check-organization", json=["not", "an", "object"])
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"_": "Send a JSON object."}
