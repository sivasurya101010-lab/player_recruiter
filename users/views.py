from rest_framework import generics
from rest_framework_simplejwt.views import TokenBlacklistView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import User
from .serializers import UserSerializer, LogoutSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @extend_schema(
        summary="Register a user",
        description="Create a new PlayLink user account.",
        responses={
            201: UserSerializer,
            400: OpenApiResponse(description="Invalid registration data."),
        },
        tags=["Authentication"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class MyProfileView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get my profile",
        description="Return the profile of the currently authenticated user.",
        responses={
            200: UserSerializer,
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
        },
        tags=["Authentication"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user


class LogoutView(TokenBlacklistView):
    serializer_class = LogoutSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Logout",
        description="Blacklist the supplied refresh token so it can no longer be used to refresh an access token.",
        responses={
            200: OpenApiResponse(description="Refresh token blacklisted successfully."),
            400: OpenApiResponse(description="Invalid refresh token."),
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
        },
        tags=["Authentication"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)
