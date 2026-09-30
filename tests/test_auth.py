import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken


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
def test_registered_password_is_hashed(api_client):
    api_client.post(
        '/api/auth/register/',
        {
            'username': 'hashuser',
            'email': 'hashuser@example.com',
            'password': 'TestPassword123',
        },
        format='json',
    )

    user = User.objects.get(username='hashuser')
    assert user.password != 'TestPassword123'
    assert user.check_password('TestPassword123')


@pytest.mark.django_db
def test_duplicate_email_registration_is_rejected(api_client, user):
    response = api_client.post(
        '/api/auth/register/',
        {
            'username': 'anotheruser',
            'email': 'testuser@example.com',
            'password': 'TestPassword123',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'email' in response.data


@pytest.mark.django_db
def test_duplicate_username_registration_is_rejected(api_client, user):
    response = api_client.post(
        '/api/auth/register/',
        {
            'username': 'testuser',
            'email': 'another@example.com',
            'password': 'TestPassword123',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'username' in response.data


@pytest.mark.django_db
def test_weak_password_registration_is_rejected(api_client):
    response = api_client.post(
        '/api/auth/register/',
        {
            'username': 'weakuser',
            'email': 'weak@example.com',
            'password': '123',
        },
        format='json',
    )

    assert response.status_code == 400
    assert 'password' in response.data


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


@pytest.mark.django_db
def test_refresh_token_can_restore_session(api_client, user):
    login_response = api_client.post(
        '/api/auth/login/',
        {
            'username': 'testuser',
            'password': 'TestPassword123',
        },
        format='json',
    )

    response = api_client.post(
        '/api/auth/refresh/',
        {'refresh': login_response.data['refresh']},
        format='json',
    )

    assert response.status_code == 200
    assert 'access' in response.data


@pytest.mark.django_db
def test_invalid_refresh_token_is_rejected(api_client):
    response = api_client.post(
        '/api/auth/refresh/',
        {'refresh': 'invalid-token'},
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        '/api/auth/logout/',
        {'refresh': str(refresh)},
        format='json',
    )

    assert response.status_code == 200

    refresh_response = api_client.post(
        '/api/auth/refresh/',
        {'refresh': str(refresh)},
        format='json',
    )

    assert refresh_response.status_code == 401


@pytest.mark.django_db
def test_authenticated_user_can_update_profile(api_client, user):
    api_client.force_authenticate(user=user)

    response = api_client.patch(
        '/api/auth/me/',
        {
            'first_name': 'Test',
            'last_name': 'Player',
            'email': 'updated@example.com',
            'location': 'Palakkad',
            'bio': 'Football player',
        },
        format='json',
    )

    assert response.status_code == 200
    assert response.data['first_name'] == 'Test'
    assert response.data['last_name'] == 'Player'
    assert response.data['email'] == 'updated@example.com'
    assert response.data['location'] == 'Palakkad'
    assert response.data['bio'] == 'Football player'

    user.refresh_from_db()
    assert user.first_name == 'Test'
    assert user.last_name == 'Player'
    assert user.email == 'updated@example.com'
    assert user.location == 'Palakkad'
    assert user.bio == 'Football player'


@pytest.mark.django_db
def test_user_cannot_update_profile_with_existing_email(api_client, user):
    other_user = User.objects.create_user(
        username='otheruser',
        email='other@example.com',
        password='TestPassword123',
    )
    api_client.force_authenticate(user=user)

    response = api_client.patch(
        '/api/auth/me/',
        {'email': other_user.email},
        format='json',
    )

    assert response.status_code == 400
    assert 'email' in response.data


@pytest.mark.django_db
def test_unauthenticated_user_cannot_update_profile(api_client):
    response = api_client.patch(
        '/api/auth/me/',
        {'first_name': 'Blocked'},
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_authenticated_user_can_update_phone_number(api_client, user):
    api_client.force_authenticate(user=user)

    response = api_client.patch(
        '/api/auth/me/',
        {'phone_number': '+91 9876543210'},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['phone_number'] == '+91 9876543210'

    user.refresh_from_db()
    assert user.phone_number == '+91 9876543210'


@pytest.mark.django_db
def test_authenticated_user_can_upload_profile_picture(api_client, user):
    api_client.force_authenticate(user=user)

    image = SimpleUploadedFile(
        'profile.png',
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0dIDAT\x08\x99c\x60\x60\x60\x00\x00\x00\x04\x00\x01\x00\x0b\x02\x02\x00\x00\x00\x00IEND\xaeB\x60\x82',
        content_type='image/png',
    )

    response = api_client.patch(
        '/api/auth/me/',
        {'profile_picture': image},
        format='multipart',
    )

    assert response.status_code == 200
    assert response.data['profile_picture']
    user.refresh_from_db()
    assert user.profile_picture.name.startswith('profile_picture/')
