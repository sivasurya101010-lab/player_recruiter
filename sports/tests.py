from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from .models import Sport


class SportTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.football = Sport.objects.create(name='Football',description='Football games',is_active=True)

        self.cricket = Sport.objects.create(name='Cricket',description='Cricket games',is_active=True)

        self.inactive_sport = Sport.objects.create(name='Inactive Sport',description='Not available',is_active=False)

    def test_sport_creation(self):
        self.assertEqual(Sport.objects.count(),3)

    def test_active_sports_are_returned(self):
        response = self.client.get('/api/sports/')

        self.assertEqual(response.status_code,status.HTTP_200_OK)

        self.assertEqual(len(response.data),2)

    def test_inactive_sport_is_not_returned(self):
        response = self.client.get('/api/sports/')

        names = [sport['name'] for sport in response.data]

        self.assertNotIn('Inactive Sport',names)