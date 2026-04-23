"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    # Auth endpoints
    path('api/auth/register', views.register, name='register'),
    path('api/auth/token', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/profile', views.profile, name='profile'),
    path('api/auth/verify-pin', views.verify_pin, name='verify_pin'),
    # Protected API endpoints (require JWT)
    path('api/commands', views.commands, name='commands'),
    path('api/commands/activate', views.activate_command, name='activate_command'),
    path('api/commands/revert-prompt', views.revert_prompt, name='revert_prompt'),
    path('api/voice-clone', views.voice_clone, name='voice_clone'),
    path('api/register-push-token', views.register_push_token, name='register_push_token'),
    path('api/send-push', views.send_push_notification, name='send_push_notification'),
    # Public endpoints (no auth required)
    path('api/commands/called', views.update_called, name='update_called'),
    path('api/commands/last-called/<str:assistant_id>', views.get_last_called, name='get_last_called'),
    path('api/notify', views.notify_by_uuid, name='notify_by_uuid'),
    path('api/emergency-call', views.emergency_call, name='emergency_call'),
    path('api/analyze-frame', views.analyze_frame, name='analyze_frame'),
    path('api/calibrate-emotion', views.calibrate_emotion, name='calibrate_emotion'),
    path('api/calibration-status', views.calibration_status, name='calibration_status'),
    path('api/register-face', views.register_face, name='register_face'),
    path('api/emotion-history', views.emotion_history, name='emotion_history'),
    path('api/faces', views.list_faces, name='list_faces'),
    path('api/faces/delete', views.delete_face, name='delete_face'),
]

