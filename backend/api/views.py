import json
import logging
import os
from pathlib import Path
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
VAPI_API_KEY = os.environ.get("VAPI_API_KEY", "")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "Mh8FUpRrhM4iDFS1KYre")  # Default fallback voice
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent
with open(_BASE_DIR / "master_prompt.txt", "r", encoding="utf-8") as f:
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


def _patch_assistant_prompt(assistant_id, new_system_prompt):
    """Update the system prompt of a Vapi assistant via PATCH."""
    import requests
    response = requests.patch(
        f'https://api.vapi.ai/assistant/{assistant_id}',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {VAPI_API_KEY}',
        },
        json={
            'model': {
                'provider': 'openai',
                'model': 'gpt-5.2-chat-latest',
                'systemPrompt': new_system_prompt,
                'maxTokens': 800,
            },
        },
        timeout=30,
    )
    return response


def _create_vapi_assistant(voice_id, name="Sonia AI"):
    """Create a new Vapi assistant with the given voice and master prompt."""
    import requests
    response = requests.post(
        'https://api.vapi.ai/assistant',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {VAPI_API_KEY}',
        },
        json={
            'name': name,
            'model': {
                'provider': 'openai',
                'model': 'gpt-5.2-chat-latest',
                'systemPrompt': MASTER_PROMPT,
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
            'firstMessage': 'Merhaba, ben yapay zekâ asistanınızım. Size nasıl yardımcı olabilirim?',
        },
        timeout=30,
    )
    return response


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
@require_http_methods(["POST"])
@jwt_required
def verify_pin(request):
    """Verify the user's 4-digit menu PIN"""
    try:
        data = json.loads(request.body)
        pin = data.get('pin', '')

        user_profile, _ = UserProfile.objects.get_or_create(user=request.user)

        if not user_profile.menu_pin:
            return JsonResponse({'success': False, 'error': 'No PIN has been set'}, status=400)

        if pin == user_profile.menu_pin:
            return JsonResponse({'success': True})
        else:
            return JsonResponse({'success': False, 'error': 'Incorrect PIN'}, status=403)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error verifying PIN: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST", "DELETE"])
@jwt_required
def commands(request):
    """Handle GET, POST, and DELETE requests for commands"""

    # Handle GET request - return commands for this user
    if request.method == 'GET':
        user_commands = Command.objects.filter(user=request.user).order_by('-created_at')
        command_list = []
        for cmd in user_commands:
            command_data = {
                'id': cmd.pk,
                'time': cmd.time,
                'prompt': cmd.prompt,
                'firstMessage': cmd.first_message,
            }
            command_list.append(command_data)
        return JsonResponse({'commands': command_list})

    # Handle POST request - store command and patch the user's assistant prompt
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            time = data.get('time')
            prompt = data.get('prompt')
            first_message = data.get('firstMessage')

            logger.info(f'Command received from Sonia:')
            logger.info(f'   Time: {time}')
            logger.info(f'   System Prompt: {prompt}')
            logger.info(f'   First Message: {first_message}')

            # Store the command in database, linked to this user
            command = Command.objects.create(
                user=request.user,
                time=time,
                prompt=prompt,
                first_message=first_message,
            )

            # Patch the user's single assistant with the appended prompt
            user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
            if user_profile.assistant_id:
                new_prompt = f"{MASTER_PROMPT}\n\n--- ACTIVE COMMAND ---\n{prompt}"
                try:
                    resp = _patch_assistant_prompt(user_profile.assistant_id, new_prompt)
                    if resp.ok:
                        # Also update first message if provided
                        if first_message:
                            import requests
                            requests.patch(
                                f'https://api.vapi.ai/assistant/{user_profile.assistant_id}',
                                headers={
                                    'Content-Type': 'application/json',
                                    'Authorization': f'Bearer {VAPI_API_KEY}',
                                },
                                json={'firstMessage': first_message},
                                timeout=30,
                            )
                        user_profile.active_command = command
                        user_profile.save()
                        logger.info(f'Patched assistant {user_profile.assistant_id} with command {command.pk}')
                    else:
                        logger.error(f'Failed to patch assistant: {resp.status_code} {resp.text}')
                except Exception as e:
                    logger.error(f'Error patching assistant: {e}')
            else:
                logger.warning('User has no assistant_id — command stored but not applied')

            return JsonResponse({
                'success': True,
                'message': 'Command stored and assistant updated',
                'commandId': command.pk,
            })
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Geçersiz JSON'})
        except Exception as e:
            logger.error(f'Error parsing command: {e}')
            return JsonResponse({'success': False, 'error': str(e)})

    if request.method == 'DELETE':
        try:
            data = json.loads(request.body)
            command_id = data.get('commandId')
            if not command_id:
                return JsonResponse({'success': False, 'error': 'commandId missing'}, status=400)

            try:
                command = Command.objects.get(pk=command_id, user=request.user)
                command.delete()
                logger.info(f'Deleted command {command_id}')
                return JsonResponse({'success': True})
            except Command.DoesNotExist:
                logger.warning(f'Command {command_id} does not exist')
                return JsonResponse({'success': False, 'error': 'Command not found'}, status=404)
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def activate_command(request):
    """Activate a command — patches the user's assistant with the command's prompt"""
    try:
        data = json.loads(request.body)
        command_id = data.get('commandId')

        if not command_id:
            return JsonResponse({'success': False, 'error': 'commandId missing'}, status=400)

        try:
            command = Command.objects.get(pk=command_id, user=request.user)
        except Command.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Command not found'}, status=404)

        user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if not user_profile.assistant_id:
            return JsonResponse({'success': False, 'error': 'No assistant configured'}, status=400)

        new_prompt = f"{MASTER_PROMPT}\n\n--- ACTIVE COMMAND ---\n{command.prompt}"
        resp = _patch_assistant_prompt(user_profile.assistant_id, new_prompt)

        if resp.ok:
            # Also update first message if provided
            if command.first_message:
                import requests
                requests.patch(
                    f'https://api.vapi.ai/assistant/{user_profile.assistant_id}',
                    headers={
                        'Content-Type': 'application/json',
                        'Authorization': f'Bearer {VAPI_API_KEY}',
                    },
                    json={'firstMessage': command.first_message},
                    timeout=30,
                )
            user_profile.active_command = command
            user_profile.save()
            logger.info(f'Activated command {command_id} for user {request.user.username}')
            return JsonResponse({'success': True, 'assistantId': user_profile.assistant_id})
        else:
            logger.error(f'Failed to patch assistant: {resp.status_code} {resp.text}')
            return JsonResponse({'success': False, 'error': 'Failed to update assistant'}, status=500)

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error activating command: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def revert_prompt(request):
    """Revert the assistant's system prompt back to the master prompt (called when conversation ends).

    Supports two auth modes:
    1. JWT auth (from Expo app) — uses request.user to find the profile
    2. assistant_id in body (from vapi-web webview) — looks up profile by assistant_id
    """
    try:
        user_profile = None

        # Try JWT auth first
        auth = JWTAuthentication()
        try:
            result = auth.authenticate(request)
            if result is not None:
                request.user, _ = result
                user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
        except (InvalidToken, TokenError):
            pass

        # Fallback: lookup by assistant_id from request body
        if user_profile is None:
            try:
                data = json.loads(request.body)
                assistant_id = data.get('assistant_id', '').strip()
                if assistant_id:
                    user_profile = UserProfile.objects.filter(assistant_id=assistant_id).first()
            except (json.JSONDecodeError, Exception):
                pass

        if user_profile is None:
            return JsonResponse({'success': False, 'error': 'Authentication required or invalid assistant_id'}, status=401)

        if not user_profile.assistant_id:
            return JsonResponse({'success': False, 'error': 'No assistant configured'}, status=400)

        resp = _patch_assistant_prompt(user_profile.assistant_id, MASTER_PROMPT)

        if resp.ok:
            # Also reset first message
            import requests
            requests.patch(
                f'https://api.vapi.ai/assistant/{user_profile.assistant_id}',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {VAPI_API_KEY}',
                },
                json={'firstMessage': 'Merhaba, ben yapay zekâ asistanınızım. Size nasıl yardımcı olabilirim?'},
                timeout=30,
            )
            user_profile.active_command = None
            user_profile.save()
            logger.info(f'Reverted assistant prompt for user {user_profile.user.username}')
            return JsonResponse({'success': True})
        else:
            logger.error(f'Failed to revert assistant: {resp.status_code} {resp.text}')
            return JsonResponse({'success': False, 'error': 'Failed to revert assistant'}, status=500)

    except Exception as e:
        logger.error(f'Error reverting prompt: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


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
        return JsonResponse({'success': True}, status=201 if created else 200)
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

        resp_data = response.json()
        if 'data' in resp_data:
            for idx, res in enumerate(resp_data['data']):
                if res.get('status') == 'error' and res.get('details', {}).get('error') == 'DeviceNotRegistered':
                    invalid_token = tokens[idx]
                    PushToken.objects.filter(token=invalid_token).delete()
                    logger.info(f"Deleted invalid token: {invalid_token}")

        logger.info(f'Push sent to {len(tokens)} device(s) for user {request.user.username}: {response.status_code}')
        return JsonResponse({
            'success': True,
            'devicesNotified': len(tokens),
            'expoResponse': resp_data,
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
    """Receive an audio file, clone the voice via ElevenLabs, create Vapi assistant, and store in profile"""
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

            # Create the user's single Vapi assistant with the cloned voice
            assistant_id = None
            try:
                resp = _create_vapi_assistant(voice.voice_id, name=f"Sonia - {request.user.username}")
                if resp.ok:
                    assistant_data = resp.json()
                    assistant_id = assistant_data.get('id')
                    user_profile.assistant_id = assistant_id
                    logger.info(f'Created Vapi assistant for user {request.user.username}: {assistant_id}')
                else:
                    logger.error(f'Failed to create Vapi assistant: {resp.status_code} {resp.text}')
            except Exception as e:
                logger.error(f'Error creating Vapi assistant: {e}')

            user_profile.save()

            return JsonResponse({
                'success': True,
                'voiceId': voice.voice_id,
                'assistantId': assistant_id,
            })
        else:
            logger.error(f'Unexpected response from ElevenLabs: {voice}')
            return JsonResponse({'success': False, 'error': 'Ses klonlanamadı'}, status=422)

    except Exception as e:
        logger.error(f'Error cloning voice: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def notify_by_uuid(request):
    """Send push notification to a user identified by their notification_uuid.
    This is a public endpoint designed for the AI module (no JWT required).
    """
    try:
        data = json.loads(request.body)
        notification_uuid = data.get('notification_uuid')
        title = data.get('title', 'Sonia')
        body = data.get('body', '')
        extra_data = data.get('data', {"screen": "talk-ai"})

        if not notification_uuid:
            return JsonResponse({'success': False, 'error': 'notification_uuid eksik'}, status=400)

        try:
            profile = UserProfile.objects.get(notification_uuid=notification_uuid)
        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Geçersiz notification_uuid'}, status=404)

        from .models import PushToken
        tokens = list(PushToken.objects.filter(user=profile.user).values_list('token', flat=True))

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

        resp_data = response.json()
        if 'data' in resp_data:
            for idx, res in enumerate(resp_data['data']):
                if res.get('status') == 'error' and res.get('details', {}).get('error') == 'DeviceNotRegistered':
                    invalid_token = tokens[idx]
                    PushToken.objects.filter(token=invalid_token).delete()
                    logger.info(f"Deleted invalid token: {invalid_token}")

        logger.info(f'Push via UUID sent to {len(tokens)} device(s) for user {profile.user.username}: {response.status_code}')
        return JsonResponse({
            'success': True,
            'devicesNotified': len(tokens),
            'expoResponse': resp_data,
        })
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error sending push via UUID: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
