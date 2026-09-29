from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password as django_validate_password
from .models import User

from rest_framework_simplejwt.serializers import TokenBlacklistSerializer

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

    def create(self, validated_data): #we exciptly uses create method to hash pass (create_user hashes it)
        user=User.objects.create_user(**validated_data)

        return user
            
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


class LogoutSerializer(TokenBlacklistSerializer):
    pass