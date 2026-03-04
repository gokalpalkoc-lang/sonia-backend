import uuid

from django.db import migrations, models

import api.models


def populate_notification_uuids(apps, schema_editor):
    """Assign unique notification_uuid to all existing UserProfile rows."""
    UserProfile = apps.get_model('api', 'UserProfile')
    for profile in UserProfile.objects.all():
        profile.notification_uuid = uuid.uuid4().hex[:16]
        profile.save(update_fields=['notification_uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_pushtoken_user_required'),
    ]

    operations = [
        # Step 1: Add the field as nullable (no unique yet)
        migrations.AddField(
            model_name='userprofile',
            name='notification_uuid',
            field=models.CharField(
                default=api.models.generate_notification_uuid,
                help_text='16-char hex ID used by the AI module to send push notifications',
                max_length=16,
                null=True,
            ),
        ),
        # Step 2: Backfill existing rows
        migrations.RunPython(populate_notification_uuids, migrations.RunPython.noop),
        # Step 3: Make it non-null + unique
        migrations.AlterField(
            model_name='userprofile',
            name='notification_uuid',
            field=models.CharField(
                default=api.models.generate_notification_uuid,
                help_text='16-char hex ID used by the AI module to send push notifications',
                max_length=16,
                unique=True,
            ),
        ),
    ]
