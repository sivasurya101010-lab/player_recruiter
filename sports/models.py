from django.db import models


class Sports(models.Model):
    name=models.CharField(max_length=50,unique=True)
    description=models.TextField(max_length=200,blank=True)
    is_active=models.BooleanField(default=True)

    def __str__(self):
        return self.name

