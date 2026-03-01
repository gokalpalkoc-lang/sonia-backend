import json
import logging
import os
from functools import wraps
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from elevenlabs.client import ElevenLabs
from io import BytesIO
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from elevenlabs.core import RequestOptions

from .models import Command, AssistantCall, UserProfile
from .serializers import RegisterSerializer, UserProfileSerializer

# Vapi API configuration
VAPI_API_KEY = "475a65ff-0aa5-4dac-b9f2-52a16f2c7bba"
ELEVENLABS_VOICE_ID = "Mh8FUpRrhM4iDFS1KYre"  # Default fallback voice
ELEVENLABS_API_KEY = "069214e1931c84b9c4d46715216d5d3cf5c49427c7c7c3b2b6fc865a29c53eeb"  # TODO: Replace with your ElevenLabs API key

logger = logging.getLogger(__name__)

with open("api/master_prompt.txt", "r", encoding="utf-8") as f:
    MASTER_PROMPT = f.read()


def jwt_required(func):
    """Decorator that validates JWT token and sets request.user."""
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        auth = JWTAuthentication()
        try:
            result = auth.authenticate(request)
            if result is None:
                return JsonResponse({'success': False, 'error': 'Authentication required'}, status=401)
            request.user, _ = result
        except (InvalidToken, TokenError) as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=401)
        return func(request, *args, **kwargs)
    return wrapper


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    """Register a new user account"""
    try:
        data = json.loads(request.body)
        serializer = RegisterSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse({'success': True, 'message': 'Hesap oluşturuldu'}, status=201)
        return JsonResponse({'success': False, 'errors': serializer.errors}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error registering user: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "PUT"])
@jwt_required
def profile(request):
    """Get or update the authenticated user's profile"""
    try:
        user_profile, _ = UserProfile.objects.get_or_create(user=request.user)

        if request.method == 'GET':
            serializer = UserProfileSerializer(user_profile)
            return JsonResponse({'success': True, 'profile': serializer.data})

        if request.method == 'PUT':
            data = json.loads(request.body)
            serializer = UserProfileSerializer(user_profile, data=data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return JsonResponse({'success': True, 'profile': serializer.data})
            return JsonResponse({'success': False, 'errors': serializer.errors}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error accessing profile: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@jwt_required
def commands(request):
    """Handle GET and POST requests for commands"""

    # Handle GET request - return commands for this user
    if request.method == 'GET':
        user_commands = Command.objects.filter(user=request.user).order_by('-created_at')
        command_list = []
        for cmd in user_commands:
            command_data = {
                'assistantName': cmd.assistant_name,
                'time': cmd.time,
                'prompt': cmd.prompt,
                'firstMessage': cmd.first_message,
                'assistantId': cmd.assistant_id,
            }
            command_list.append(command_data)
        return JsonResponse({'commands': command_list})

    # Handle POST request - create assistant and store command
    if request.method == 'POST':
        try:
            # Parse JSON body
            data = json.loads(request.body)
            assistant_name = data.get('assistantName')
            time = data.get('time')
            prompt = data.get('prompt')
            first_message = data.get('firstMessage')
            voice_id = data.get('voiceId') or ELEVENLABS_VOICE_ID  # Use cloned voice or fallback

            logger.info(f'Command received from Sonia:')
            logger.info(f'   Assistant Name: {assistant_name}')
            logger.info(f'   Time: {time}')
            logger.info(f'   System Prompt: {prompt}')
            logger.info(f'   First Message: {first_message}')

            # Create assistant with Vapi API
            assistant_id = None
            try:
                import requests
                create_assistant_response = requests.post(
                    'https://api.vapi.ai/assistant',
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {VAPI_API_KEY}',
                    },
                    json={
                        'name': assistant_name,
                        'model': {
                            'provider': 'openai',
                            'model': 'gpt-5.2-chat-latest',
                            'systemPrompt': f"{MASTER_PROMPT}\n\n{prompt}",
                            'maxTokens': 800,
                        },
                        'voice': {
                            'provider': '11labs',
                            'voiceId': voice_id,
                            'language': "tr",
                            "model": "eleven_turbo_v2_5"
                        },
                        'transcriber': {
                            'provider': '11labs',
                            'language': 'tr',
                            'model': "scribe_v1"
                        },
                        'firstMessage': first_message,
                    },
                    timeout=30
                )

                if create_assistant_response.ok:
                    assistant_data = create_assistant_response.json()
                    assistant_id = assistant_data.get('id')
                    logger.info(f'Created new assistant: {assistant_id}')
                else:
                    logger.error(f'Response: {create_assistant_response}')
            except Exception as e:
                logger.error(f'Error creating assistant: {e}')

            # Store the command in database, linked to this user
            command = Command.objects.create(
                user=request.user,
                assistant_name=assistant_name,
                time=time,
                prompt=prompt,
                first_message=first_message,
                assistant_id=assistant_id
            )

            return JsonResponse({
                'success': True,
                'message': 'Komut alındı ve asistan oluşturuldu',
                'assistantId': assistant_id
            })
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Geçersiz JSON'})
        except Exception as e:
            logger.error(f'Error parsing command: {e}')
            return JsonResponse({'success': False, 'error': str(e)})


@csrf_exempt
@require_http_methods(["PUT"])
def update_called(request):
    """Handle PUT request to update last called date for an assistant (no auth required)"""
    try:
        data = json.loads(request.body)
        assistant_id = data.get('assistantId') or data.get('assistant_id')
        date = data.get('date')

        if assistant_id and date:
            # Update or create the record
            call_record, created = AssistantCall.objects.update_or_create(
                assistant_id=assistant_id,
                defaults={'last_called_date': date}
            )
            logger.info(f'Updated last called date for {assistant_id}: {date}')
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'error': 'assistantId veya tarih eksik'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error updating called date: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@require_http_methods(["GET"])
def get_last_called(request, assistant_id):
    """Handle GET request to retrieve last called date for an assistant"""
    try:
        call_record = AssistantCall.objects.get(assistant_id=assistant_id)
        last_called = call_record.last_called_date
        return JsonResponse({'lastCalledDate': last_called})
    except AssistantCall.DoesNotExist:
        return JsonResponse({'lastCalledDate': None})


elevenlabs = ElevenLabs(
    api_key=ELEVENLABS_API_KEY
)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def register_push_token(request):
    """Register an Expo push token for the authenticated user's device"""
    try:
        data = json.loads(request.body)
        token = data.get('token')
        if not token:
            return JsonResponse({'success': False, 'error': 'Token eksik'}, status=400)

        from .models import PushToken
        # Associate push token with the authenticated user
        push_token, created = PushToken.objects.update_or_create(
            token=token,
            defaults={'user': request.user}
        )
        logger.info(f'Registered push token for user {request.user.username}: {token}')
        return JsonResponse({'success': True})
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error registering push token: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def send_push_notification(request):
    """Send an Expo push notification to the authenticated user's registered devices"""
    try:
        data = json.loads(request.body)
        title = data.get('title', 'Sonia')
        body = data.get('body', '')
        extra_data = data.get('data', {"screen": "talk-ai"})

        from .models import PushToken
        # Only send to the authenticated user's devices
        tokens = list(PushToken.objects.filter(user=request.user).values_list('token', flat=True))

        if not tokens:
            return JsonResponse({'success': False, 'error': 'Kayıtlı cihaz yok'}, status=404)

        messages = [
            {
                'to': token,
                'title': title,
                'body': body,
                'sound': 'default',
                'data': extra_data,
            }
            for token in tokens
        ]

        import requests as http_requests
        response = http_requests.post(
            'https://exp.host/--/api/v2/push/send',
            json=messages,
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            timeout=30,
        )

        logger.info(f'Push sent to {len(tokens)} device(s) for user {request.user.username}: {response.status_code}')
        return JsonResponse({
            'success': True,
            'devicesNotified': len(tokens),
            'expoResponse': response.json(),
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error sending push notification: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def voice_clone(request):
    """Receive an audio file, clone the voice via ElevenLabs, and store voice_id in user profile"""
    try:
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return JsonResponse({'success': False, 'error': 'Ses dosyası sağlanmadı'}, status=400)

        name = request.POST.get('name', 'Sonia Kullanıcı Sesi')

        logger.info(f'Voice clone request received: {audio_file.name} ({audio_file.size} bytes)')

        voice = elevenlabs.voices.ivc.create(
            name=name,
            files=[BytesIO(audio_file.read())],
            request_options={"language": "tr"}
        )
        if hasattr(voice, 'voice_id'):
            logger.info(f'Voice cloned successfully: {voice.voice_id}')

            # Store the voice ID in the user's profile
            user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
            user_profile.voice_id = voice.voice_id
            user_profile.save()

            return JsonResponse({'success': True, 'voiceId': voice.voice_id})
        else:
            logger.error(f'Unexpected response from ElevenLabs: {voice}')
            return JsonResponse({'success': False, 'error': 'Ses klonlanamadı'}, status=422)

    except Exception as e:
        logger.error(f'Error cloning voice: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

