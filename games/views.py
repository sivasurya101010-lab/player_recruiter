from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Game,GamePlayer
from .serializers import GameSerializer

from rest_framework import status
from rest_framework.response import Response



class GameCreateView(generics.CreateAPIView):
    serializer_class=GameSerializer
    permission_classes=[IsAuthenticated]

    def perform_create(self, serializer):
        game=serializer.save(creator=self.request.user)

        GamePlayer.objects.create(user=self.request.user,game=game)



class GameListView(generics.ListAPIView):
    
    serializer_class=GameSerializer
    permission_classes=[IsAuthenticated]

    def get_queryset(self):
        queryset=Game.objects.all().order_by('-created_at')


        #this recieves the value that is been passed throug parms
        sport=self.request.query_params.get('sport')
        date=self.request.query_params.get('date')
        status=self.request.query_params.get('status')

        if sport:
            queryset=queryset.filter(sport_id=sport)

        if date:
            queryset=queryset.filter(date=date)

        if status:
            queryset=queryset.filter(status=status)

        return queryset
    
        

class GameDetailView(generics.RetrieveAPIView):
    queryset=Game.objects.all()
    serializer_class=GameSerializer
    permission_classes=[IsAuthenticated]


class GameJoinView(generics.GenericAPIView):

    permission_classes=[IsAuthenticated]

    def post(self,request,pk):

        try:
            game=Game.objects.get(pk=pk)

        except Game.DoesNotExist:
           return Response( {'detail':'game not found'},status=status.HTTP_404_NOT_FOUND)


        if game.status!=Game.Status.OPEN:
            return Response({'details':'Game is not available'},status=status.HTTP_400_BAD_REQUEST)

        if game.participation.filter(user=request.user).exists():
            return Response({'details':'player alraedy exists'})

         #here game.participations=gamepalyer table accessed using the foreing key reverse relation
        if game.participation.count()>=game.players_needed:
            return Response({'details':'palyer slots are full'},status=status.HTTP_400_BAD_REQUEST)

        GamePlayer.objects.create(game=game,user=request.user)

        return Response({'message': 'Successfully joined the game.'},status=status.HTTP_201_CREATED)







