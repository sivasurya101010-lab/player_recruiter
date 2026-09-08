from django.urls import path

from .views import RegisterView, MyProfileView, LogoutView


urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MyProfileView.as_view(), name='my-profile'),
    path(('logout/'),LogoutView.as_view(), name='Logout')
]