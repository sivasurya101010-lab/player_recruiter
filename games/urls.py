from django.urls import path
from .views import GameCreateView

urlpatterns=[path('',GameCreateView.as_view(),name="game-create")]