from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def remove_orphan_push_tokens(apps, schema_editor):
    PushToken = apps.get_model('api', 'PushToken')
    PushToken.objects.filter(user__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_command_user_pushtoken_user_userprofile'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RunPython(remove_orphan_push_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pushtoken',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='push_tokens',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
