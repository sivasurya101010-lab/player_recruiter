from django.urls import path
from .views import GameCreateView,GameListView

urlpatterns=[path('create/',GameCreateView.as_view(),name="game-create"),
             path('',GameListView.as_view(),name='game-list'),

             ]