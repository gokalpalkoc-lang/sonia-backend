from django.db import models


class Command(models.Model):
    """Model to store commands and their associated assistant information"""
    assistant_name = models.CharField(max_length=255)
    time = models.CharField(max_length=100)
    prompt = models.TextField()
    first_message = models.TextField(blank=True, null=True)
    assistant_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.assistant_name} - {self.time}"


class AssistantCall(models.Model):
    """Model to track when each assistant was last called"""
    assistant_id = models.CharField(max_length=255, unique=True)
    last_called_date = models.CharField(max_length=100)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.assistant_id} - {self.last_called_date}"


class PushToken(models.Model):
    """Stores Expo push tokens for registered devices"""
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.token
