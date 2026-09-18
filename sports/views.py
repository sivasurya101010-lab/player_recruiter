from rest_framework import generics

from .models import Sports
from .serializers import SportSerializer

class SportView(generics.ListAPIView):
    queryset=Sports.objects.filter(is_active=True)
    serializer_class=SportSerializer