import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator

from .models import Command, AssistantCall

# Vapi API configuration
VAPI_API_KEY = "475a65ff-0aa5-4dac-b9f2-52a16f2c7bba"
ELEVENLABS_VOICE_ID = "Mh8FUpRrhM4iDFS1KYre"

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def commands(request):
    """Handle GET and POST requests for commands"""
    
    # Handle GET request - return stored commands
    if request.method == 'GET':
        commands = Command.objects.all().order_by('-created_at')
        command_list = []
        for cmd in commands:
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
            assistant_name = data.get('assistantName') or data.get('assistantName')
            time = data.get('time')
            prompt = data.get('prompt')
            first_message = data.get('firstMessage')
            
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
                            'model': 'gpt-5-mini',
                            'systemPrompt': prompt,
                            'maxTokens': 800,
                        },
                        'voice': {
                            'provider': '11labs',
                            'voiceId': ELEVENLABS_VOICE_ID,
                        },
                        'transcriber': {
                            'provider': '11labs',
                            'language': 'tr',
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
                    logger.error(f'Failed to create assistant: {create_assistant_response.status}')
                    logger.error(f'Response: {create_assistant_response.text}')
            except Exception as e:
                logger.error(f'Error creating assistant: {e}')
            
            # Store the command in database
            command = Command.objects.create(
                assistant_name=assistant_name,
                time=time,
                prompt=prompt,
                first_message=first_message,
                assistant_id=assistant_id
            )
            
            return JsonResponse({
                'success': True,
                'message': 'Command received and assistant created',
                'assistantId': assistant_id
            })
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f'Error parsing command: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
@require_http_methods(["PUT"])
def update_called(request):
    """Handle PUT request to update last called date for an assistant"""
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
            return JsonResponse({'success': False, 'error': 'Missing assistantId or date'}, status=400)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)
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
