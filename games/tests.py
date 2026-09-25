from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import Game, GamePlayer
from sports.models import Sports


User = get_user_model()


class GameTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username='surya',
            email='surya@test.com',
            password='TestPassword123'
        )

        self.other_user = User.objects.create_user(
            username='player2',
            email='player2@test.com',
            password='TestPassword123'
        )

        self.sport = Sports.objects.create(name='Football')

        self.game_data = {
            'sport': self.sport.id,
            'title': 'Sunday Football',
            'description': 'Casual football game',
            'date': '2026-09-27',
            'start_time': '07:00:00',
            'duration': 90,
            'location': 'Palakkad Stadium',
            'players_needed': 3,
        }

        self.client.force_authenticate(user=self.user)

    def create_game(self):
        response = self.client.post(
            '/api/game/create/',
            self.game_data,
            format='json'
        )
        return response

    def test_game_creation_adds_creator_as_player(self):
        response = self.create_game()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        game = Game.objects.get(id=response.data['id'])

        self.assertEqual(game.creator, self.user)
        self.assertEqual(game.participation.count(), 1)
        self.assertTrue(
            game.participation.filter(user=self.user).exists()
        )

    def test_unauthenticated_user_cannot_create_game(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            '/api/game/create/',
            self.game_data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_game_list_returns_created_games(self):
        self.create_game()

        response = self.client.get('/api/game/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], 'Sunday Football')

    def test_game_detail_returns_game(self):
        create_response = self.create_game()

        response = self.client.get(
            f"/api/game/{create_response.data['id']}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Sunday Football')

    def test_join_game(self):
        create_response = self.create_game()
        game_id = create_response.data['id']

        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(
            f'/api/game/{game_id}/join/',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GamePlayer.objects.filter(game_id=game_id).count(), 2)

    def test_player_cannot_join_same_game_twice(self):
        create_response = self.create_game()
        game_id = create_response.data['id']

        self.client.force_authenticate(user=self.other_user)

        first_response = self.client.post(
            f'/api/game/{game_id}/join/',
            {},
            format='json'
        )
        second_response = self.client.post(
            f'/api/game/{game_id}/join/',
            {},
            format='json'
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(GamePlayer.objects.filter(game_id=game_id).count(), 2)

    def test_player_cannot_join_full_game(self):
        create_response = self.create_game()
        game_id = create_response.data['id']

        user3 = User.objects.create_user(
            username='player3',
            email='player3@test.com',
            password='TestPassword123'
        )

        user4 = User.objects.create_user(
            username='player4',
            email='player4@test.com',
            password='TestPassword123'
        )

        GamePlayer.objects.create(game_id=game_id, user=user3)

        self.client.force_authenticate(user=user4)

        response = self.client.post(
            f'/api/game/{game_id}/join/',
            {},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(GamePlayer.objects.filter(game_id=game_id).count(), 2)

    def test_game_filter_by_sport(self):
        self.create_game()

        response = self.client.get(
            f'/api/game/?sport={self.sport.id}'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_players_needed_must_be_positive(self):
        self.game_data['players_needed'] = 0

        response = self.create_game()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duration_must_be_positive(self):
        self.game_data['duration'] = 0

        response = self.create_game()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_other_sport_requires_custom_name(self):
        other = Sports.objects.create(name='Other')
        self.game_data['sport'] = other.id

        response = self.create_game()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('custom_sport_name', response.data)

    def test_other_sport_accepts_custom_name(self):
        other = Sports.objects.create(name='Other')
        self.game_data['sport'] = other.id
        self.game_data['custom_sport_name'] = 'Volleyball'

        response = self.create_game()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['custom_sport_name'], 'Volleyball')
