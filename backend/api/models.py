import uuid

from django.contrib.auth.models import User
from django.db import models


def generate_notification_uuid():
    """Generate a 16-character hex UUID for notification routing."""
    return uuid.uuid4().hex[:16]


class UserProfile(models.Model):
    """Extended user profile storing patient-specific data"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    patient_name = models.CharField(max_length=255, blank=True, default='')
    voice_id = models.CharField(max_length=255, blank=True, null=True)
    menu_pin = models.CharField(max_length=4, blank=True, default='',
        help_text='4-digit PIN used to gate access to the menu/commands page')
    assistant_id = models.CharField(max_length=255, blank=True, null=True,
        help_text='Single Vapi assistant ID for this user (created during voice setup)')
    active_command = models.ForeignKey(
        'Command', on_delete=models.SET_NULL, blank=True, null=True,
        related_name='+',
        help_text='Currently active command whose prompt is appended to the assistant'
    )
    notification_uuid = models.CharField(
        max_length=16, unique=True, default=generate_notification_uuid,
        help_text='16-char hex ID used by the AI module to send push notifications'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.patient_name}"


class Command(models.Model):
    """Model to store commands (prompt overlays for the user's single assistant)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='commands', null=True, blank=True)
    time = models.CharField(max_length=10, blank=True, default='')
    prompt = models.TextField()
    first_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Command {self.pk} - {self.time}"


class AssistantCall(models.Model):
    """Model to track when each assistant was last called"""
    assistant_id = models.CharField(max_length=255, unique=True)
    last_called_date = models.CharField(max_length=100, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.assistant_id} - {self.last_called_date}"


class PushToken(models.Model):
    """Stores Expo push tokens for registered devices"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.token
