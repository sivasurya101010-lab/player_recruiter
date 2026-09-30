import pytest
from concurrent.futures import ThreadPoolExecutor

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from rest_framework.test import APIClient

from games.models import Game, GamePlayer
from sports.models import Sports


User = get_user_model()


@pytest.mark.django_db(transaction=True)
def test_concurrent_joins_cannot_exceed_available_slots():
    creator = User.objects.create_user(
        username='creator_concurrent',
        email='creator_concurrent@example.com',
        password='TestPassword123',
    )
    player_one = User.objects.create_user(
        username='player_one_concurrent',
        email='player_one_concurrent@example.com',
        password='TestPassword123',
    )
    player_two = User.objects.create_user(
        username='player_two_concurrent',
        email='player_two_concurrent@example.com',
        password='TestPassword123',
    )

    sport = Sports.objects.get(name='Football')

    game = Game.objects.create(
        creator=creator,
        sport=sport,
        title='Concurrent Football',
        description='Concurrency test',
        date='2026-10-10',
        start_time='07:00:00',
        duration=90,
        location='Palakkad Stadium',
        players_needed=2,
    )
    GamePlayer.objects.create(game=game, user=creator)

    def join_game(user):
        close_old_connections()

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            f'/api/game/{game.id}/join/',
            {},
            format='json',
        )

        close_old_connections()
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                join_game,
                [player_one, player_two],
            )
        )

    game.refresh_from_db()

    assert sorted(results) == [201, 400]
    assert GamePlayer.objects.filter(game=game).count() == 2
    assert game.status == Game.Status.FULL
