from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse

from .models import Game, GamePlayer
from .filters import GameFilter
from django_filters.rest_framework import DjangoFilterBackend
from .serializers import GameSerializer
from users.models import User
from users.serializers import UserSerializer


class GameCreateView(generics.CreateAPIView):
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Create a new game",
        description="Create a sports game. The authenticated user becomes the creator and is automatically added as a participant.",
        responses={
            201: GameSerializer,
            400: OpenApiResponse(description="Invalid game data."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
        },
        tags=["Games"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        game = serializer.save(creator=self.request.user)
        GamePlayer.objects.create(user=self.request.user, game=game)


class GameListView(generics.ListAPIView):

    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_class = GameFilter

    @extend_schema(
        summary="List games",
        description="Return games ordered from newest to oldest. Optional filters can be used for sport, date, and status.",
        parameters=[
            OpenApiParameter(
                name="sport",
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter by sport ID.",
            ),
            OpenApiParameter(
                name="date",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter by game date in YYYY-MM-DD format.",
            ),
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Filter by game status: OPEN, FULL, CANCELLED, or COMPLETED.",
            ),
        ],
        responses={
            200: GameSerializer(many=True),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
        },
        tags=["Games"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return Game.objects.select_related('creator', 'sport').prefetch_related('participation').order_by('-created_at')


class GameDetailView(generics.RetrieveAPIView):
    queryset = Game.objects.all()
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get game details",
        description="Return the details of a specific game.",
        responses={
            200: GameSerializer,
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class GameJoinView(generics.GenericAPIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Join a game",
        description="Join an open game. A player cannot join the same game twice, and a full game cannot accept new players.",
        request=None,
        responses={
            201: OpenApiResponse(description="Player successfully joined the game."),
            400: OpenApiResponse(description="Game is unavailable, already joined, or has no available slots."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
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

    @extend_schema(
        summary="Leave a game",
        description="Remove the authenticated user from a game. The game creator cannot leave their own game.",
        request=None,
        responses={
            200: OpenApiResponse(description="Player successfully left the game."),
            400: OpenApiResponse(description="User has not joined the game or is the game creator."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
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

    @extend_schema(
        summary="Edit a game",
        description="Update a game. Only the game creator can edit it, and cancelled or completed games cannot be edited.",
        request=GameSerializer,
        responses={
            200: GameSerializer,
            400: OpenApiResponse(description="Game cannot be edited or submitted data is invalid."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            403: OpenApiResponse(description="Only the game creator can edit the game."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

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

    @extend_schema(
        summary="Delete a game",
        description="Delete a game. Only the game creator can delete it.",
        responses={
            204: OpenApiResponse(description="Game deleted successfully."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            403: OpenApiResponse(description="Only the game creator can delete the game."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)

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

    @extend_schema(
        summary="Cancel a game",
        description="Cancel a game. Only the creator can cancel it, and cancelled or completed games cannot be cancelled again.",
        request=None,
        responses={
            200: OpenApiResponse(description="Game cancelled successfully."),
            400: OpenApiResponse(description="Game is already cancelled or completed."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            403: OpenApiResponse(description="Only the game creator can cancel the game."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
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

    @extend_schema(
        summary="List game players",
        description="Return all players who have joined a specific game, ordered by username.",
        responses={
            200: UserSerializer(many=True),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
            404: OpenApiResponse(description="Game was not found."),
        },
        tags=["Games"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        game = generics.get_object_or_404(Game, pk=self.kwargs['pk'])
        return User.objects.filter(joined_games__game=game).order_by('username')
