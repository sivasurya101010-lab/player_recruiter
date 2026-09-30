from django.db import migrations


DEFAULT_SPORTS = [
    ('Cricket', 'Cricket games'),
    ('Football', 'Football games'),
    ('Tennis', 'Tennis games'),
    ('Badminton', 'Badminton games'),
    ('Other', 'Other sports'),
]


def seed_default_sports(apps, schema_editor):
    Sports = apps.get_model('sports', 'Sports')

    for name, description in DEFAULT_SPORTS:
        Sports.objects.get_or_create(
            name=name,
            defaults={
                'description': description,
                'is_active': True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('sports', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_sports, migrations.RunPython.noop),
    ]
