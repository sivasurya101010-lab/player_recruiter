from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    profile_picture=models.ImageField(upload_to='profile_picture', null=True, blank=True)
    bio=models.CharField(max_length=50,blank=True)
    location=models.CharField(max_length=100,blank=True)