"""Simple face recognition + emotion detection module.

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
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple
import requests
from dotenv import load_dotenv
import os

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

@dataclass
class Detection:
    name: str
    confidence: float
    emotion: str
    box: Tuple[int, int, int, int]  # top, right, bottom, left


class FaceEmotionModule:
    def __init__(self, known_faces_dir: Path, tolerance: float = 0.5, scale: float = 0.25) -> None:
        self.known_faces_dir = known_faces_dir
        self.tolerance = tolerance
        self.scale = scale
        self.known_names: List[str] = []
        self.known_encodings: List[np.ndarray] = []
        self._load_known_faces()

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
            encodings = face_recognition.face_encodings(image)
            if not encodings:
                print(f"[WARN] No face found in {image_path.name}; skipping.")
                continue

            self.known_encodings.append(encodings[0])
            self.known_names.append(image_path.stem)

        print(f"[INFO] Loaded {len(self.known_names)} known face(s).")

    def _detect_emotion(self, face_bgr: np.ndarray) -> str:
        if DeepFace is None:
            return "unknown"

        try:
            result = DeepFace.analyze(
                img_path=face_bgr,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="opencv",
                silent=True,
            )
        except Exception:
            return "unknown"

        if isinstance(result, list):
            if not result:
                return "unknown"
            result = result[0]

        return str(result.get("dominant_emotion", "unknown"))

    def detect(self, frame_bgr: np.ndarray) -> List[Detection]:
        small_frame = cv2.resize(frame_bgr, (0, 0), fx=self.scale, fy=self.scale)
        rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        locations = face_recognition.face_locations(rgb_small)
        encodings = face_recognition.face_encodings(rgb_small, locations)

        detections: List[Detection] = []

        for encoding, (top, right, bottom, left) in zip(encodings, locations):
            name = "Unknown"
            confidence = 0.0

            if self.known_encodings:
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_idx = int(np.argmin(distances))
                best_distance = float(distances[best_idx])

                if best_distance <= self.tolerance:
                    name = self.known_names[best_idx]
                    confidence = max(0.0, 1.0 - best_distance)

            top = int(top / self.scale)
            right = int(right / self.scale)
            bottom = int(bottom / self.scale)
            left = int(left / self.scale)

            face_crop = frame_bgr[max(0, top):max(0, bottom), max(0, left):max(0, right)]
            emotion = self._detect_emotion(face_crop) if face_crop.size > 0 else "unknown"

            detections.append(
                Detection(
                    name=name,
                    confidence=confidence,
                    emotion=emotion,
                    box=(top, right, bottom, left),
                )
            )

        return detections

    @staticmethod
    def draw(frame_bgr: np.ndarray, detections: List[Detection]) -> np.ndarray:
        for det in detections:
            top, right, bottom, left = det.box
            cv2.rectangle(frame_bgr, (left, top), (right, bottom), (0, 255, 0), 2)
            label = f"{det.name} | {det.emotion}"
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

def send_notification(name: str, notification_uuid: str, backend_url: str = "http://localhost:8000") -> None:
    """Send a push notification to the user via their notification_uuid."""
    try:
        resp = requests.post(
            f"{backend_url}/api/notify",
            json={
                "notification_uuid": notification_uuid,
                "title": "Sonia AI",
                "body": f"{name} algılandı",
                "data": {"screen": "talk-ai"},
            },
            timeout=10,
        )
        if resp.ok:
            print(f"[NOTIFY] Sent notification for '{name}'")
        else:
            print(f"[NOTIFY] Failed ({resp.status_code}): {resp.text}")
    except Exception as e:
        print(f"[NOTIFY] Error: {e}")

def run_webcam(known_faces_dir: Path, camera: int = 0, notification_uuid: Optional[str] = None) -> int:
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    module = FaceEmotionModule(known_faces_dir=known_faces_dir)

    cap = cv2.VideoCapture(camera)
    if not cap.isOpened():
        print(f"[ERROR] Could not open camera index {camera}.")
        return 1

    print("[INFO] Press 'q' to quit.")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[ERROR] Failed to read frame from camera.")
                return 1

            detections = module.detect(frame)

            # Send notification for known faces
            if notification_uuid:
                for det in detections:
                    if det.name != "Unknown":
                        send_notification(det.name, notification_uuid, backend_url)

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
    parser.add_argument(
        "--known-faces-dir",
        type=Path,
        default=Path("ai/known_faces"),
        help="Folder with known face images named by person",
    )
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument(
        "--notification-uuid",
        type=str,
        default=None,
        help="16-char notification UUID from the admin panel (enables push notifications)",
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
