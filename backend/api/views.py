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
# Bug E fix: shared secret for emergency endpoint authentication
EMERGENCY_API_KEY = os.environ.get("EMERGENCY_API_KEY", "")

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent
with open(_BASE_DIR / "master_prompt.txt", "r", encoding="utf-8") as f:
    MASTER_PROMPT = f.read()

with open(_BASE_DIR / "distress_prompt.txt", "r", encoding="utf-8") as f:
    DISTRESS_PROMPT = f.read()


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
                'model': 'gpt-4o-mini',
                'systemPrompt': new_system_prompt,
                'maxTokens': 800,
            },
        },
        timeout=30,
    )
    return response


def _create_vapi_assistant(voice_id, name="Sonia AI", patient_name=""):
    """Create a new Vapi assistant with the given voice and master prompt."""
    import requests
    
    first_message = f"Merhaba, {patient_name} . Size nasıl yardımcı olabilirim?" if patient_name else "Merhaba, ben yapay zekâ asistanınızım. Size nasıl yardımcı olabilirim?"

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
                'model': 'gpt-4o-mini',
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
                'provider': 'deepgram',
                'model': 'nova-2',
                'language': 'tr',
            },
            'firstMessage': first_message,
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
            user = serializer.save()
            
            # Create default Vapi assistant
            try:
                user_profile = UserProfile.objects.get(user=user)
                resp = _create_vapi_assistant(
                    ELEVENLABS_VOICE_ID,
                    name=f"Sonia - {user.username}",
                    patient_name=user_profile.patient_name
                )
                if resp.ok:
                    assistant_data = resp.json()
                    user_profile.assistant_id = assistant_data.get('id')
                    user_profile.save()
                    logger.info(f"Created default Vapi assistant for user {user.username}: {user_profile.assistant_id}")
                else:
                    logger.error(f"Failed to create default Vapi assistant: {resp.status_code} {resp.text}")
            except Exception as e:
                logger.error(f"Error creating default Vapi assistant: {e}")

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
            patient_name = user_profile.patient_name if user_profile.patient_name else ""
            first_msg = f"Merhaba, {patient_name} . Size nasıl yardımcı olabilirim?" if patient_name else "Merhaba, ben yapay zekâ asistanınızım. Size nasıl yardımcı olabilirim?"
            import requests
            requests.patch(
                f'https://api.vapi.ai/assistant/{user_profile.assistant_id}',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {VAPI_API_KEY}',
                },
                json={'firstMessage': first_msg},
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
                resp = _create_vapi_assistant(
                    voice.voice_id, 
                    name=f"Sonia - {request.user.username}",
                    patient_name=user_profile.patient_name
                )
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


@csrf_exempt
@require_http_methods(["POST"])
def emergency_call(request):
    """Triggered by the AI face-analysis module when sustained distress is detected.

    Bug E fix: validates X-Emergency-Key header for authentication.
    1. Patches the patient's Vapi assistant with the calming distress prompt.
    2. Sends a push notification that deep-links to talk-ai with autoStart=1,
       so the call begins automatically when the patient's app opens.
    """
    try:
        # Bug E fix: validate emergency API key
        if EMERGENCY_API_KEY:
            provided_key = request.META.get('HTTP_X_EMERGENCY_KEY', '')
            if provided_key != EMERGENCY_API_KEY:
                return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)

        data = json.loads(request.body)
        notification_uuid = data.get('notification_uuid')
        emotion = data.get('emotion', 'distress')

        if not notification_uuid:
            return JsonResponse({'success': False, 'error': 'notification_uuid eksik'}, status=400)

        try:
            user_profile = UserProfile.objects.get(notification_uuid=notification_uuid)
        except UserProfile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Geçersiz notification_uuid'}, status=404)

        # Step 1: Patch the assistant with the distress-calming prompt
        assistant_patched = False
        if user_profile.assistant_id:
            patient_name = user_profile.patient_name or ''
            # Build a personalised distress prompt
            personalised_prompt = DISTRESS_PROMPT
            if patient_name:
                personalised_prompt = personalised_prompt.replace(
                    'Merhaba canım, seni merak ettim',
                    f'Merhaba {patient_name}, seni merak ettim',
                )

            try:
                resp = _patch_assistant_prompt(user_profile.assistant_id, personalised_prompt)
                if resp.ok:
                    # Set a calming first message
                    import requests as http_requests
                    first_msg = f'Merhaba {patient_name}, seni merak ettim. Nasılsın?' if patient_name else 'Merhaba canım, seni merak ettim. Nasılsın?'
                    http_requests.patch(
                        f'https://api.vapi.ai/assistant/{user_profile.assistant_id}',
                        headers={
                            'Content-Type': 'application/json',
                            'Authorization': f'Bearer {VAPI_API_KEY}',
                        },
                        json={'firstMessage': first_msg},
                        timeout=30,
                    )
                    assistant_patched = True
                    logger.info(f'Patched assistant {user_profile.assistant_id} with distress prompt (emotion: {emotion})')
                else:
                    logger.error(f'Failed to patch assistant for emergency: {resp.status_code} {resp.text}')
            except Exception as e:
                logger.error(f'Error patching assistant for emergency: {e}')
        else:
            logger.warning(f'User {user_profile.user.username} has no assistant_id — sending notification only')

        # Step 2: Send push notification that auto-starts the call
        from .models import PushToken
        tokens = list(PushToken.objects.filter(user=user_profile.user).values_list('token', flat=True))
        notification_sent = False

        if tokens:
            messages = [
                {
                    'to': token,
                    'title': 'Sonia',
                    'body': 'Sizinle konuşmak istiyorum',
                    'sound': 'default',
                    'priority': 'high',
                    'data': {
                        'screen': 'talk-ai',
                        'assistantId': user_profile.assistant_id or '',
                        'autoStart': '1',
                        'emergency': True,
                    },
                }
                for token in tokens
            ]

            try:
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
                # Clean up invalid tokens
                if 'data' in resp_data:
                    for idx, res in enumerate(resp_data['data']):
                        if res.get('status') == 'error' and res.get('details', {}).get('error') == 'DeviceNotRegistered':
                            invalid_token = tokens[idx]
                            PushToken.objects.filter(token=invalid_token).delete()
                            logger.info(f'Deleted invalid token: {invalid_token}')

                notification_sent = True
                logger.info(f'Emergency push sent to {len(tokens)} device(s) for {user_profile.user.username} (emotion: {emotion})')
            except Exception as e:
                logger.error(f'Error sending emergency push: {e}')
        else:
            logger.warning(f'No push tokens for user {user_profile.user.username}')

        return JsonResponse({
            'success': True,
            'assistant_patched': assistant_patched,
            'notification_sent': notification_sent,
            'devices_notified': len(tokens) if tokens else 0,
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error in emergency_call: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def analyze_frame(request):
    """Receive a base64 encoded image frame and return detected faces and emotions.
    Requires JWT authentication. Triggered by the Expo Camera page.
    Feature 7: logs emotions for known (identified) persons.
    """
    try:
        data = json.loads(request.body)
        image_base64 = data.get('image_base64')

        if not image_base64:
            return JsonResponse({'success': False, 'error': 'image_base64 eksik'}, status=400)

        import base64
        import numpy as np
        import cv2
        from .face_utils import process_frame

        # Decode base64
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        image_data = base64.b64decode(image_base64)
        np_arr = np.frombuffer(image_data, np.uint8)
        frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame_bgr is None:
            return JsonResponse({'success': False, 'error': 'Resim çözülemedi'}, status=400)

        detections = process_frame(frame_bgr)

        # Feature 7: log emotions for known persons
        try:
            from .models import EmotionLog
            for det in detections:
                if det.get('name') and det['name'] != 'Bilinmeyen Kişi':
                    EmotionLog.objects.create(
                        user=request.user,
                        person_name=det['name'],
                        raw_emotion=det.get('raw_emotion', 'unknown'),
                        smoothed_emotion=det.get('smoothed_emotion', det.get('raw_emotion', 'unknown')),
                        confidence=det.get('emotion_confidence', 0.0),
                    )
        except Exception as log_err:
            logger.warning(f'Emotion logging failed (non-critical): {log_err}')

        return JsonResponse({
            'success': True,
            'detections': detections
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error analyzing frame: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def calibrate_emotion(request):
    """Receive image(s) and an emotion label, extract the face crop(s), then save the
    averaged 7-D DeepFace score vector as a personalised baseline for the named person.
    
    Feature 1: Supports 'image_base64_list' (array of base64 images) for multi-sample averaging.
    Falls back to single 'image_base64' for backwards compatibility.
    Requires JWT authentication.
    """
    try:
        data = json.loads(request.body)
        emotion_label = data.get('emotion')
        person_name = data.get('person_name', "Bilinmeyen Kişi")

        # Feature 1: accept either a list of images or a single image
        image_base64_list = data.get('image_base64_list', [])
        single_image = data.get('image_base64')
        if not image_base64_list and single_image:
            image_base64_list = [single_image]

        if not image_base64_list or not emotion_label:
            return JsonResponse({'success': False, 'error': 'Eksik parametreler'}, status=400)

        import base64
        import numpy as np
        import cv2
        from .face_utils import padded_crop, save_calibration_multi, assess_face_quality, FACE_MIN_SIZE
        import face_recognition

        face_crops = []
        quality_scores = []

        for img_b64 in image_base64_list:
            try:
                if ',' in img_b64:
                    img_b64 = img_b64.split(',')[1]

                image_data = base64.b64decode(img_b64)
                np_arr = np.frombuffer(image_data, np.uint8)
                frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame_bgr is None:
                    continue

                # Locate the face and crop
                small = cv2.resize(frame_bgr, (0, 0), fx=0.5, fy=0.5)
                rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
                locations = face_recognition.face_locations(rgb_small)

                if not locations:
                    continue

                top, right, bottom, left = max(locations, key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]))
                top = int(top / 0.5)
                right = int(right / 0.5)
                bottom = int(bottom / 0.5)
                left = int(left / 0.5)

                face_crop = padded_crop(frame_bgr, top, right, bottom, left)
                if face_crop.size == 0 or face_crop.shape[0] < FACE_MIN_SIZE or face_crop.shape[1] < FACE_MIN_SIZE:
                    continue

                # Feature 8: check quality and reject poor samples
                quality = assess_face_quality(face_crop)
                quality_scores.append(quality['score'])
                if quality['score'] < 30:
                    continue

                face_crops.append(face_crop)
            except Exception as sample_err:
                logger.warning(f'Calibration sample decode failed: {sample_err}')
                continue

        if not face_crops:
            return JsonResponse({
                'success': False,
                'error': 'Hiçbir resimde yüz bulunamadı veya kalite yetersiz. Net bir yüz fotoğrafı kullanın.',
                'quality_scores': quality_scores,
            }, status=400)

        success, msg = save_calibration_multi(person_name, emotion_label, face_crops)

        return JsonResponse({
            'success': success,
            'message': msg,
            'samples_used': len(face_crops),
            'quality_scores': quality_scores,
        })

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error calibrating emotion: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def calibration_status(request):
    """Return the list of emotion keys already calibrated for a given person.
    Query param: person_name
    """
    try:
        person_name = request.GET.get('person_name', '').strip()
        if not person_name:
            return JsonResponse({'success': False, 'error': 'person_name eksik'}, status=400)

        from .face_utils import get_calibrated_emotions
        calibrated = get_calibrated_emotions(person_name)

        return JsonResponse({
            'success': True,
            'calibrated': calibrated,
        })
    except Exception as e:
        logger.error(f'Error fetching calibration status: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def register_face(request):
    """Accept a base64 image + name, save to ai/known_faces/<name>.jpg, and reload
    the face recognition database.
    """
    try:
        data = json.loads(request.body)
        image_base64 = data.get('image_base64')
        name = data.get('name', '').strip()

        if not image_base64 or not name:
            return JsonResponse({'success': False, 'error': 'image_base64 ve name gerekli'}, status=400)

        import base64
        import numpy as np
        import cv2
        from .face_utils import register_face as _register_face

        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        image_data = base64.b64decode(image_base64)
        np_arr = np.frombuffer(image_data, np.uint8)
        frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame_bgr is None:
            return JsonResponse({'success': False, 'error': 'Resim çözülemedi'}, status=400)

        success, msg = _register_face(name, frame_bgr)

        return JsonResponse({'success': success, 'message': msg})

    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error registering face: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def emotion_history(request):
    """Feature 7: Return the emotion detection history for the authenticated user.
    
    Query params:
        person_name: (optional) filter by person name
        days: (optional) number of days to look back (default: 7)
        limit: (optional) max records (default: 100)
    """
    try:
        from .models import EmotionLog
        from django.utils import timezone
        from datetime import timedelta

        person_name = request.GET.get('person_name', '').strip()
        days = int(request.GET.get('days', 7))
        limit = min(int(request.GET.get('limit', 100)), 500)

        since = timezone.now() - timedelta(days=days)
        qs = EmotionLog.objects.filter(user=request.user, timestamp__gte=since)

        if person_name:
            qs = qs.filter(person_name=person_name)

        qs = qs.order_by('-timestamp')[:limit]

        records = [
            {
                'id': log.pk,
                'person_name': log.person_name,
                'raw_emotion': log.raw_emotion,
                'smoothed_emotion': log.smoothed_emotion,
                'confidence': log.confidence,
                'timestamp': log.timestamp.isoformat(),
            }
            for log in qs
        ]

        return JsonResponse({
            'success': True,
            'count': len(records),
            'records': records,
        })
    except Exception as e:
        logger.error(f'Error fetching emotion history: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@jwt_required
def list_faces(request):
    """Return all registered face images with person names and filenames."""
    try:
        from .face_utils import list_faces as _list_faces
        faces = _list_faces()
        return JsonResponse({
            'success': True,
            'faces': faces,
            'count': len(faces),
        })
    except Exception as e:
        logger.error(f'Error listing faces: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@jwt_required
def delete_face(request):
    """Delete a registered face image by filename.
    
    JSON body: { "filename": "Gökalp.jpg" }
    """
    try:
        data = json.loads(request.body)
        filename = (data.get('filename') or '').strip()
        if not filename:
            return JsonResponse({'success': False, 'error': 'filename parametresi eksik'}, status=400)

        from .face_utils import delete_face as _delete_face
        success, msg = _delete_face(filename)

        status_code = 200 if success else 404
        return JsonResponse({'success': success, 'message': msg}, status=status_code)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Geçersiz JSON'}, status=400)
    except Exception as e:
        logger.error(f'Error deleting face: {e}')
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

