from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User

class UserSerializer(serializers.ModelSerializer):

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

        extra_kwrgs={'password':{'write_only':True},  'validators': [validate_password],}

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User already exists")
        
        return


    def create(self, validated_data):
        user=User.objects.create_user(**validated_data)

        return user
            