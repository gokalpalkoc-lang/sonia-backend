"""Record a known face from the webcam and save it for face recognition.

Usage:
    python ai/record_known_face.py --name alice
    python ai/record_known_face.py --name bob --camera 0 --output-dir ai/known_faces
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional

try:
    import cv2
except ImportError as exc:
    raise ImportError("opencv-python is required. Install with: pip install opencv-python") from exc

try:
    import face_recognition
except ImportError as exc:
    raise ImportError(
        "face-recognition is required. Install with: pip install face-recognition"
    ) from exc


def record_face(name: str, output_dir: Path, camera: int = 0) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(camera)
    if not cap.isOpened():
        print(f"[ERROR] Could not open camera index {camera}.")
        return 1

    print("[INFO] Position your face in the frame.")
    print("[INFO] Press SPACE to capture, 'q' to quit.")

    saved = False

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[ERROR] Failed to read frame from camera.")
                return 1

            display = frame.copy()
            rgb_small = cv2.cvtColor(
                cv2.resize(frame, (0, 0), fx=0.25, fy=0.25), cv2.COLOR_BGR2RGB
            )
            locations = face_recognition.face_locations(rgb_small)

            for top, right, bottom, left in locations:
                top, right, bottom, left = top * 4, right * 4, bottom * 4, left * 4
                cv2.rectangle(display, (left, top), (right, bottom), (0, 255, 0), 2)

            status = f"Face detected: {len(locations)}"
            cv2.putText(
                display, status, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA,
            )
            cv2.imshow("Record Known Face", display)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break

            if key == ord(" "):
                if not locations:
                    print("[WARN] No face detected – move closer and try again.")
                    continue

                rgb_full = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                encodings = face_recognition.face_encodings(rgb_full)
                if not encodings:
                    print("[WARN] Could not encode the face – try again.")
                    continue

                out_path = output_dir / f"{name}.jpg"
                cv2.imwrite(str(out_path), frame)
                print(f"[OK] Saved face for '{name}' -> {out_path}")
                saved = True
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    return 0 if saved else 1


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Record a known face from the webcam")
    parser.add_argument("--name", required=True, help="Name label for the person")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("ai/known_faces"),
        help="Directory to save the face image (default: ai/known_faces)",
    )
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    return record_face(name=args.name, output_dir=args.output_dir, camera=args.camera)


if __name__ == "__main__":
    sys.exit(main())
