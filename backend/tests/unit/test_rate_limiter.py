import pytest
from starlette.requests import Request

from dependencies import actor_id_from_strava_id, create_jwt
from rate_limiter import rate_limit_key


def _build_request(headers: dict[str, str] | None = None, client_host: str = "127.0.0.1") -> Request:
    raw_headers = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("latin-1"), value.encode("latin-1")))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/segments",
        "headers": raw_headers,
        "client": (client_host, 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


@pytest.mark.unit
@pytest.mark.parametrize(
    "headers",
    [
        pytest.param(None, id="missing-header"),
        pytest.param({"authorization": "Bearer invalid.token"}, id="invalid-token"),
    ],
)
def test_rate_limit_key_uses_anonymous_actor_without_valid_token(headers):
    request = _build_request(headers=headers, client_host="203.0.113.10")
    assert rate_limit_key(request) == "actor:anonymous|ip:203.0.113.10"


@pytest.mark.unit
def test_rate_limit_key_uses_actor_id_and_ip_for_valid_token():
    actor_id = actor_id_from_strava_id(123456)
    token = create_jwt(actor_id=actor_id, is_admin=False)
    request = _build_request(
        headers={"authorization": f"Bearer {token}"},
        client_host="192.0.2.44",
    )
    assert rate_limit_key(request) == f"actor:{actor_id}|ip:192.0.2.44"


@pytest.mark.unit
def test_rate_limit_key_bypasses_admin_with_unique_key_per_request():
    actor_id = actor_id_from_strava_id(987654)
    token = create_jwt(actor_id=actor_id, is_admin=True)

    first_request = _build_request(
        headers={"authorization": f"Bearer {token}"},
        client_host="203.0.113.11",
    )
    second_request = _build_request(
        headers={"authorization": f"Bearer {token}"},
        client_host="203.0.113.11",
    )

    first_key = rate_limit_key(first_request)
    second_key = rate_limit_key(second_request)

    assert first_key.startswith(f"admin-bypass:{actor_id}:")
    assert second_key.startswith(f"admin-bypass:{actor_id}:")
    assert first_key != second_key


@pytest.mark.unit
def test_rate_limit_key_reuses_admin_bypass_key_within_same_request():
    actor_id = actor_id_from_strava_id(987654)
    token = create_jwt(actor_id=actor_id, is_admin=True)
    request = _build_request(
        headers={"authorization": f"Bearer {token}"},
        client_host="203.0.113.11",
    )

    first_key = rate_limit_key(request)
    second_key = rate_limit_key(request)

    assert first_key == second_key
