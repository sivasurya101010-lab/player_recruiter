from mimetypes import guess_type

from django.http import FileResponse
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.urls import reverse

from rest_framework import generics
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView
from rest_framework.permissions import AllowAny, IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .models import User
from .serializers import UserSerializer, ProfileSerializer, LogoutSerializer


class LoginView(TokenObtainPairView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        summary="Login",
        description="Authenticate with username and password and return access and refresh JWT tokens.",
        responses={
            200: OpenApiResponse(description="Access and refresh tokens returned successfully."),
            401: OpenApiResponse(description="Invalid username or password."),
        },
        auth=[],
        tags=["Authentication"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RefreshTokenView(TokenRefreshView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        summary="Refresh access token",
        description="Use a valid refresh token to obtain a new access token.",
        responses={
            200: OpenApiResponse(description="New access token returned successfully."),
            401: OpenApiResponse(description="Invalid or expired refresh token."),
        },
        auth=[],
        tags=["Authentication"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RegisterView(generics.CreateAPIView):
    authentication_classes = []
    permission_classes = []
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @extend_schema(
        summary="Register",
        description="Create a new PlayLink user account.",
        responses={
            201: UserSerializer,
            400: OpenApiResponse(description="Invalid registration data."),
        },
        auth=[],
        tags=["Authentication"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class MyProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Get and update my profile",
        description="Return or update the profile of the currently authenticated user.",
        responses={
            200: ProfileSerializer,
            401: OpenApiResponse(description="Authentication credentials were not provided or are invalid."),
        },
        tags=["Authentication"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        return self.request.user


class ProfilePictureView(generics.GenericAPIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk)

        if not user.profile_picture:
            return Response({'detail': 'Profile picture not found.'}, status=404)

        content_type = guess_type(user.profile_picture.name)[0] or 'application/octet-stream'

        try:
            response = FileResponse(
                user.profile_picture.open('rb'),
                content_type=content_type,
            )
        except FileNotFoundError:
            return Response({'detail': 'Profile picture file not found.'}, status=404)

        response['Cache-Control'] = 'public, max-age=86400'
        return response


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
