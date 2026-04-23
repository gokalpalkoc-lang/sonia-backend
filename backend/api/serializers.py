from django.contrib.auth.models import User
from rest_framework import serializers

from .models import UserProfile


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    patient_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    menu_pin = serializers.CharField(max_length=4, required=False, allow_blank=True, default='')

    def validate_username(self, value):
        value = value.strip().lower()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Bu kullanıcı adı zaten alınmış.")
        return value

    def validate_menu_pin(self, value):
        if value and (len(value) != 4 or not value.isdigit()):
            raise serializers.ValidationError("PIN must be exactly 4 digits.")
        return value

    def create(self, validated_data):
        patient_name = validated_data.pop('patient_name', '')
        menu_pin = validated_data.pop('menu_pin', '')
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        UserProfile.objects.create(user=user, patient_name=patient_name, menu_pin=menu_pin)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    voice_id = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    patient_name = serializers.CharField(allow_blank=True, required=False)
    notification_uuid = serializers.CharField(read_only=True)
    assistant_id = serializers.CharField(allow_null=True, allow_blank=True, required=False)

    class Meta:
        model = UserProfile
        fields = ['username', 'patient_name', 'voice_id', 'assistant_id', 'notification_uuid', 'created_at']
        read_only_fields = ['username', 'notification_uuid', 'created_at']
