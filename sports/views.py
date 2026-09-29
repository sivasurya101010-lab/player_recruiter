from rest_framework import generics
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import Sports
from .serializers import SportSerializer


class SportView(generics.ListAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    queryset = Sports.objects.filter(is_active=True)
    serializer_class = SportSerializer

    @extend_schema(
        summary="List active sports",
        description="Return all sports currently marked as active. This endpoint is public.",
        responses={
            200: SportSerializer(many=True),
        },
        tags=["Sports"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
