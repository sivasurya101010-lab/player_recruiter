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
def users():
    creator = User.objects.create_user(
        username='creator',
        email='creator@example.com',
        password='TestPassword123',
    )
    other = User.objects.create_user(
        username='other',
        email='other@example.com',
        password='TestPassword123',
    )
    return creator, other


@pytest.fixture
def game(users):
    creator, _ = users
    sport = Sports.objects.create(name='Football', is_active=True)

    game = Game.objects.create(
        creator=creator,
        sport=sport,
        title='Sunday Football',
        description='Test game',
        date='2026-10-10',
        start_time='07:00:00',
        duration=90,
        location='Palakkad Stadium',
        players_needed=3,
    )
    GamePlayer.objects.create(game=game, user=creator)
    return game


@pytest.mark.django_db
def test_unauthenticated_user_cannot_join_game(api_client, game):
    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 401


@pytest.mark.django_db
def test_unauthenticated_user_cannot_view_game_list(api_client):
    response = api_client.get('/api/game/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_non_creator_cannot_edit_game(api_client, users, game):
    _, other = users
    api_client.force_authenticate(user=other)

    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'title': 'Unauthorized change'},
        format='json',
    )

    assert response.status_code == 403
    game.refresh_from_db()
    assert game.title == 'Sunday Football'


@pytest.mark.django_db
def test_non_creator_cannot_cancel_game(api_client, users, game):
    _, other = users
    api_client.force_authenticate(user=other)

    response = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )

    assert response.status_code == 403
    game.refresh_from_db()
    assert game.status == Game.Status.OPEN


@pytest.mark.django_db
def test_non_creator_cannot_delete_game(api_client, users, game):
    _, other = users
    api_client.force_authenticate(user=other)

    response = api_client.delete(f'/api/game/{game.id}/delete/')

    assert response.status_code == 403
    assert Game.objects.filter(id=game.id).exists()


@pytest.mark.django_db
def test_cancelled_game_cannot_be_edited(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    cancel_response = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )
    assert cancel_response.status_code == 200

    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'title': 'Changed after cancellation'},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_cancelled_game_cannot_be_joined(api_client, users, game):
    creator, other = users
    api_client.force_authenticate(user=creator)

    cancel_response = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )
    assert cancel_response.status_code == 200

    api_client.force_authenticate(user=other)
    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_cancelled_game_cannot_be_cancelled_again(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    first = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )
    second = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )

    assert first.status_code == 200
    assert second.status_code == 400


@pytest.mark.django_db
def test_non_member_cannot_leave_game(api_client, users, game):
    _, other = users
    api_client.force_authenticate(user=other)

    response = api_client.post(
        f'/api/game/{game.id}/leave/',
        {},
        format='json',
    )

    assert response.status_code == 400
    assert GamePlayer.objects.filter(game=game, user=other).exists() is False
