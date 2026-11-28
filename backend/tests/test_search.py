"""V-B17: the top-bar search, GET /api/search (R121, R122, R125, section 5.3, ADR-024)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def _org(client: TestClient, name: str, industry: str | None = None) -> int:
    response = client.post("/api/organizations", json={"name": name, "industry": industry})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _contact(client: TestClient, name: str, org: int) -> int:
    response = client.post("/api/contacts", json={"name": name, "organization_id": org})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _deal(client: TestClient, name: str, org: int, contact: int, stage: str = "proposal") -> int:
    body = {"name": name, "organization_id": org, "contact_id": contact, "stage": stage, "value": 1000}
    response = client.post("/api/deals", json={**body, "close_date": "2026-12-31"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _search(client: TestClient, q: str) -> dict:
    response = client.get("/api/search", params={"q": q})
    assert response.status_code == 200, response.text
    return response.json()


def _names(results: dict, group: str) -> list[str]:
    return [item["name"] for item in results[group]["items"]]


@pytest.fixture
def acme(client: TestClient) -> dict[str, int]:
    org = _org(client, "Acme Ltd", "Logistics")
    jo = _contact(client, "Jo Acmeson", org)
    deal = _deal(client, "Acme fleet", org, jo)
    _org(client, "Beta Co", "Retail")
    return {"org": org, "jo": jo, "deal": deal}


def test_R121_finds_each_kind_by_part_of_its_name_in_any_case(client: TestClient, acme: dict) -> None:
    for text in ("acme", "ACME", "cMe", "  acme  "):
        results = _search(client, text)
        assert _names(results, "organizations") == ["Acme Ltd"], text
        assert _names(results, "contacts") == ["Jo Acmeson"], text
        assert _names(results, "deals") == ["Acme fleet"], text


def test_spec53_each_item_has_its_fields_and_each_group_its_total(client: TestClient, acme: dict) -> None:
    assert _search(client, "acme") == {
        "organizations": {"total": 1, "items": [{"id": acme["org"], "name": "Acme Ltd", "industry": "Logistics"}]},
        "contacts": {"total": 1, "items": [{"id": acme["jo"], "name": "Jo Acmeson", "organization_name": "Acme Ltd"}]},
        "deals": {
            "total": 1,
            "items": [{"id": acme["deal"], "name": "Acme fleet", "organization_name": "Acme Ltd", "stage": "proposal"}],
        },
    }


def test_R124_no_matches_gives_empty_groups(client: TestClient, acme: dict) -> None:
    empty = {"total": 0, "items": []}
    assert _search(client, "xyz") == {"organizations": empty, "contacts": empty, "deals": empty}


def test_R122_starting_with_the_text_comes_first_then_a_to_z_in_any_case(client: TestClient) -> None:
    for name in ("Zeta acme", "beta Acme", "Acme", "acme Two", "Acme"):
        _org(client, name)
    assert _names(_search(client, "acme"), "organizations") == ["Acme", "Acme", "acme Two", "beta Acme", "Zeta acme"]
    # A name that only contains the text comes after one that starts with it, even when A–Z would put it first.
    for name in ("Anton", "Tonic", "Cotton", "tonnage"):
        _org(client, name)
    assert _names(_search(client, "ton"), "organizations") == ["Tonic", "tonnage", "Anton", "Cotton"]


def test_R122_five_best_matches_with_the_full_total(client: TestClient) -> None:
    for letter in "GFEDCBA":
        _org(client, f"North {letter}")
    results = _search(client, "north")
    assert results["organizations"]["total"] == 7
    assert _names(results, "organizations") == ["North A", "North B", "North C", "North D", "North E"]


@pytest.mark.parametrize(
    ("name", "text"),
    [
        ("Élodie Durand", "élo"),
        ("Élodie Durand", "ÉLODIE"),
        ("Élodie Durand", "lodie"),
        ("Ürün Gıda", "ürün"),
        ("Straße & Co", "STRASSE"),
        ("Strasse AG", "Straße"),  # casefold, not lower(): ß is ss
        ("SØREN KJÆR", "søren"),
    ],
)
def test_R125_accents_and_capitals_match_the_same_on_every_database(client: TestClient, name: str, text: str) -> None:
    _org(client, name)
    assert _names(_search(client, text), "organizations") == [name]


def test_R125_percent_and_underscore_are_plain_characters(client: TestClient) -> None:
    for name in ("50% off", "500 off", "a_b", "axb"):
        _org(client, name)
    assert _names(_search(client, "0%"), "organizations") == ["50% off"]
    assert _names(_search(client, "a_"), "organizations") == ["a_b"]
    assert _names(_search(client, "%%"), "organizations") == []


@pytest.mark.parametrize("q", ["", " ", "a", "  a  ", "x" * 201])
def test_R121_under_2_or_over_200_characters_is_refused(client: TestClient, q: str) -> None:
    response = client.get("/api/search", params={"q": q})
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == {"q": "Type 2 to 200 characters to search."}


def test_R121_exactly_2_and_exactly_200_characters_are_searched(client: TestClient) -> None:
    _org(client, "ab" + "c" * 198)
    assert _search(client, "ab")["organizations"]["total"] == 1
    assert _search(client, "ab" + "c" * 198)["organizations"]["total"] == 1


def test_R121_no_q_at_all_is_refused(client: TestClient) -> None:
    assert client.get("/api/search").status_code == 422


def test_R121_a_contact_or_deal_without_an_organization_still_shows(client: TestClient, acme: dict) -> None:
    client.delete(f"/api/organizations/{acme['org']}")
    results = _search(client, "acme")
    assert results["contacts"]["items"][0]["organization_name"] is None
    assert results["deals"]["items"][0]["organization_name"] is None
