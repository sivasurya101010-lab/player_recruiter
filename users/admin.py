from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class PlayLinkUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('PlayLink profile', {
            'fields': ('profile_picture', 'bio', 'location', 'phone_number'),
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('PlayLink profile', {
            'fields': ('profile_picture', 'bio', 'location', 'phone_number'),
        }),
    )

    list_display = (
        'username',
        'email',
        'first_name',
        'last_name',
        'is_staff',
        'is_active',
        'date_joined',
    )

    list_filter = (
        'is_staff',
        'is_active',
        'is_superuser',
    )

    search_fields = (
        'username',
        'email',
        'first_name',
        'last_name',
        'location',
        'phone_number',
    )

    ordering = ('-date_joined',)
