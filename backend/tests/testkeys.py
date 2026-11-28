"""Test sign-in keys (SEC-17, ADR-025): an ES256 key pair as a JWK set, like scripts/run-tests.mjs makes for
each run. The private key signs test tokens; the backend checks them with the public part, as it checks
Supabase's tokens with Supabase's public keys."""

from __future__ import annotations

import json
import uuid

from cryptography.hazmat.primitives.asymmetric import ec
from jwt.algorithms import ECAlgorithm


def make_test_keys() -> dict:
    private = ec.generate_private_key(ec.SECP256R1())
    jwk = ECAlgorithm.to_jwk(private, as_dict=True)
    return {"keys": [{**jwk, "kid": f"test-{uuid.uuid4().hex[:12]}", "alg": "ES256", "use": "sig"}]}


def make_test_keys_json() -> str:
    return json.dumps(make_test_keys())
