from django.urls import path

from .views import RegisterView, MyProfileView, ProfilePictureView, LogoutView


urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MyProfileView.as_view(), name='my-profile'),
    path('profile-picture/<int:pk>/', ProfilePictureView.as_view(), name='profile-picture'),
    path(('logout/'),LogoutView.as_view(), name='Logout')
]
