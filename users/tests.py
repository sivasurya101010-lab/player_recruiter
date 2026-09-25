from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class UserTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()

        self.user_data = {
            'username': 'surya',
            'email': 'surya@test.com',
            'password': 'TestPassword123',
            'first_name': 'Surya',
            'last_name': 'Prakash',
        }

    def create_user(self):
        return User.objects.create_user(
            username='surya',
            email='surya@test.com',
            password='TestPassword123',
            first_name='Surya',
            last_name='Prakash'
        )

    def test_user_registration(self):
        response = self.client.post(
            '/api/auth/register/',
            self.user_data,
            format='json'
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )
        self.assertTrue(
            User.objects.filter(username='surya').exists()
        )

    def test_password_is_hashed(self):
        user = self.create_user()

        self.assertNotEqual(
            user.password,
            'TestPassword123'
        )

        self.assertTrue(
            user.check_password('TestPassword123')
        )

    def test_duplicate_email_registration(self):
        self.create_user()

        response = self.client.post(
            '/api/auth/register/',
            self.user_data,
            format='json'
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST
        )

    def test_login(self):
        self.create_user()

        response = self.client.post(
            '/api/auth/login/',
            {
                'username': 'surya',
                'password': 'TestPassword123'
            },
            format='json'
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_authenticated_user_can_view_profile(self):
        user = self.create_user()
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )
        self.assertEqual(response.data['username'], 'surya')
        self.assertEqual(response.data['email'], 'surya@test.com')

    def test_unauthenticated_user_cannot_view_profile(self):
        response = self.client.get('/api/auth/me/')

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

    def test_logout_blacklists_refresh_token(self):
        user = self.create_user()
        refresh = RefreshToken.for_user(user)

        self.client.force_authenticate(user=user)

        response = self.client.post(
            '/api/auth/logout/',
            {'refresh': str(refresh)},
            format='json'
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK
        )

        refresh_check = self.client.post(
            '/api/auth/refresh/',
            {'refresh': str(refresh)},
            format='json'
        )

        self.assertEqual(
            refresh_check.status_code,
            status.HTTP_401_UNAUTHORIZED
        )
