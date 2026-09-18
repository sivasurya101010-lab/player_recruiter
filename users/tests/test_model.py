from django.test import TestCase
from django.contrib.auth import get_user_model #safest way to acces the usweer model because here we have customised user model 




class UserModelTest(TestCase):

    def test_create_user(self):
        User = get_user_model()

        self.user = User.objects.create_user(username="surya",email="surya@example.com",password="TestPassword123")

        self.assertEqual(self.user.username, "surya")
        self.assertEqual(self.user.email, "surya@example.com")
        self.assertTrue(self.user.check_password("TestPassword123"))