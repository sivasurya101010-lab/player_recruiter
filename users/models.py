import uuid
from pathlib import Path

from django.db import models
from django.contrib.auth.models import AbstractUser


def profile_picture_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return f'profile_picture/{uuid.uuid4().hex}{extension}'


class User(AbstractUser):
    profile_picture=models.ImageField(upload_to=profile_picture_upload_to, null=True, blank=True)
    bio=models.CharField(max_length=50,blank=True)
    location=models.CharField(max_length=100,blank=True)
    phone_number=models.CharField(max_length=20,blank=True)