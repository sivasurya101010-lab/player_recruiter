from django.urls import path

from .views import SportView

urlpatterns=[path('',SportView.as_view(),name='sports-List',)

    ]