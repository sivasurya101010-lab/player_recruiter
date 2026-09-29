import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from games.models import Game, GamePlayer
from sports.models import Sports


User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='edgeuser',
        email='edgeuser@example.com',
        password='TestPassword123',
    )


@pytest.fixture
def authenticated_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sport():
    return Sports.objects.create(name='Football', is_active=True)


@pytest.fixture
def game_data(sport):
    return {
        'sport': sport.id,
        'title': 'Edge Case Football',
        'description': 'Test game',
        'date': '2026-10-10',
        'start_time': '07:00:00',
        'duration': 90,
        'location': 'Palakkad Stadium',
        'players_needed': 3,
    }


@pytest.fixture
def game(authenticated_client, game_data, user):
    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )
    assert response.status_code == 201

    return response.data['id']


@pytest.mark.django_db
def test_create_game_with_missing_required_field(authenticated_client, game_data):
    game_data.pop('title')

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400
    assert 'title' in response.data


@pytest.mark.django_db
def test_create_game_with_invalid_sport_id(authenticated_client, game_data):
    game_data['sport'] = 999999

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_game_with_negative_duration(authenticated_client, game_data):
    game_data['duration'] = -10

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_game_with_negative_players_needed(authenticated_client, game_data):
    game_data['players_needed'] = -1

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_game_with_invalid_date(authenticated_client, game_data):
    game_data['date'] = 'not-a-date'

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_create_game_with_invalid_time(authenticated_client, game_data):
    game_data['start_time'] = 'not-a-time'

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_game_detail_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.get('/api/game/999999/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_join_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.post(
        '/api/game/999999/join/',
        {},
        format='json',
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_leave_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.post(
        '/api/game/999999/leave/',
        {},
        format='json',
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_edit_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.patch(
        '/api/game/999999/edit/',
        {'title': 'New title'},
        format='json',
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_cancel_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.post(
        '/api/game/999999/cancel/',
        {},
        format='json',
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_delete_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.delete('/api/game/999999/delete/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_players_returns_404_for_nonexistent_game(authenticated_client):
    response = authenticated_client.get('/api/game/999999/players/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_players_needed_zero_is_rejected(authenticated_client, game_data):
    game_data['players_needed'] = 0

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_duration_zero_is_rejected(authenticated_client, game_data):
    game_data['duration'] = 0

    response = authenticated_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_game_id_does_not_create_participant(authenticated_client, game):
    before_count = GamePlayer.objects.filter(game_id=game).count()

    response = authenticated_client.post(
        '/api/game/999999/join/',
        {},
        format='json',
    )

    after_count = GamePlayer.objects.filter(game_id=game).count()

    assert response.status_code == 404
    assert before_count == after_count
