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


@pytest.mark.django_db
def test_openapi_schema_documents_jwt_authentication():
    client = APIClient()

    response = client.get('/api/schema/')

    assert response.status_code == 200

    schema = response.json()
    security_schemes = schema['components']['securitySchemes']

    assert 'jwtAuth' in security_schemes
    assert security_schemes['jwtAuth']['type'] == 'http'
    assert security_schemes['jwtAuth']['scheme'] == 'bearer'
    assert security_schemes['jwtAuth']['bearerFormat'] == 'JWT'


@pytest.mark.django_db
def test_openapi_marks_protected_and_public_endpoints_correctly():
    client = APIClient()

    response = client.get('/api/schema/')

    assert response.status_code == 200

    schema = response.json()
    paths = schema['paths']

    assert paths['/api/game/']['get']['security']
    assert paths['/api/game/create/']['post']['security']
    assert paths['/api/auth/me/']['get']['security']

    assert paths['/api/sports/']['get'].get('security', []) == []
    assert paths['/api/auth/login/']['post'].get('security', []) == []
    assert paths['/api/auth/register/']['post'].get('security', []) == []
