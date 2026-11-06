"""Offline, fail-closed check. Never sends a request or selects a fallback project."""
import argparse
import json
from pathlib import Path
import tomllib
from urllib.parse import urlparse, parse_qs

PROJECT = "xxownwxxajzrviuvvfiu"
ROOT = Path(__file__).resolve().parents[3]

def verify(root, observed_project=None, denied=False):
    if denied:
        raise ValueError("Access denied: stop; reauthentication required, no fallback")
    config = tomllib.loads((root / ".codex/config.toml").read_text())
    url = urlparse(config["mcp_servers"]["supabase_bogunon_ro"]["url"])
    if (url.scheme, url.netloc, url.path) != ("https", "mcp.supabase.com", "/mcp"):
        raise ValueError("Unexpected MCP endpoint")
    if parse_qs(url.query) != {"project_ref": [PROJECT], "read_only": ["true"]}:
        raise ValueError("Project scope or read-only flag mismatch")
    origin = json.loads((root / "config/production-supabase.json").read_text())["origin"]
    if urlparse(origin).hostname != PROJECT + ".supabase.co":
        raise ValueError("Product origin mismatch")
    if observed_project is not None and observed_project != PROJECT:
        raise ValueError("Returned project mismatch: stop; no fallback")
    return PROJECT

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--observed-project", required=True, help="ID verified from the selected connection")
    parser.add_argument("--access-denied", action="store_true")
    args = parser.parse_args()
    try:
        print(verify(ROOT, args.observed_project, args.access_denied))
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, str(error) + "\n")
