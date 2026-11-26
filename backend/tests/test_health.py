"""The health route needs no Supabase: it runs in a subprocess with dummy settings.

A subprocess keeps the dummy values out of this process, where app.main and its settings are cached
for the integration tests.
"""

import json
import os
import subprocess
import sys

SCRIPT = """
import json
from fastapi.testclient import TestClient
from app.main import app
r = TestClient(app).get("/health")
print(json.dumps({"status": r.status_code, "body": r.json()}))
"""


def test_health_is_public_and_needs_no_supabase(tmp_path):
    env = {
        **os.environ,
        "SUPABASE_URL": "https://dummy.invalid",
        "SUPABASE_PUBLISHABLE_KEY": "dummy",
        "SUPABASE_SECRET_KEY": "dummy",
        "PYTHONPATH": os.getcwd(),
    }
    # Run from an empty directory so a local backend/.env cannot leak into the settings.
    result = subprocess.run(
        [sys.executable, "-c", SCRIPT],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout.strip().splitlines()[-1])
    assert out == {"status": 200, "body": {"success": True, "data": {"status": "ok"}, "error": None}}
