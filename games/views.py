from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Game,GamePlayer
from .serializer import GameSerializer

class GameCreateView(generics.CreateAPIView):
    serializer_class=GameSerializer
    permission_classes=[IsAuthenticated]

    def perform_create(self, serializer):
        game=serializer.save(creator=self.request.user)

        GamePlayer.objects.create(user=self.request.user,game=game)

class GameListView(generics.ListAPIView):

    queryset=Game.objects.all().order_by('-created_at')
    serializer_class=GameSerializer
    permission_classes=[IsAuthenticated]





