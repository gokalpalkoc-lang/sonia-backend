import cv2
import numpy as np
import face_recognition
from pathlib import Path
from deepface import DeepFace
import os
import shutil
import threading
import re
from collections import deque
from typing import Dict, Tuple

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------
EMOTION_MIN_CONFIDENCE = 45.0
FACE_CROP_PADDING = 0.25
# Minimum face crop size for reliable DeepFace analysis
FACE_MIN_SIZE = 32
# Cosine similarity threshold for calibration matching (0-1, higher = stricter)
CALIBRATION_SIMILARITY_THRESHOLD = 0.85
# Number of jitters for face encoding (higher = more accurate, slower)
FACE_NUM_JITTERS = 3
# Target size for DeepFace input (consistent preprocessing)
DEEPFACE_INPUT_SIZE = (224, 224)
# Server-side emotion smoothing window
SMOOTHING_WINDOW_SIZE = 5
# Face quality thresholds
FACE_QUALITY_MIN_BRIGHTNESS = 40
FACE_QUALITY_MAX_BRIGHTNESS = 220
FACE_QUALITY_MIN_BLUR = 30.0

# English to Turkish emotion mapping
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

# ---------------------------------------------------------------------------
# Thread-safe known faces database (Bug D fix)
# ---------------------------------------------------------------------------
_known_encodings = []
_known_names = []
_is_loaded = False
_faces_lock = threading.Lock()


def _known_faces_dir() -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return base_dir / "ai" / "known_faces"


def load_known_faces():
    """Load known face encodings from disk. Thread-safe."""
    global _is_loaded, _known_encodings, _known_names
    with _faces_lock:
        if _is_loaded:
            return

        known_faces_dir = _known_faces_dir()

        if not known_faces_dir.exists():
            print(f"[WARN] Known faces dir does not exist: {known_faces_dir}")
            _is_loaded = True
            return

        image_paths = [
            p for p in known_faces_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
        ]

        _known_encodings.clear()
        _known_names.clear()

        # Feature 6: Support multiple images per person
        # Files like "Gökalp.jpg", "Gökalp_2.jpg" all map to person "Gökalp"
        for image_path in image_paths:
            try:
                image = face_recognition.load_image_file(str(image_path))
                encodings = face_recognition.face_encodings(image, num_jitters=FACE_NUM_JITTERS)
                if not encodings:
                    print(f"[WARN] No face found in {image_path.name}; skipping.")
                    continue

                # Extract person name: strip trailing _N suffix
                raw_name = image_path.stem
                person_name = re.sub(r'_\d+$', '', raw_name)

                _known_encodings.append(encodings[0])
                _known_names.append(person_name)
            except Exception as e:
                print(f"[ERROR] Failed to load {image_path}: {e}")

        _is_loaded = True
        print(f"[INFO] Loaded {len(_known_names)} known face encoding(s) for API.")


def register_face(name: str, image_bgr: np.ndarray) -> tuple[bool, str]:
    """Save a face image to the known_faces directory and reload the face DB.

    Bug C fix: saves the cropped face region, not the full frame.
    Feature 6: auto-increments filename if a file already exists.
    Returns (success, message).
    """
    global _is_loaded

    if image_bgr is None or image_bgr.size == 0:
        return False, "Boş resim gönderildi."

    # Validate there's actually a face in the image first
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    locations = face_recognition.face_locations(rgb)
    if not locations:
        return False, "Resimde yüz bulunamadı. Lütfen net bir yüz fotoğrafı gönderin."

    encodings = face_recognition.face_encodings(rgb, locations)
    if not encodings:
        return False, "Resimde yüz bulunamadı. Lütfen net bir yüz fotoğrafı gönderin."

    # Bug C fix: crop the face region instead of saving the full frame
    # Use the largest detected face
    best_loc = max(locations, key=lambda loc: (loc[2] - loc[0]) * (loc[1] - loc[3]))
    top, right, bottom, left = best_loc
    face_crop = padded_crop(image_bgr, top, right, bottom, left)
    if face_crop.size == 0:
        return False, "Yüz bölgesi kırpılamadı."

    # Sanitise name for filename
    safe_name = "".join([c for c in name if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
    if not safe_name:
        return False, "Geçersiz isim."

    faces_dir = _known_faces_dir()
    faces_dir.mkdir(parents=True, exist_ok=True)

    # Feature 6: auto-increment if file already exists
    dest_path = faces_dir / f"{safe_name}.jpg"
    if dest_path.exists():
        counter = 2
        while (faces_dir / f"{safe_name}_{counter}.jpg").exists():
            counter += 1
        dest_path = faces_dir / f"{safe_name}_{counter}.jpg"

    success = cv2.imwrite(str(dest_path), face_crop)
    if not success:
        return False, "Resim kaydedilemedi."

    # Force reload of face DB on next call (thread-safe)
    with _faces_lock:
        _is_loaded = False
    load_known_faces()

    print(f"[INFO] Registered new face: {safe_name} -> {dest_path.name}")
    return True, f"{safe_name} yüzü başarıyla kaydedildi."


def list_faces() -> list[dict]:
    """Return a list of all registered face images grouped by person.

    Returns a list of dicts: [{name, filename, path, size_kb}, ...]
    """
    faces_dir = _known_faces_dir()
    if not faces_dir.exists():
        return []

    image_paths = [
        p for p in faces_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png"}
    ]

    result = []
    for p in sorted(image_paths, key=lambda x: x.stem):
        raw_name = p.stem
        person_name = re.sub(r'_\d+$', '', raw_name)
        result.append({
            "name": person_name,
            "filename": p.name,
            "size_kb": round(p.stat().st_size / 1024, 1),
        })

    return result


def delete_face(filename: str) -> tuple[bool, str]:
    """Delete a specific face image file and reload the face DB.

    Returns (success, message).
    """
    global _is_loaded

    # Sanitise: only allow simple filenames, no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        return False, "Geçersiz dosya adı."

    faces_dir = _known_faces_dir()
    target = faces_dir / filename

    if not target.exists():
        return False, f"Dosya bulunamadı: {filename}"

    if not target.is_file():
        return False, "Geçersiz hedef."

    try:
        person_name = re.sub(r'_\d+$', '', target.stem)
        target.unlink()
        print(f"[INFO] Deleted face image: {filename}")

        # Force reload of face DB
        with _faces_lock:
            _is_loaded = False
        load_known_faces()

        return True, f"{person_name} yüz resmi silindi."
    except Exception as e:
        print(f"[ERROR] Failed to delete {filename}: {e}")
        return False, str(e)


# ---------------------------------------------------------------------------
# Calibration system
# ---------------------------------------------------------------------------
# Calibration cache: { "Person Name": { "happy": { "sad": 1.0, ... }, ... } }
_calibrations: dict = {}
_calibrations_lock = threading.Lock()


def get_calibrations_path(person_name: str) -> Path:
    base_dir = Path(__file__).resolve().parent.parent.parent
    emotions_dir = base_dir / "ai" / "known_emotions"
    emotions_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join([c for c in person_name if c.isalpha() or c.isdigit() or c == ' ']).rstrip()
    return emotions_dir / f"{safe_name}_calibrations.json"


def load_calibrations(person_name: str) -> dict:
    import json
    with _calibrations_lock:
        if person_name in _calibrations:
            return _calibrations[person_name]

    path = get_calibrations_path(person_name)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            with _calibrations_lock:
                _calibrations[person_name] = data
            return data
        except Exception as e:
            print(f"[ERROR] Loading calibrations for {person_name}: {e}")

    with _calibrations_lock:
        _calibrations[person_name] = {}
    return _calibrations[person_name]


def get_calibrated_emotions(person_name: str) -> list[str]:
    """Return a list of emotion keys that have been calibrated for this person."""
    cals = load_calibrations(person_name)
    return list(cals.keys())


def save_calibration(person_name: str, emotion_label: str, face_bgr: np.ndarray) -> tuple[bool, str]:
    """Run DeepFace on a single face crop and store the 7-D score vector as a baseline.
    
    Feature 2: Uses detector_backend='skip' since input is pre-cropped.
    Feature 3: Applies CLAHE preprocessing before analysis.
    Bug B fix: Updates in-memory cache after saving to disk.
    """
    import json
    try:
        preprocessed = preprocess_face(face_bgr)
        result = DeepFace.analyze(
            img_path=preprocessed,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="skip",
            silent=True,
        )
        if isinstance(result, list) and result:
            result = result[0]

        if not isinstance(result, dict):
            return False, "DeepFace beklenmedik bir sonuç döndürdü."

        raw_scores = result.get("emotion", {})
        if not raw_scores:
            return False, "Yüz ifadesi okunamadı."

        # Convert np.float32 → native Python float for JSON
        scores = {k: float(v) for k, v in raw_scores.items()}

        cals = load_calibrations(person_name)
        cals[emotion_label] = scores

        path = get_calibrations_path(person_name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cals, f, ensure_ascii=False, indent=2)

        # Bug B fix: update in-memory cache immediately
        with _calibrations_lock:
            _calibrations[person_name] = cals

        return True, "Kalibrasyon kaydedildi."
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Calibration failed: {e}")
        return False, str(e)


def save_calibration_multi(person_name: str, emotion_label: str,
                           face_crops: list[np.ndarray]) -> tuple[bool, str]:
    """Feature 1: Run DeepFace on multiple face crops and store the averaged
    7-D score vector as a more robust baseline.

    Falls back to single-shot if only one crop is provided.
    """
    import json
    if not face_crops:
        return False, "Yüz resmi sağlanmadı."

    if len(face_crops) == 1:
        return save_calibration(person_name, emotion_label, face_crops[0])

    all_scores = []
    for crop in face_crops:
        try:
            preprocessed = preprocess_face(crop)
            result = DeepFace.analyze(
                img_path=preprocessed,
                actions=["emotion"],
                enforce_detection=False,
                detector_backend="skip",
                silent=True,
            )
            if isinstance(result, list) and result:
                result = result[0]
            if not isinstance(result, dict):
                continue
            raw_scores = result.get("emotion", {})
            if raw_scores:
                all_scores.append({k: float(v) for k, v in raw_scores.items()})
        except Exception as e:
            print(f"[WARN] Calibration sample failed: {e}")
            continue

    if not all_scores:
        return False, "Hiçbir örnek analiz edilemedi."

    # Compute element-wise average across all valid samples
    emotion_keys = all_scores[0].keys()
    averaged = {
        k: sum(s.get(k, 0.0) for s in all_scores) / len(all_scores)
        for k in emotion_keys
    }

    cals = load_calibrations(person_name)
    cals[emotion_label] = averaged

    path = get_calibrations_path(person_name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cals, f, ensure_ascii=False, indent=2)

    # Bug B fix: update in-memory cache
    with _calibrations_lock:
        _calibrations[person_name] = cals

    return True, f"Kalibrasyon kaydedildi ({len(all_scores)} örnek ortalaması)."


# ---------------------------------------------------------------------------
# Image preprocessing (Feature 3)
# ---------------------------------------------------------------------------
def preprocess_face(face_bgr: np.ndarray) -> np.ndarray:
    """Apply CLAHE and consistent resizing for better emotion detection accuracy.
    
    Feature 3: Normalises lighting via CLAHE on the luminance channel,
    applies bilateral filtering for noise, and resizes to a consistent
    224×224 input for the DeepFace model.
    """
    if face_bgr is None or face_bgr.size == 0:
        return face_bgr

    # Convert to LAB colour space for luminance-only equalisation
    lab = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # Apply CLAHE to the luminance channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_equalised = clahe.apply(l_channel)

    # Merge and convert back to BGR
    lab_equalised = cv2.merge([l_equalised, a_channel, b_channel])
    equalised_bgr = cv2.cvtColor(lab_equalised, cv2.COLOR_LAB2BGR)

    # Light bilateral filter for noise reduction without blurring edges
    filtered = cv2.bilateralFilter(equalised_bgr, d=5, sigmaColor=50, sigmaSpace=50)

    # Resize to consistent input size
    resized = cv2.resize(filtered, DEEPFACE_INPUT_SIZE, interpolation=cv2.INTER_AREA)

    return resized


# ---------------------------------------------------------------------------
# Face quality assessment (Feature 8)
# ---------------------------------------------------------------------------
def assess_face_quality(face_bgr: np.ndarray) -> dict:
    """Return a quality assessment dict for a face crop.
    
    Feature 8: Evaluates size, brightness, blur, and contrast.
    Returns {score: 0-100, issues: [...], details: {...}}
    """
    if face_bgr is None or face_bgr.size == 0:
        return {"score": 0, "issues": ["Yüz bölgesi boş"], "details": {}}

    h, w = face_bgr.shape[:2]
    issues = []
    score = 100

    # --- Size check ---
    size_score = min(100, (min(h, w) / 112) * 100)  # 112px = good size
    if min(h, w) < FACE_MIN_SIZE:
        issues.append("Yüz çok küçük, daha yaklaşın")
        score -= 40
    elif min(h, w) < 80:
        issues.append("Yüz küçük, biraz daha yaklaşın")
        score -= 15

    # --- Brightness check ---
    gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
    mean_brightness = float(np.mean(gray))
    if mean_brightness < FACE_QUALITY_MIN_BRIGHTNESS:
        issues.append("Çok karanlık, daha iyi aydınlatma sağlayın")
        score -= 25
    elif mean_brightness > FACE_QUALITY_MAX_BRIGHTNESS:
        issues.append("Çok parlak, aşırı ışıktan kaçının")
        score -= 20

    # --- Blur check (Laplacian variance) ---
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if laplacian_var < FACE_QUALITY_MIN_BLUR:
        issues.append("Bulanık görüntü, kamerayı sabit tutun")
        score -= 25

    # --- Contrast check ---
    contrast = float(np.std(gray))
    if contrast < 20:
        issues.append("Düşük kontrast")
        score -= 10

    score = max(0, min(100, score))

    return {
        "score": round(score),
        "issues": issues,
        "details": {
            "size": f"{w}x{h}",
            "brightness": round(mean_brightness, 1),
            "blur_score": round(laplacian_var, 1),
            "contrast": round(contrast, 1),
            "size_score": round(size_score, 1),
        }
    }


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------
def padded_crop(frame: np.ndarray, top: int, right: int, bottom: int, left: int) -> np.ndarray:
    h, w = frame.shape[:2]
    pad_x = int((right - left) * FACE_CROP_PADDING)
    pad_y = int((bottom - top) * FACE_CROP_PADDING)
    t = max(0, top - pad_y)
    b = min(h, bottom + pad_y)
    l = max(0, left - pad_x)
    r = min(w, right + pad_x)

    if t >= b or l >= r:
        return np.array([])

    return frame[t:b, l:r]


# ---------------------------------------------------------------------------
# Distance / similarity helpers (Feature 4)
# ---------------------------------------------------------------------------
def _normalise_scores(scores: dict) -> dict:
    """Normalise a DeepFace emotion score dict so values sum to 100."""
    total = sum(scores.values())
    if total == 0:
        return scores
    return {k: v / total * 100 for k, v in scores.items()}


def _cosine_similarity(vec_a: dict, vec_b: dict) -> float:
    """Feature 4: Compute cosine similarity between two emotion score dicts.
    
    Returns a value in [0, 1] where 1 = identical direction.
    More robust than Euclidean distance for comparing probability distributions.
    """
    keys = sorted(set(vec_a.keys()) | set(vec_b.keys()))
    a = np.array([vec_a.get(k, 0.0) for k in keys], dtype=np.float64)
    b = np.array([vec_b.get(k, 0.0) for k in keys], dtype=np.float64)

    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Server-side emotion smoothing (Feature 5)
# ---------------------------------------------------------------------------
_emotion_history: Dict[str, deque] = {}
_emotion_history_lock = threading.Lock()


def _smooth_emotion(person_key: str, raw_emotion: str) -> str:
    """Feature 5: Per-person sliding window majority vote for temporal smoothing."""
    with _emotion_history_lock:
        if person_key not in _emotion_history:
            _emotion_history[person_key] = deque(maxlen=SMOOTHING_WINDOW_SIZE)
        _emotion_history[person_key].append(raw_emotion)

        # Majority vote
        window = _emotion_history[person_key]
        counts: Dict[str, int] = {}
        for e in window:
            counts[e] = counts.get(e, 0) + 1
        return max(counts, key=lambda k: counts[k])


# ---------------------------------------------------------------------------
# Core emotion detection
# ---------------------------------------------------------------------------
def detect_emotion(face_bgr: np.ndarray, person_name: str = "Bilinmeyen Kişi") -> tuple[str, float]:
    """Detect emotion from a pre-cropped face image.
    
    Feature 2: Uses detector_backend='skip' (face is pre-cropped).
    Feature 3: Applies CLAHE preprocessing.
    Feature 4: Uses cosine similarity for calibration matching.
    """
    try:
        preprocessed = preprocess_face(face_bgr)
        result = DeepFace.analyze(
            img_path=preprocessed,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="skip",
            silent=True,
        )
        if isinstance(result, list) and result:
            result = result[0]

        # Guard against non-dict results
        if not isinstance(result, dict):
            print(f"[WARN] DeepFace returned unexpected type: {type(result)}")
            return "unknown", 0.0

        scores = result.get("emotion", {})
        if not scores:
            return "unknown", 0.0

        # Check for personalized calibrations using cosine similarity (Feature 4)
        cals = load_calibrations(person_name)
        if cals and scores:
            norm_scores = _normalise_scores(scores)
            best_emotion = "unknown"
            best_similarity = -1.0

            for cal_emotion, cal_scores in cals.items():
                norm_cal = _normalise_scores(cal_scores)
                similarity = _cosine_similarity(norm_scores, norm_cal)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_emotion = cal_emotion

            if best_similarity >= CALIBRATION_SIMILARITY_THRESHOLD:
                # Convert similarity [threshold, 1.0] -> confidence [0, 100]
                range_size = 1.0 - CALIBRATION_SIMILARITY_THRESHOLD
                if range_size > 0:
                    cal_confidence = ((best_similarity - CALIBRATION_SIMILARITY_THRESHOLD) / range_size) * 100.0
                else:
                    cal_confidence = 100.0
                return best_emotion, round(min(100.0, cal_confidence), 1)

        # Fallback to generic model
        dominant = str(result.get("dominant_emotion", "unknown"))
        conf = float(scores.get(dominant, 0.0))

        if conf < EMOTION_MIN_CONFIDENCE:
            return "unknown", conf

        return dominant, conf

    except Exception as e:
        print(f"[ERROR] Emotion detection failed: {e}")
        return "unknown", 0.0


# ---------------------------------------------------------------------------
# Main frame processing
# ---------------------------------------------------------------------------
def process_frame(frame_bgr: np.ndarray, tolerance: float = 0.6, scale: float = 0.5) -> list[dict]:
    """Process a camera frame: detect faces, identify them, analyse emotions.
    
    Feature 5: Server-side temporal smoothing via majority vote.
    Feature 6: Matches against all encodings per person (min distance).
    Feature 8: Includes face quality scores.
    """
    load_known_faces()

    small_frame = cv2.resize(frame_bgr, (0, 0), fx=scale, fy=scale)
    rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    locations = face_recognition.face_locations(rgb_small)
    encodings = face_recognition.face_encodings(rgb_small, locations)

    detections = []

    for encoding, (top, right, bottom, left) in zip(encodings, locations):
        name = "Bilinmeyen Kişi"
        face_confidence = 0.0

        if _known_encodings:
            distances = face_recognition.face_distance(_known_encodings, encoding)
            if len(distances) > 0:
                # Feature 6: For each unique person, find the best (minimum) distance
                # across all their encodings
                person_best: Dict[str, float] = {}
                for idx, dist in enumerate(distances):
                    pname = _known_names[idx]
                    if pname not in person_best or dist < person_best[pname]:
                        person_best[pname] = dist

                # Find the overall best person
                best_person = min(person_best, key=person_best.get)
                best_distance = person_best[best_person]

                if best_distance <= tolerance:
                    name = best_person
                    face_confidence = max(0.0, 1.0 - best_distance)

        # Scale back to original frame coordinates
        top = int(top / scale)
        right = int(right / scale)
        bottom = int(bottom / scale)
        left = int(left / scale)

        face_crop = padded_crop(frame_bgr, top, right, bottom, left)
        raw_emotion = "unknown"
        emotion_conf = 0.0
        quality = {"score": 0, "issues": [], "details": {}}

        # Minimum dimension guard before passing to DeepFace
        if (
            face_crop.size > 0
            and face_crop.shape[0] >= FACE_MIN_SIZE
            and face_crop.shape[1] >= FACE_MIN_SIZE
        ):
            raw_emotion, emotion_conf = detect_emotion(face_crop, name)
            quality = assess_face_quality(face_crop)

        # Feature 5: Server-side temporal smoothing
        person_key = name if name != "Bilinmeyen Kişi" else f"unk_{left}_{top}"
        smoothed_emotion = _smooth_emotion(person_key, raw_emotion)

        tr_emotion = EMOTION_TR.get(smoothed_emotion, "Bilinmiyor")

        detections.append({
            "name": name,
            "confidence": round(face_confidence, 2),
            "emotion": tr_emotion,
            "raw_emotion": raw_emotion,
            "smoothed_emotion": smoothed_emotion,
            "emotion_confidence": round(emotion_conf, 2),
            "box": [top, right, bottom, left],
            "face_quality": quality,
        })

    return detections
