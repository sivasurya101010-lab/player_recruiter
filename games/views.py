from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Game, GamePlayer
from .serializers import GameSerializer


class GameCreateView(generics.CreateAPIView):
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        game = serializer.save(creator=self.request.user)
        GamePlayer.objects.create(user=self.request.user, game=game)


class GameListView(generics.ListAPIView):

    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Game.objects.all().order_by('-created_at')

        sport = self.request.query_params.get('sport')
        date = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')

        if sport:
            queryset = queryset.filter(sport_id=sport)

        if date:
            queryset = queryset.filter(date=date)

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset


class GameDetailView(generics.RetrieveAPIView):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]


class GameJoinView(generics.GenericAPIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        try:
            game = Game.objects.get(pk=pk)

        except Game.DoesNotExist:
            return Response(
                {'detail': 'game not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.status != Game.Status.OPEN:
            return Response(
                {'detail': 'Game is not available'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if game.participation.filter(user=request.user).exists():
            return Response(
                {'detail': 'Player already joined this game.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if game.participation.count() >= game.players_needed:
            game.status = Game.Status.FULL
            game.save(update_fields=['status', 'updated_at'])
            return Response(
                {'detail': 'Player slots are full'},
                status=status.HTTP_400_BAD_REQUEST
            )

        GamePlayer.objects.create(game=game, user=request.user)

        if game.participation.count() >= game.players_needed:
            game.status = Game.Status.FULL
            game.save(update_fields=['status', 'updated_at'])

        return Response(
            {'message': 'Successfully joined the game.'},
            status=status.HTTP_201_CREATED
        )
