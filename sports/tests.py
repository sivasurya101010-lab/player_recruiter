from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from .models import Sports


class SportTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.football = Sports.objects.get(name='Football')
        self.cricket = Sports.objects.get(name='Cricket')

        self.inactive_sport = Sports.objects.create(
            name='Inactive Sport Test',
            description='Not available',
            is_active=False
        )

    def test_sport_creation(self):
        self.assertEqual(Sports.objects.count(), 6)

    def test_active_sports_are_returned(self):
        response = self.client.get('/api/sports/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)

    def test_inactive_sport_is_not_returned(self):
        response = self.client.get('/api/sports/')

        names = [sport['name'] for sport in response.data]

        self.assertNotIn('Inactive Sport Test', names)
