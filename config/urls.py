from django.contrib import admin
from django.urls import path, include

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from users.views import LoginView, RefreshTokenView
from .web_views import home

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    path('api/auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', RefreshTokenView.as_view(), name='token_refresh'),

    path('api/auth/', include('users.urls')),
    path('api/sports/', include('sports.urls')),
    path('api/game/', include('games.urls')),
]
