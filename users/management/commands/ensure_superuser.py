import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create or promote a PlayLink superuser from environment variables."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL", "")

        if not username or not password:
            raise CommandError(
                "DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD must be set."
            )

        User = get_user_model()
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "is_active": True,
                "is_staff": True,
                "is_superuser": True,
            },
        )

        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created Django superuser '{username}'."
                )
            )
            return

        changed = []

        if email and user.email != email:
            user.email = email
            changed.append("email")

        if not user.is_active:
            user.is_active = True
            changed.append("is_active")

        if not user.is_staff:
            user.is_staff = True
            changed.append("is_staff")

        if not user.is_superuser:
            user.is_superuser = True
            changed.append("is_superuser")

        # Keep the Render admin password synchronized with the value stored
        # in the Render environment. This also fixes an existing superuser
        # whose local/development password does not match production.
        if not user.check_password(password):
            user.set_password(password)
            changed.append("password")

        if changed:
            user.save(update_fields=changed)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Verified/updated Django superuser '{username}'."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Superuser '{username}' is already ready."
                )
            )
