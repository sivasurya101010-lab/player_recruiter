import pytest
from rest_framework.test import APIClient

from sports.models import Sports


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def sports():
    football = Sports.objects.create(
        name='Football',
        description='Football games',
        is_active=True,
    )
    cricket = Sports.objects.create(
        name='Cricket',
        description='Cricket games',
        is_active=True,
    )
    Sports.objects.create(
        name='Inactive Sport',
        description='Not available',
        is_active=False,
    )
    return football, cricket


@pytest.mark.django_db
def test_active_sports_are_returned(api_client, sports):
    response = api_client.get('/api/sports/')

    assert response.status_code == 200
    assert len(response.data) == 2
    assert {sport['name'] for sport in response.data} == {'Football', 'Cricket'}


@pytest.mark.django_db
def test_inactive_sport_is_not_returned(api_client, sports):
    response = api_client.get('/api/sports/')

    names = [sport['name'] for sport in response.data]
    assert 'Inactive Sport' not in names


@pytest.mark.django_db
def test_sports_endpoint_does_not_require_authentication(api_client, sports):
    response = api_client.get('/api/sports/')

    assert response.status_code == 200


@pytest.mark.django_db
def test_sports_have_expected_fields(api_client, sports):
    response = api_client.get('/api/sports/')

    assert response.data[0]['name']
    assert 'description' in response.data[0]
    assert 'is_active' in response.data[0]
