from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

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

    def test_user_registration(self):
        response = self.client.post(
            '/api/auth/register/',
            self.user_data,
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            User.objects.filter(username='surya').exists()
        )

    def test_password_is_hashed(self):
        user = User.objects.create_user(
            username='surya',
            email='surya@test.com',
            password='TestPassword123'
        )

        self.assertNotEqual(
            user.password,
            'TestPassword123'
        )

        self.assertTrue(
            user.check_password('TestPassword123')
        )

    def test_duplicate_email_registration(self):
        User.objects.create_user(
            username='existing',
            email='surya@test.com',
            password='TestPassword123'
        )

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
        User.objects.create_user(
            username='surya',
            email='surya@test.com',
            password='TestPassword123'
        )

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