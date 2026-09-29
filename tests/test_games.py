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
    player = User.objects.create_user(
        username='player',
        email='player@example.com',
        password='TestPassword123',
    )
    return creator, player


@pytest.fixture
def sport():
    return Sports.objects.create(
        name='Football',
        description='Football games',
        is_active=True,
    )


@pytest.fixture
def game_data(sport):
    return {
        'sport': sport.id,
        'title': 'Sunday Football',
        'description': 'Casual football game',
        'date': '2026-10-10',
        'start_time': '07:00:00',
        'duration': 90,
        'location': 'Palakkad Stadium',
        'players_needed': 3,
    }


@pytest.fixture
def game(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )
    assert response.status_code == 201
    return Game.objects.get(id=response.data['id'])


@pytest.mark.django_db
def test_unauthenticated_user_cannot_create_game(api_client, game_data):
    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_game_creation_adds_creator_as_player(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 201
    created_game = Game.objects.get(id=response.data['id'])
    assert created_game.creator == creator
    assert created_game.participation.count() == 1
    assert created_game.participation.filter(user=creator).exists()


@pytest.mark.django_db
def test_game_detail_returns_game(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get(f'/api/game/{game.id}/')

    assert response.status_code == 200
    assert response.data['title'] == 'Sunday Football'
    assert response.data['is_creator'] is True
    assert response.data['is_joined'] is True


@pytest.mark.django_db
def test_game_list_returns_created_games(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get('/api/game/')

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['title'] == 'Sunday Football'
    assert response.data[0]['current_players'] == 1
    assert response.data[0]['available_slots'] == 2


@pytest.mark.django_db
def test_game_list_is_newest_first(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    first = api_client.post('/api/game/create/', game_data, format='json')
    game_data['title'] = 'Newer Football'
    second = api_client.post('/api/game/create/', game_data, format='json')

    assert first.status_code == 201
    assert second.status_code == 201

    response = api_client.get('/api/game/')

    assert response.status_code == 200
    assert response.data[0]['title'] == 'Newer Football'
    assert response.data[1]['title'] == 'Sunday Football'


@pytest.mark.django_db
def test_game_can_be_filtered_by_sport(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get(f'/api/game/?sport={game.sport_id}')

    assert response.status_code == 200
    assert len(response.data) == 1
    assert response.data[0]['id'] == game.id


@pytest.mark.django_db
def test_game_can_be_filtered_by_date(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get('/api/game/?date=2026-10-10')

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_game_can_be_filtered_by_status(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get('/api/game/?status=OPEN')

    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_players_needed_must_be_positive(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    game_data['players_needed'] = 0

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_duration_must_be_positive(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    game_data['duration'] = 0

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_other_sport_requires_custom_name(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    other = Sports.objects.create(name='Other', is_active=True)
    game_data['sport'] = other.id

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400
    assert 'custom_sport_name' in response.data


@pytest.mark.django_db
def test_other_sport_accepts_custom_name(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    other = Sports.objects.create(name='Other', is_active=True)
    game_data['sport'] = other.id
    game_data['custom_sport_name'] = 'Volleyball'

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 201
    assert response.data['custom_sport_name'] == 'Volleyball'


@pytest.mark.django_db
def test_inactive_sport_cannot_be_used(api_client, users, game_data):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    inactive = Sports.objects.create(name='Inactive', is_active=False)
    game_data['sport'] = inactive.id

    response = api_client.post(
        '/api/game/create/',
        game_data,
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_player_can_join_game(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=player)

    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 201
    assert GamePlayer.objects.filter(game=game, user=player).exists()


@pytest.mark.django_db
def test_player_cannot_join_same_game_twice(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)

    first = api_client.post(f'/api/game/{game.id}/join/', {}, format='json')
    second = api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    assert first.status_code == 201
    assert second.status_code == 400
    assert GamePlayer.objects.filter(game=game, user=player).count() == 1


@pytest.mark.django_db
def test_game_becomes_full_when_last_slot_is_joined(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=player)

    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 201

    third_user = User.objects.create_user(
        username='player3',
        email='player3@example.com',
        password='TestPassword123',
    )
    api_client.force_authenticate(user=third_user)

    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 201
    game.refresh_from_db()
    assert game.status == Game.Status.FULL


@pytest.mark.django_db
def test_player_cannot_join_full_game(api_client, users, game):
    _, player = users

    extra1 = User.objects.create_user(
        username='extra1',
        email='extra1@example.com',
        password='TestPassword123',
    )
    extra2 = User.objects.create_user(
        username='extra2',
        email='extra2@example.com',
        password='TestPassword123',
    )
    GamePlayer.objects.create(game=game, user=extra1)
    GamePlayer.objects.create(game=game, user=extra2)
    game.status = Game.Status.FULL
    game.save(update_fields=['status'])

    api_client.force_authenticate(user=player)
    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_player_can_leave_game(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)
    api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    response = api_client.post(
        f'/api/game/{game.id}/leave/',
        {},
        format='json',
    )

    assert response.status_code == 200
    assert not GamePlayer.objects.filter(game=game, user=player).exists()


@pytest.mark.django_db
def test_creator_cannot_leave_game(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.post(
        f'/api/game/{game.id}/leave/',
        {},
        format='json',
    )

    assert response.status_code == 400
    assert GamePlayer.objects.filter(game=game, user=creator).exists()


@pytest.mark.django_db
def test_player_cannot_leave_without_joining(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)

    response = api_client.post(
        f'/api/game/{game.id}/leave/',
        {},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_only_creator_can_edit_game(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)

    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'title': 'Changed title'},
        format='json',
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_creator_can_edit_game(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'title': 'Changed title'},
        format='json',
    )

    assert response.status_code == 200
    assert response.data['title'] == 'Changed title'


@pytest.mark.django_db
def test_cannot_reduce_players_needed_below_current_players(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=player)
    api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    api_client.force_authenticate(user=creator)
    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'players_needed': 1},
        format='json',
    )

    assert response.status_code == 400
    assert 'players_needed' in response.data


@pytest.mark.django_db
def test_editing_full_game_to_add_slots_reopens_game(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=player)
    api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    third_user = User.objects.create_user(
        username='player3',
        email='player3@example.com',
        password='TestPassword123',
    )
    api_client.force_authenticate(user=third_user)
    api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    game.refresh_from_db()
    assert game.status == Game.Status.FULL

    api_client.force_authenticate(user=creator)
    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'players_needed': 4},
        format='json',
    )

    assert response.status_code == 200
    game.refresh_from_db()
    assert game.status == Game.Status.OPEN


@pytest.mark.django_db
def test_creator_can_cancel_game(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )

    assert response.status_code == 200
    game.refresh_from_db()
    assert game.status == Game.Status.CANCELLED


@pytest.mark.django_db
def test_only_creator_can_cancel_game(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)

    response = api_client.post(
        f'/api/game/{game.id}/cancel/',
        {},
        format='json',
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_cancelled_game_cannot_be_joined(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=creator)
    api_client.post(f'/api/game/{game.id}/cancel/', {}, format='json')

    api_client.force_authenticate(user=player)
    response = api_client.post(
        f'/api/game/{game.id}/join/',
        {},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_cancel_game_cannot_be_cancelled_twice(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    first = api_client.post(f'/api/game/{game.id}/cancel/', {}, format='json')
    second = api_client.post(f'/api/game/{game.id}/cancel/', {}, format='json')

    assert first.status_code == 200
    assert second.status_code == 400


@pytest.mark.django_db
def test_cancelled_game_cannot_be_edited(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)
    api_client.post(f'/api/game/{game.id}/cancel/', {}, format='json')

    response = api_client.patch(
        f'/api/game/{game.id}/edit/',
        {'title': 'Changed title'},
        format='json',
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_only_creator_can_delete_game(api_client, users, game):
    _, player = users
    api_client.force_authenticate(user=player)

    response = api_client.delete(f'/api/game/{game.id}/delete/')

    assert response.status_code == 403
    assert Game.objects.filter(id=game.id).exists()


@pytest.mark.django_db
def test_creator_can_delete_game(api_client, users, game):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.delete(f'/api/game/{game.id}/delete/')

    assert response.status_code == 204
    assert not Game.objects.filter(id=game.id).exists()


@pytest.mark.django_db
def test_player_can_view_game_players(api_client, users, game):
    creator, player = users
    api_client.force_authenticate(user=player)
    api_client.post(f'/api/game/{game.id}/join/', {}, format='json')

    response = api_client.get(f'/api/game/{game.id}/players/')

    assert response.status_code == 200
    usernames = {item['username'] for item in response.data}
    assert usernames == {creator.username, player.username}


@pytest.mark.django_db
def test_unauthenticated_user_cannot_view_game_players(api_client, game):
    api_client.force_authenticate(user=None)
    response = api_client.get(f'/api/game/{game.id}/players/')
    assert response.status_code == 401


@pytest.mark.django_db
def test_nonexistent_game_returns_404(api_client, users):
    creator, _ = users
    api_client.force_authenticate(user=creator)

    response = api_client.get('/api/game/999999/')

    assert response.status_code == 404


@pytest.mark.django_db
def test_nonexistent_game_cannot_be_joined(api_client, users):
    _, player = users
    api_client.force_authenticate(user=player)

    response = api_client.post('/api/game/999999/join/', {}, format='json')

    assert response.status_code == 404
