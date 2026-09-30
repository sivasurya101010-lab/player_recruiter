from django.urls import reverse

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password as django_validate_password
from .models import User

from rest_framework_simplejwt.serializers import TokenBlacklistSerializer


def profile_picture_url(serializer, user):
    if not user.profile_picture:
        return None

    request = serializer.context.get('request')
    path = reverse('profile-picture', kwargs={'pk': user.pk})

    if request:
        return request.build_absolute_uri(path)

    return path


class UserSerializer(serializers.ModelSerializer):

    password = serializers.CharField(write_only=True, validators=[django_validate_password])

    class Meta:
        model=User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'password',
            'profile_picture',
            'bio',
            'location',]

        extra_kwargs={'password': {'write_only': True}}

    def validate_password(self, value):
        django_validate_password(value)
        return value

    def validate_email(self, value):

        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User already exists")

        return value

    def create(self, validated_data):
        user=User.objects.create_user(**validated_data)
        return user

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['profile_picture'] = profile_picture_url(self, instance)
        return data


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'profile_picture',
            'bio',
            'location',
            'phone_number',
        ]
        read_only_fields = ['id', 'username']

    def validate_email(self, value):
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("User already exists")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['profile_picture'] = profile_picture_url(self, instance)
        return data


class LogoutSerializer(TokenBlacklistSerializer):
    pass
