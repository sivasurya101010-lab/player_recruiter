import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_openapi_schema_contains_playlink_endpoints():
    client = APIClient()

    response = client.get('/api/schema/')

    assert response.status_code == 200

    schema = response.json()
    paths = schema['paths']

    assert '/api/auth/login/' in paths
    assert '/api/auth/refresh/' in paths
    assert '/api/auth/register/' in paths
    assert '/api/auth/me/' in paths
    assert '/api/auth/logout/' in paths
    assert '/api/sports/' in paths
    assert '/api/game/' in paths
    assert '/api/game/create/' in paths
    assert '/api/game/{id}/join/' in paths
    assert '/api/game/{id}/leave/' in paths
    assert '/api/game/{id}/cancel/' in paths
    assert '/api/game/{id}/players/' in paths
    assert '/api/game/{id}/edit/' in paths
    assert '/api/game/{id}/delete/' in paths
    assert '/api/game/{id}/' in paths
