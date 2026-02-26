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
from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/commands', views.commands, name='commands'),
    path('api/commands/called', views.update_called, name='update_called'),
    path('api/commands/last-called/<str:assistant_id>', views.get_last_called, name='get_last_called'),
    path('api/voice-clone', views.voice_clone, name='voice_clone'),
    path('api/register-push-token', views.register_push_token, name='register_push_token'),
    path('api/send-push', views.send_push_notification, name='send_push_notification'),
]
