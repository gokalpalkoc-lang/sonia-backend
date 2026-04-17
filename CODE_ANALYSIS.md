# Codebase Analysis and Improvement Suggestions

This document outlines the potential and present issues across the `sonia` workspace, categorized by application layer. It also provides actionable suggestions to resolve them to improve scalability, security, and maintainability.

## 1. Security and Architecture Issues

### Hardcoded API Keys and Secrets
**Present Issue:** Extremely sensitive service keys are currently hardcoded in plain text.
- `VAPI_API_KEY` and `ELEVENLABS_API_KEY` are hardcoded in `backend/api/views.py`.
- `VAPI_API_KEY` is completely exposed within the Vite React app in `admin/src/config.ts`.
- `SECRET_KEY` is hardcoded in `backend/backend/settings.py`.

**Suggestion:** 
- **Backend:** Move all API keys to environment variables and load them via `.env` files using `os.getenv` or `django-environ`.
- **Frontend/Admin:** The `VAPI_API_KEY` should **never** be exposed in the frontend. Instead of making frontend requests directly to Vapi using this key, route these requests through the Django backend, which securely holds the key and forwards the API request.

### Insecure API Endpoints and Unauthenticated Access
**Present Issue:** 
- Multiple API views in `backend/api/views.py` utilize the `@csrf_exempt` decorator which circumvents CSRF protection mechanisms.
- Endpoints like `update_called` perform state-altering database operations (via `PUT`) but explicitly require no authentication, letting anyone modify the database for any `assistant_id`.

**Suggestion:** 
- Secure the `update_called` endpoint with `@jwt_required` or create a robust origin/service verification system.
- Limit `@csrf_exempt` usage to truly stateless API endpoints that strictly mandate JWT authentication.

## 2. Backend (Django)

### Suboptimal Database Schema and Field Types
**Present Issue:** The `time` field in `Command` and `last_called_date` in `AssistantCall` are utilizing `CharField(max_length=100)` to store timestamps/dates. 
**Suggestion:** Refactor these fields to use `DateTimeField` or `DateField`. This will drastically optimize sorting, indexing, querying, and formatting in the future.

### Production Database Limitations
**Present Issue:** The project uses `sqlite3` for its persistence layer. The `PushToken` table dynamically grows over time and will inevitably suffer from SQLite's database lock limitations during parallel read/write cycles.
**Suggestion:** Migrate to a transactional, production-ready relational database like PostgreSQL before deploying to live environments.

### Unhandled Expo Notification Expirations
**Present Issue:** The `send_push_notification` loop sends notifications to all collected tokens for a given user. Expo tokens frequently expire, rotate, or get uninstalled. Continuing to broadcast notifications to invalid tokens is an antipattern and burdens the network.
**Suggestion:** Parse the response returned by the Expo Push API. If Expo responds indicating that a token is unregistered or invalid (`DeviceNotRegistered`), programmatically remove that specific token from the `PushToken` database model.

## 3. AI / Python Scripts (`ai/main.py`)

### Main Thread Blocking due to Synchronous Networking
**Present Issue:** The python `requests` library is used synchronously in the `send_notification()` function. If the `/api/notify` endpoint stalls, lags, or is unresponsive, the **entire webcam and UI draw loop will freeze** for up to 10 seconds (the defined timeout).
**Suggestion:** Execute the API network requests asynchronously. Utilize the `threading` module to fire-and-forget the notification payload, or switch to `asyncio` and `aiohttp` to avoid frame-dropping during emotion tracking.

### DeepFace Explicit Over-processing Unchecked Input Box Scaling
**Present Issue:** The bounding boxes given by `face_recognition` are adjusted manually inside the crop pipeline, which could potentially go out of bounds under edge cases.
**Suggestion:** Ensure `max(0, ...)` bounds checks properly encapsulate matrix sizes against `h, w = frame.shape[:2]`. Additionally, refactor hardcoded `http://localhost:8000` paths to ensure seamless deployments.

## 4. Admin Panel & Web Artifacts

### Missing Universal Environment URL Overrides
**Present Issue:** Default fallbacks continuously use `http://localhost:8000` (e.g., in `admin/src/config.ts`).
**Suggestion:** Eliminate localhost fallbacks acting as "default keys" across the system. Raise startup exceptions if crucial VITE routing prefixes aren't passed, forcing correctly configured production deployments.



## 5. Mobile Infrastructure (Sonia App)

### Large Static Assets Included Inside Base Bundle
**Present Issue:** The React Native package initializes MP3 tracks and large high-resolution images as inline component dependencies (`sound14.mp3`, `pic1.jpg`, etc. in `index.tsx`). 
**Suggestion:** Since EXPO builds will directly embed these assets into the local binary, offload static images and static media assets to remote hosting (AWS S3, Cloudflare CDN) and load them asynchronously over the network. This significantly reduces the size of the initial app store bundle.
