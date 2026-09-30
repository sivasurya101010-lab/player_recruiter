from django.contrib import admin

from .models import Game, GamePlayer


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'sport',
        'creator',
        'date',
        'start_time',
        'players_needed',
        'status',
        'created_at',
    )
    list_filter = ('status', 'sport', 'date')
    search_fields = ('title', 'location', 'creator__username', 'creator__email')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(GamePlayer)
class GamePlayerAdmin(admin.ModelAdmin):
    list_display = ('game', 'user', 'joined_at')
    search_fields = ('game__title', 'user__username', 'user__email')
    readonly_fields = ('joined_at',)
    ordering = ('-joined_at',)
