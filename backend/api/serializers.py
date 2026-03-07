from django.contrib.auth.models import User
from rest_framework import serializers

from .models import UserProfile


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    patient_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Bu kullanıcı adı zaten alınmış.")
        return value

    def create(self, validated_data):
        patient_name = validated_data.pop('patient_name', '')
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
        )
        UserProfile.objects.create(user=user, patient_name=patient_name)
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    voice_id = serializers.CharField(allow_null=True, allow_blank=True, required=False)
    patient_name = serializers.CharField(allow_blank=True, required=False)
    notification_uuid = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = ['username', 'patient_name', 'voice_id', 'notification_uuid', 'created_at']
        read_only_fields = ['username', 'notification_uuid', 'created_at']
