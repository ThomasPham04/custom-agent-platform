"""Ported from AgentPlatform-BackEnd/server/tests/health.test.js.

The body is asserted exactly. Express returns {status:'ok', mode:'mock'} and the
parity gate (spec §13) depends on this staying identical.
"""


def test_health_reports_mock_mode(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "mode": "mock"}
