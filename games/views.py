from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from .models import Game, GamePlayer
from .serializers import GameSerializer
from users.models import User
from users.serializers import UserSerializer


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

        with transaction.atomic():
            try:
                game = Game.objects.select_for_update().get(pk=pk)

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

class GameLeaveView(generics.GenericAPIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        try:
            game = Game.objects.get(pk=pk)

        except Game.DoesNotExist:
            return Response(
                {'detail': 'Game not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.creator_id == request.user.id:
            return Response(
                {'detail': 'Game creator cannot leave. Cancel the game instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        participation = game.participation.filter(user=request.user).first()

        if not participation:
            return Response(
                {'detail': 'You have not joined this game.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        participation.delete()

        if game.status == Game.Status.FULL:
            game.status = Game.Status.OPEN
            game.save(update_fields=['status', 'updated_at'])

        return Response(
            {'message': 'You left the game successfully.'},
            status=status.HTTP_200_OK
        )


class GameUpdateView(generics.RetrieveUpdateAPIView):

    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def update(self, request, *args, **kwargs):
        game = self.get_object()

        if game.creator_id != request.user.id:
            return Response(
                {'detail': 'Only the game creator can edit this game.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if game.status in [Game.Status.CANCELLED, Game.Status.COMPLETED]:
            return Response(
                {'detail': 'This game cannot be edited.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        response = super().update(request, *args, **kwargs)

        game = self.get_object()
        current_players = game.participation.count()

        if current_players >= game.players_needed:
            game.status = Game.Status.FULL
        else:
            game.status = Game.Status.OPEN

        game.save(update_fields=['status', 'updated_at'])

        return response


class GameDeleteView(generics.DestroyAPIView):

    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        game = self.get_object()

        if game.creator_id != request.user.id:
            return Response(
                {'detail': 'Only the game creator can delete this game.'},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().destroy(request, *args, **kwargs)


class GameCancelView(generics.GenericAPIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):

        try:
            game = Game.objects.get(pk=pk)

        except Game.DoesNotExist:
            return Response(
                {'detail': 'Game not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if game.creator_id != request.user.id:
            return Response(
                {'detail': 'Only the game creator can cancel this game.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if game.status in [Game.Status.CANCELLED, Game.Status.COMPLETED]:
            return Response(
                {'detail': 'This game cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        game.status = Game.Status.CANCELLED
        game.save(update_fields=['status', 'updated_at'])

        return Response(
            {'message': 'Game cancelled successfully.'},
            status=status.HTTP_200_OK
        )


class GamePlayersView(generics.ListAPIView):

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        game = generics.get_object_or_404(Game, pk=self.kwargs['pk'])
        return User.objects.filter(joined_games__game=game).order_by('username')
