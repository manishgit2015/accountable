"""V-B03: organization request rules (R10, R21) and the 422 format (T1.6), and the API (T2.1):
create, read, update and delete, list counts and open value (R44), duplicates (R22).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from app.errors import validation_fields
from app.schemas import Organization, OrganizationCreate, OrganizationUpdate
from tests.conftest import PRIYA


def problems(model: type[BaseModel], data: dict) -> dict[str, str]:
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
        "created_by",
        "updated_at",
        "updated_by",
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


# The API (T2.1) ------------------------------------------------------------------------------------


def _org(client: TestClient, **fields) -> dict:
    response = client.post("/api/organizations", json={"name": "Acme Ltd", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def _contact(client: TestClient, org_id: int, name: str = "Jo Bloggs") -> dict:
    response = client.post("/api/contacts", json={"name": name, "organization_id": org_id})
    assert response.status_code == 201, response.text
    return response.json()


def _deal(client: TestClient, org_id: int, contact_id: int, stage: str, value: int) -> dict:
    body = {
        "name": f"{stage} deal",
        "organization_id": org_id,
        "contact_id": contact_id,
        "stage": stage,
        "value": value,
        "close_date": "2026-12-31",
    }
    response = client.post("/api/deals", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_R10_create_returns_201_with_the_record_and_timestamps(client: TestClient) -> None:
    org = _org(client, website="acme.example", industry=" Retail ", notes=None)
    assert org == {
        "id": org["id"],
        "name": "Acme Ltd",
        "website": "https://acme.example",
        "industry": "Retail",
        "notes": None,
        "contact_count": 0,
        "open_deal_count": 0,
        "open_value": 0,
        "created_at": "2026-11-21T14:30:00",
        "created_by": {"id": PRIYA.id, "name": "Priya Shah"},
        "updated_at": "2026-11-21T14:30:00",
        "updated_by": {"id": PRIYA.id, "name": "Priya Shah"},
    }
    assert client.get(f"/api/organizations/{org['id']}").json() == org


def test_R10_R21_create_refuses_broken_rules_with_422_and_saves_nothing(client: TestClient) -> None:
    response = client.post("/api/organizations", json={"name": "x" * 201, "website": "javascript:alert(1)"})
    assert response.status_code == 422
    assert set(response.json()["error"]["fields"]) == {"name", "website"}
    assert client.get("/api/organizations").json() == []


def test_R22_two_organizations_may_share_a_name(client: TestClient) -> None:
    _org(client)
    _org(client)
    assert [o["name"] for o in client.get("/api/organizations").json()] == ["Acme Ltd", "Acme Ltd"]


def test_R47_list_is_every_organization_sorted_by_name_ignoring_case(client: TestClient) -> None:
    for name in ("Zeta", "alpha", "Mid"):
        _org(client, name=name)
    assert [o["name"] for o in client.get("/api/organizations").json()] == ["alpha", "Mid", "Zeta"]


def test_R44_list_counts_contacts_open_deals_and_open_value(client: TestClient) -> None:
    acme = _org(client)
    other = _org(client, name="Other")
    jo = _contact(client, acme["id"])
    _contact(client, acme["id"], "Sam")
    _contact(client, other["id"], "Kim")
    _deal(client, acme["id"], jo["id"], "new", 1000)
    _deal(client, acme["id"], jo["id"], "negotiation", 2500)
    _deal(client, acme["id"], jo["id"], "won", 9000)  # closed: not open
    _deal(client, acme["id"], jo["id"], "lost", 7000)
    listed = {o["name"]: o for o in client.get("/api/organizations").json()}
    assert (listed["Acme Ltd"]["contact_count"], listed["Acme Ltd"]["open_deal_count"]) == (2, 2)
    assert listed["Acme Ltd"]["open_value"] == 3500
    assert (listed["Other"]["contact_count"], listed["Other"]["open_deal_count"], listed["Other"]["open_value"]) == (
        1,
        0,
        0,
    )
    assert client.get(f"/api/organizations/{acme['id']}").json() == listed["Acme Ltd"]


def test_spec53_patch_changes_only_the_fields_sent_and_sets_updated_at(client: TestClient, clock) -> None:
    org = _org(client, website="acme.example", industry="Retail")
    clock.at = clock.at.replace(hour=16)
    response = client.patch(f"/api/organizations/{org['id']}", json={"industry": "Wholesale", "notes": "Big"})
    assert response.status_code == 200
    changed = response.json()
    assert (changed["industry"], changed["notes"], changed["website"]) == ("Wholesale", "Big", "https://acme.example")
    assert (changed["created_at"], changed["updated_at"]) == ("2026-11-21T14:30:00", "2026-11-21T16:30:00")
    cleared = client.patch(f"/api/organizations/{org['id']}", json={"website": None}).json()
    assert cleared["website"] is None and cleared["industry"] == "Wholesale"


def test_spec53_patch_refuses_a_blank_name(client: TestClient) -> None:
    org = _org(client)
    response = client.patch(f"/api/organizations/{org['id']}", json={"name": "  "})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"name": "Enter a name."}
    assert client.get(f"/api/organizations/{org['id']}").json()["name"] == "Acme Ltd"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/organizations/999"),
        ("patch", "/api/organizations/999"),
        ("delete", "/api/organizations/999"),
        ("get", "/api/organizations/999/timeline"),
        ("get", "/api/organizations/999/delete-impact"),
    ],
)
def test_spec52_missing_organization_is_404(client: TestClient, method: str, path: str) -> None:
    kwargs = {"json": {"name": "B"}} if method == "patch" else {}
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_R10_delete_returns_204(client: TestClient) -> None:
    org = _org(client)
    response = client.delete(f"/api/organizations/{org['id']}")
    assert response.status_code == 204 and response.content == b""
    assert client.get(f"/api/organizations/{org['id']}").status_code == 404
