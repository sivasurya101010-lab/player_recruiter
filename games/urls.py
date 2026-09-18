from django.urls import path
from .views import GameCreateView,GameListView,GameDetailView,GameJoinView

urlpatterns=[path('create/',GameCreateView.as_view(),name="game-create"),
             path('',GameListView.as_view(),name='game-list'),
             path('<int:pk>/',GameDetailView.as_view(),name='game-detail'),
             path('<int:pk>/',GameJoinView.as_view(),name='game-join')

             ]