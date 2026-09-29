import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='testuser',
        email='testuser@example.com',
        password='TestPassword123',
    )


@pytest.mark.django_db
def test_user_can_register(api_client):
    response = api_client.post(
        '/api/auth/register/',
        {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password': 'TestPassword123',
        },
        format='json',
    )

    assert response.status_code == 201
    assert User.objects.filter(username='newuser').exists()


@pytest.mark.django_db
def test_user_can_login(api_client, user):
    response = api_client.post(
        '/api/auth/login/',
        {
            'username': 'testuser',
            'password': 'TestPassword123',
        },
        format='json',
    )

    assert response.status_code == 200
    assert 'access' in response.data
    assert 'refresh' in response.data


@pytest.mark.django_db
def test_login_with_wrong_password_is_rejected(api_client, user):
    response = api_client.post(
        '/api/auth/login/',
        {
            'username': 'testuser',
            'password': 'WrongPassword123',
        },
        format='json',
    )

    assert response.status_code == 401
    assert 'access' not in response.data
    assert 'refresh' not in response.data


@pytest.mark.django_db
def test_login_with_nonexistent_username_is_rejected(api_client):
    response = api_client.post(
        '/api/auth/login/',
        {
            'username': 'doesnotexist',
            'password': 'TestPassword123',
        },
        format='json',
    )

    assert response.status_code == 401
    assert 'access' not in response.data
    assert 'refresh' not in response.data


@pytest.mark.django_db
def test_authenticated_user_can_view_profile(api_client, user):
    api_client.force_authenticate(user=user)

    response = api_client.get('/api/auth/me/')

    assert response.status_code == 200
    assert response.data['username'] == 'testuser'
    assert response.data['email'] == 'testuser@example.com'


@pytest.mark.django_db
def test_unauthenticated_user_cannot_view_profile(api_client):
    response = api_client.get('/api/auth/me/')

    assert response.status_code == 401
