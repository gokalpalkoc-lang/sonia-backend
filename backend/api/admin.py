from django.contrib import admin
from .models import Command, AssistantCall


@admin.register(Command)
class CommandAdmin(admin.ModelAdmin):
    list_display = ('assistant_name', 'time', 'assistant_id', 'created_at')
    search_fields = ('assistant_name', 'assistant_id')


@admin.register(AssistantCall)
class AssistantCallAdmin(admin.ModelAdmin):
    list_display = ('assistant_id', 'last_called_date', 'updated_at')
    search_fields = ('assistant_id',)
