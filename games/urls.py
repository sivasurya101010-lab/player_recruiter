from django.urls import path

from .views import (
    GameCreateView,
    GameListView,
    GameDetailView,
    GameJoinView,
    GameLeaveView,
    GameUpdateView,
    GameDeleteView,
    GameCancelView,
    GamePlayersView,
)

urlpatterns = [
    path('create/', GameCreateView.as_view(), name='game-create'),
    path('', GameListView.as_view(), name='game-list'),
    path('<int:pk>/join/', GameJoinView.as_view(), name='game-join'),
    path('<int:pk>/leave/', GameLeaveView.as_view(), name='game-leave'),
    path('<int:pk>/cancel/', GameCancelView.as_view(), name='game-cancel'),
    path('<int:pk>/players/', GamePlayersView.as_view(), name='game-players'),
    path('<int:pk>/edit/', GameUpdateView.as_view(), name='game-edit'),
    path('<int:pk>/delete/', GameDeleteView.as_view(), name='game-delete'),
    path('<int:pk>/', GameDetailView.as_view(), name='game-detail'),
]
