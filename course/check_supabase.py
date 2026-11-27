# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx>=0.28", "pg8000>=1.31", "python-dotenv>=1.0"]
# ///
"""Test the Supabase connection from the settings in .env.

From the accountable folder:

    uv run course/supabase_connection.py

It changes nothing and never prints your password or key.
"""

import ssl
import sys
from importlib import import_module
from pathlib import Path
from urllib.parse import unquote, urlsplit

# Loaded by name, as in check_supabase.py, so the project's type check doesn't need them installed.
# pg8000 is pure Python, so Windows Application Control has no DLL to block.
httpx = import_module("httpx")
pg8000_native = import_module("pg8000.native")
dotenv_values = import_module("dotenv").dotenv_values

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def test_supabase_connection() -> bool:
    """Return True if both the database (DATABASE_URL) and the API (SUPABASE_URL + key) answer."""
    env = dotenv_values(ENV_FILE)
    ok = True

    # 1. The database: connect and run "select 1".
    try:
        url = urlsplit(env.get("DATABASE_URL") or "")
        tls = ssl.create_default_context()
        tls.check_hostname = False  # as libpq's default, sslmode=prefer
        tls.verify_mode = ssl.CERT_NONE
        connection = pg8000_native.Connection(
            user=unquote(url.username or ""),
            password=unquote(url.password or ""),
            host=url.hostname or "",
            port=url.port or 5432,
            database=url.path.lstrip("/") or "postgres",
            ssl_context=tls,
            timeout=15,
        )
        try:
            connection.run("select 1")
            version = connection.run("show server_version")[0][0]
        finally:
            connection.close()
        print(f"Database: connected (Postgres {version})")
    except Exception as error:
        print(f"Database: failed ({type(error).__name__}: {str(error).splitlines()[-1] if str(error) else ''})")
        ok = False

    # 2. The API: ask Supabase Auth for its settings with the publishable key.
    try:
        base = (env.get("SUPABASE_URL") or "").rstrip("/")
        key = env.get("SUPABASE_PUBLISHABLE_KEY") or ""
        response = httpx.get(f"{base}/auth/v1/settings", headers={"apikey": key}, timeout=15)
        response.raise_for_status()
        print("API: the publishable key was accepted")
    except Exception as error:
        print(f"API: failed ({type(error).__name__})")
        ok = False

    return ok


if __name__ == "__main__":
    sys.exit(0 if test_supabase_connection() else 1)
