from rest_framework import generics
from rest_framework_simplejwt.views import TokenBlacklistView


from .models import User
from .serializers import UserSerializer,LogoutSerializer

from rest_framework.permissions import IsAuthenticated

class RegisterView(generics.CreateAPIView):
    queryset=User.objects.all()
    serializer_class=UserSerializer

class MyProfileView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class LogoutView(TokenBlacklistView):
    serializer_class=LogoutSerializer
    permission_classes=[IsAuthenticated]

