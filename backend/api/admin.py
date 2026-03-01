from django.contrib import admin
from .models import Command, AssistantCall, UserProfile, PushToken


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'patient_name', 'voice_id', 'created_at')
    search_fields = ('user__username', 'patient_name')


@admin.register(Command)
class CommandAdmin(admin.ModelAdmin):
    list_display = ('assistant_name', 'time', 'assistant_id', 'user', 'created_at')
    search_fields = ('assistant_name', 'assistant_id', 'user__username')


@admin.register(AssistantCall)
class AssistantCallAdmin(admin.ModelAdmin):
    list_display = ('assistant_id', 'last_called_date', 'updated_at')
    search_fields = ('assistant_id',)


@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ('token', 'user', 'created_at')
    search_fields = ('token', 'user__username')
