from django.test import TestCase
from django.contrib.auth import get_user_model

from .models import Game, GamePlayer
from sports.models import Sports


User = get_user_model()


class GameTestCase(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='surya',email='surya@test.com',password='TestPassword123')

        self.sport = Sports.objects.create(name='Football')

    def test_game_creation(self):
        game = Game.objects.create(
            creator=self.user,
            sport=self.sport,
            title='Sunday Football',
            description='Casual football game',
            date='2026-09-20',
            start_time='07:00:00',
            duration=90,
            location='Palakkad Stadium',
            players_needed=7)

        GamePlayer.objects.create(game=game,user=self.user)

        self.assertEqual(game.creator, self.user)

        self.assertEqual(game.participation.count(),1)

        self.assertTrue(game.participation.filter(user=self.user).exists())