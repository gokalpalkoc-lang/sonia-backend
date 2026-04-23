"""Simple face recognition + emotion detection module.

Uses temporal smoothing (majority vote over a sliding window) and
confidence thresholding to produce stable, reliable emotion labels.

When sustained distress is detected (3 consecutive negative smoothed
readings), an emergency call is triggered via the backend, which
patches the AI assistant with a calming prompt and sends a push
notification that auto-starts the voice call on the patient's device.

Usage:
    python ai/main.py --known-faces-dir ai/known_faces --camera 0

Setup (recommended):
    pip install opencv-python face-recognition deepface numpy
    
Create known faces folder with images named like:
    alice.jpg
    bob.png
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
import sys
from dataclasses import dataclass, field
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
import requests
from dotenv import load_dotenv
import os
import threading

import numpy as np

try:
    import cv2
except ImportError as exc:  # pragma: no cover
    raise ImportError("opencv-python is required. Install with: pip install opencv-python") from exc

try:
    import face_recognition
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "face-recognition is required. Install with: pip install face-recognition"
    ) from exc

try:
    from deepface import DeepFace
except ImportError:
    DeepFace = None

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
EMOTION_WINDOW_SIZE = 10        # sliding window length for majority voting
EMOTION_MIN_CONFIDENCE = 45.0   # minimum DeepFace score (0-100) to accept
EMOTION_SAMPLE_INTERVAL = 3     # run DeepFace every N frames (skip in between)
FACE_CROP_PADDING = 0.25        # expand face crop by 25 % on each side
FACE_NUM_JITTERS = 3            # Bug A fix: consistent with face_utils.py
FACE_MIN_SIZE = 32              # Bug F fix: minimum face crop size for DeepFace
DEEPFACE_INPUT_SIZE = (224, 224)  # Consistent preprocessing target size
NOTIFICATION_EMOTIONS = {"sad", "fear"} # Sadece korkma ve üzülme için bildirim
EMERGENCY_COOLDOWN_SECS = 300   # 5 minutes cooldown between emergency calls
SUSTAINED_DISTRESS_SECONDS = 3.0  # seconds of continuous negative smoothed emotion before triggering
EMERGENCY_API_KEY = os.getenv("EMERGENCY_API_KEY", "")  # Bug E fix: shared secret for emergency endpoint

# İngilizce duygu çıktılarını Türkçe'ye çevirmek için sözlük
EMOTION_TR = {
    "sad": "Üzülme",
    "fear": "Korkma",
    "angry": "Kızgın",
    "disgust": "İğrenme",
    "surprise": "Şaşırma",
    "happy": "Mutlu",
    "neutral": "Nötr",
    "unknown": "Bilinmiyor"
}


@dataclass
class Detection:
    name: str
    confidence: float
    emotion: str                            # smoothed / voted emotion
    raw_emotion: str                        # per-frame DeepFace output
    emotion_confidence: float               # DeepFace score for raw_emotion
    box: Tuple[int, int, int, int]          # top, right, bottom, left


class EmotionSmoother:
    """Per-person sliding window majority voter."""

    def __init__(self, window_size: int = EMOTION_WINDOW_SIZE) -> None:
        self._windows: Dict[str, deque] = {}
        self._window_size = window_size

    def update(self, person: str, emotion: str) -> str:
        if person not in self._windows:
            self._windows[person] = deque(maxlen=self._window_size)
        self._windows[person].append(emotion)
        counts = Counter(self._windows[person])
        return counts.most_common(1)[0][0]

    def current(self, person: str) -> str:
        window = self._windows.get(person)
        if not window:
            return "unknown"
        return Counter(window).most_common(1)[0][0]


class FaceEmotionModule:
    def __init__(
        self,
        known_faces_dir: Path,
        tolerance: float = 0.6,
        scale: float = 0.5,
    ) -> None:
        self.known_faces_dir = known_faces_dir
        self.tolerance = tolerance
        self.scale = scale
        self.known_names: List[str] = []
        self.known_encodings: List[np.ndarray] = []
        self.smoother = EmotionSmoother()
        self._frame_counter = 0
        self._cached_emotions: Dict[str, Tuple[str, float]] = {}  # name -> (emotion, conf)
        self._load_known_faces()

    # ------------------------------------------------------------------
    def _load_known_faces(self) -> None:
        if not self.known_faces_dir.exists():
            print(f"[WARN] Known faces dir does not exist: {self.known_faces_dir}")
            return

        image_paths = [
            p
            for p in self.known_faces_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]

        for image_path in image_paths:
            image = face_recognition.load_image_file(str(image_path))
            encodings = face_recognition.face_encodings(image, num_jitters=FACE_NUM_JITTERS)
            if not encodings:
                print(f"[WARN] No face found in {image_path.name}; skipping.")
                continue

            self.known_encodings.append(encodings[0])
            self.known_names.append(image_path.stem)
            print(f"[INFO] Enrolled '{image_path.stem}' from {image_path.name}")

        print(f"[INFO] Loaded {len(self.known_names)} known face(s).")

    # ------------------------------------------------------------------
    def _padded_crop(self, frame: np.ndarray, top: int, right: int, bottom: int, left: int) -> np.ndarray:
        """Return a face crop with extra padding for better emotion analysis."""
        h, w = frame.shape[:2]
        pad_x = int((right - left) * FACE_CROP_PADDING)
        pad_y = int((bottom - top) * FACE_CROP_PADDING)
        t = max(0, top - pad_y)
        b = min(h, bottom + pad_y)
        l = max(0, left - pad_x)
        r = min(w, right + pad_x)
        
        # Ensure proper bounds and non-zero slice
        if t >= b or l >= r:
            return np.array([])
            
        return frame[t:b, l:r]

    # ------------------------------------------------------------------
    @staticmethod
    def _preprocess_face(face_bgr: np.ndarray) -> np.ndarray:
        """Feature 3: Apply CLAHE and consistent resizing before emotion analysis."""
        if face_bgr is None or face_bgr.size == 0:
            return face_bgr

        # Convert to LAB and equalise luminance
        lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_equalised = clahe.apply(l_channel)
        lab_eq = cv2.merge([l_equalised, a_channel, b_channel])
        eq_bgr = cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)

        # Light bilateral filter for noise reduction
        filtered = cv2.bilateralFilter(eq_bgr, d=5, sigmaColor=50, sigmaSpace=50)

        # Resize to consistent input size
        resized = cv2.resize(filtered, DEEPFACE_INPUT_SIZE, interpolation=cv2.INTER_AREA)
        return resized

    # ------------------------------------------------------------------
    def _detect_emotion(self, face_bgr: np.ndarray) -> Tuple[str, float]:
        """Return (emotion, confidence_score_0_to_100).
        
        Feature 2: Uses detector_backend='skip' (face is pre-cropped).
        Feature 3: Applies CLAHE preprocessing.
        Bug F fix: includes minimum size guard.
        """
        if DeepFace is None:
            return "unknown", 0.0

        # Bug F fix: minimum face size check
        if face_bgr.shape[0] < FACE_MIN_SIZE or face_bgr.shape[1] < FACE_MIN_SIZE:
            return "unknown", 0.0

        try:
            preprocessed = self._preprocess_face(face_bgr)
            result = DeepFace.analyze(
                img_path=preprocessed,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="skip",
                silent=True,
            )
        except Exception:
            return "unknown", 0.0

        if isinstance(result, list):
            if not result:
                return "unknown", 0.0
            result = result[0]

        dominant = str(result.get("dominant_emotion", "unknown"))
        scores = result.get("emotion", {})
        conf = float(scores.get(dominant, 0.0))

        if conf < EMOTION_MIN_CONFIDENCE:
            return "unknown", conf

        return dominant, conf

    # ------------------------------------------------------------------
    def detect(self, frame_bgr: np.ndarray) -> List[Detection]:
        self._frame_counter += 1
        run_emotion = (self._frame_counter % EMOTION_SAMPLE_INTERVAL) == 0

        small_frame = cv2.resize(frame_bgr, (0, 0), fx=self.scale, fy=self.scale)
        rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        locations = face_recognition.face_locations(rgb_small)
        encodings = face_recognition.face_encodings(rgb_small, locations)

        detections: List[Detection] = []

        for encoding, (top, right, bottom, left) in zip(encodings, locations):
            name = "Unknown"
            face_confidence = 0.0

            if self.known_encodings:
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_idx = int(np.argmin(distances))
                best_distance = float(distances[best_idx])
                print(f"[DEBUG] Best match: {self.known_names[best_idx]} dist={best_distance:.3f} (tol={self.tolerance})")

                if best_distance <= self.tolerance:
                    name = self.known_names[best_idx]
                    face_confidence = max(0.0, 1.0 - best_distance)

            # Scale back to original frame coordinates
            top = int(top / self.scale)
            right = int(right / self.scale)
            bottom = int(bottom / self.scale)
            left = int(left / self.scale)

            # Emotion detection (with frame skipping + caching)
            person_key = name if name != "Unknown" else f"unk_{left}_{top}"
            raw_emotion, emotion_conf = "neutral", 0.0

            if run_emotion:
                face_crop = self._padded_crop(frame_bgr, top, right, bottom, left)
                if face_crop.size > 0:
                    raw_emotion, emotion_conf = self._detect_emotion(face_crop)
                self._cached_emotions[person_key] = (raw_emotion, emotion_conf)
            else:
                raw_emotion, emotion_conf = self._cached_emotions.get(person_key, ("unknown", 0.0))

            # Feed into sliding-window smoother
            smoothed = self.smoother.update(person_key, raw_emotion)

            detections.append(
                Detection(
                    name=name,
                    confidence=face_confidence,
                    emotion=smoothed,
                    raw_emotion=raw_emotion,
                    emotion_confidence=emotion_conf,
                    box=(top, right, bottom, left),
                )
            )

        return detections

    # ------------------------------------------------------------------
    @staticmethod
    def draw(frame_bgr: np.ndarray, detections: List[Detection]) -> np.ndarray:
        for det in detections:
            top, right, bottom, left = det.box
            cv2.rectangle(frame_bgr, (left, top), (right, bottom), (0, 255, 0), 2)
            tr_emotion = EMOTION_TR.get(det.emotion, det.emotion)
            label = f"{det.name} | {tr_emotion}"
            if det.name != "Unknown":
                label += f" ({det.confidence:.2f})"

            cv2.rectangle(frame_bgr, (left, bottom - 24), (right, bottom), (0, 255, 0), cv2.FILLED)
            cv2.putText(
                frame_bgr,
                label,
                (left + 4, bottom - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )
        return frame_bgr


# ---------------------------------------------------------------------------
# Sustained distress tracker (per-person)
# ---------------------------------------------------------------------------
class DistressTracker:
    """Tracks continuous negative smoothed emotion duration per person.
    
    An emergency call is only triggered when a known person shows a negative
    emotion continuously for SUSTAINED_DISTRESS_SECONDS, preventing false 
    alarms from momentary expressions.
    """

    def __init__(self, sustained_seconds: float = SUSTAINED_DISTRESS_SECONDS) -> None:
        self._start_times: Dict[str, float] = {}
        self._sustained_seconds = sustained_seconds

    def update(self, person: str, emotion: str) -> bool:
        """Update the tracker and return True if the time threshold is reached."""
        if emotion in NOTIFICATION_EMOTIONS:
            if person not in self._start_times:
                self._start_times[person] = time.time()
            else:
                elapsed = time.time() - self._start_times[person]
                if elapsed >= self._sustained_seconds:
                    # Reset after triggering so the next trigger requires another sustained period
                    self._start_times[person] = time.time()
                    return True
        else:
            # Reset on any non-negative emotion
            if person in self._start_times:
                del self._start_times[person]
        return False


# ---------------------------------------------------------------------------
# Emergency call trigger
# ---------------------------------------------------------------------------
_last_emergency_time: float = 0.0


def trigger_emergency_call(name: str, notification_uuid: str, emotion: str, backend_url: str) -> None:
    """Trigger an emergency call via the backend when sustained distress is detected.
    
    The backend will:
    1. Patch the AI assistant with a calming distress prompt
    2. Send a high-priority push notification that auto-starts the voice call
    """
    global _last_emergency_time
    now = time.time()
    if now - _last_emergency_time < EMERGENCY_COOLDOWN_SECS:
        remaining = int(EMERGENCY_COOLDOWN_SECS - (now - _last_emergency_time))
        print(f"[EMERGENCY] Cooldown active — {remaining}s remaining. Skipping.")
        return
        
    _last_emergency_time = now
    print(f"[EMERGENCY] ⚠️  Sustained distress detected for '{name}' — emotion: {emotion}")
    print(f"[EMERGENCY] Triggering emergency call via backend...")

    def _post():
        try:
            headers = {}
            if EMERGENCY_API_KEY:
                headers["X-Emergency-Key"] = EMERGENCY_API_KEY
            resp = requests.post(
                f"{backend_url}/api/emergency-call",
                json={
                    "notification_uuid": notification_uuid,
                    "emotion": emotion,
                },
                headers=headers,
                timeout=15,
            )
            if resp.ok:
                data = resp.json()
                print(f"[EMERGENCY] ✅ Call triggered successfully:")
                print(f"  → Assistant patched: {data.get('assistant_patched', False)}")
                print(f"  → Notification sent: {data.get('notification_sent', False)}")
                print(f"  → Devices notified:  {data.get('devices_notified', 0)}")
            else:
                print(f"[EMERGENCY] ❌ Backend returned {resp.status_code}: {resp.text}")
        except Exception as e:
            print(f"[EMERGENCY] ❌ Error: {e}")

    threading.Thread(target=_post, daemon=True).start()


# ---------------------------------------------------------------------------
# Legacy notification function (kept for backwards compatibility)
# ---------------------------------------------------------------------------
def send_notification(name: str, notification_uuid: str, emotion: str, backend_url: str) -> None:
    """Send a push notification asynchronously (legacy — use trigger_emergency_call instead)."""
    trigger_emergency_call(name, notification_uuid, emotion, backend_url)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def run_webcam(known_faces_dir: Path, camera: int = 0, notification_uuid: Optional[str] = None) -> int:
    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        raise ValueError("BACKEND_URL is not defined in environment variables")
        
    module = FaceEmotionModule(known_faces_dir=known_faces_dir)
    distress_tracker = DistressTracker()

    cap = cv2.VideoCapture(camera)
    if not cap.isOpened():
        print(f"[ERROR] Could not open camera index {camera}.")
        return 1

    print("[INFO] Press 'q' to quit.")
    if notification_uuid:
        print(f"[INFO] Emergency call enabled (UUID: {notification_uuid})")
        print(f"[INFO] Sustained distress threshold: {SUSTAINED_DISTRESS_SECONDS} seconds")
        print(f"[INFO] Emergency cooldown: {EMERGENCY_COOLDOWN_SECS}s")
    else:
        print("[INFO] No notification UUID — emergency calls disabled.")

    prev_smoothed: Dict[str, str] = {}

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[ERROR] Failed to read frame from camera.")
                return 1

            detections = module.detect(frame)

            for det in detections:
                person_key = det.name if det.name != "Unknown" else f"unk_{det.box[3]}_{det.box[0]}"
                prev = prev_smoothed.get(person_key)
                if prev != det.emotion and det.emotion != "unknown":
                    tr_emotion = EMOTION_TR.get(det.emotion, det.emotion)
                    print(f"[INFO] {det.name}: {tr_emotion} (conf {det.emotion_confidence:.0f}%)")
                prev_smoothed[person_key] = det.emotion

                # Emergency call: only for known faces with sustained negative emotion
                if (
                    notification_uuid
                    and det.name != "Unknown"
                    and det.emotion != "unknown"
                ):
                    should_trigger = distress_tracker.update(person_key, det.emotion)
                    if should_trigger:
                        trigger_emergency_call(
                            det.name, notification_uuid, det.emotion, backend_url
                        )

            annotated = module.draw(frame, detections)
            cv2.imshow("Face Recognition + Emotion", annotated)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return 0


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simple face recognition and emotion detection")
    _script_dir = Path(__file__).resolve().parent
    parser.add_argument(
        "--known-faces-dir",
        type=Path,
        default=_script_dir / "known_faces",
        help="Folder with known face images named by person",
    )
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument(
        "--notification-uuid",
        type=str,
        default=None,
        help="16-char notification UUID from the admin panel (enables emergency calls on distress)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    return run_webcam(
        known_faces_dir=args.known_faces_dir,
        camera=args.camera,
        notification_uuid=args.notification_uuid,
    )


if __name__ == "__main__":
    sys.exit(main())
