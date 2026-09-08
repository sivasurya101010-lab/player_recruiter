from django.conf import settings
from django.db import models

from sports.models import Sports


class Game(models.Model):

    class Status(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        FULL = 'FULL', 'Full'
        CANCELLED = 'CANCELLED', 'Cancelled'
        COMPLETED = 'COMPLETED', 'Completed'

    creator = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='created_games')

    sport = models.ForeignKey(Sports,on_delete=models.PROTECT,related_name='games')

    custom_sport_name = models.CharField(max_length=100,blank=True)

    title = models.CharField(max_length=150)

    description = models.TextField(blank=True)

    date = models.DateField()

    start_time = models.TimeField()

    duration = models.PositiveIntegerField(help_text='Duration in minutes')

    location = models.CharField(max_length=500)

    players_needed = models.PositiveIntegerField()

    status = models.CharField(max_length=20,choices=Status.choices,default=Status.OPEN)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title