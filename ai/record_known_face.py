"""Record a known face from the webcam and save it for face recognition.

Features a tkinter-based setup wizard with live camera preview.

Usage:
    python ai/record_known_face.py
    python ai/record_known_face.py --name alice
    python ai/record_known_face.py --name bob --camera 0 --output-dir ai/known_faces
"""

from __future__ import annotations

import argparse
import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox
from typing import List, Optional

from PIL import Image, ImageTk

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


# ── Colour palette ──────────────────────────────────────────────────
BG        = "#0D0D1A"
CARD_BG   = "#16162A"
ACCENT    = "#4F46E5"
ACCENT_HL = "#6366F1"
TEXT      = "#FFFFFF"
TEXT_DIM  = "#8888AA"
SUCCESS   = "#22C55E"
DANGER    = "#EF4444"
BORDER    = "#2A2A44"


class FaceRecorderApp:
    """Tkinter-based face registration wizard."""

    def __init__(
        self,
        preset_name: str = "",
        output_dir: Path = Path("ai/known_faces"),
        camera_index: int = 0,
    ) -> None:
        self.output_dir = output_dir
        self.camera_index = camera_index
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        self.face_detected = False
        self.current_frame = None
        self.saved = False

        # ── Root window ─────────────────────────────────────────────
        self.root = tk.Tk()
        self.root.title("Sonia – Yüz Kayıt Sihirbazı")
        self.root.configure(bg=BG)
        self.root.resizable(False, False)

        # ── Header ──────────────────────────────────────────────────
        header = tk.Frame(self.root, bg=BG)
        header.pack(fill="x", padx=24, pady=(20, 0))

        logo_frame = tk.Frame(header, bg=ACCENT, width=40, height=40)
        logo_frame.pack_propagate(False)
        logo_frame.pack(side="left")
        tk.Label(logo_frame, text="🤖", font=("Segoe UI Emoji", 16), bg=ACCENT, fg=TEXT).place(
            relx=0.5, rely=0.5, anchor="center"
        )

        tk.Label(
            header, text="   Yüz Kayıt Sihirbazı", font=("Segoe UI", 16, "bold"), bg=BG, fg=TEXT
        ).pack(side="left")

        # ── Instruction card ────────────────────────────────────────
        card = tk.Frame(self.root, bg=CARD_BG, highlightbackground=BORDER, highlightthickness=1)
        card.pack(fill="x", padx=24, pady=16)

        tk.Label(
            card,
            text="Adınızı girin, kameranızı açın ve yüzünüzü kaydedin.",
            font=("Segoe UI", 11),
            bg=CARD_BG,
            fg=TEXT_DIM,
            wraplength=500,
            justify="left",
        ).pack(padx=16, pady=12)

        # ── Name input ──────────────────────────────────────────────
        input_frame = tk.Frame(self.root, bg=BG)
        input_frame.pack(fill="x", padx=24, pady=(0, 8))

        tk.Label(
            input_frame, text="İSİM", font=("Segoe UI", 9, "bold"), bg=BG, fg=TEXT_DIM
        ).pack(anchor="w")

        self.name_var = tk.StringVar(value=preset_name)
        name_entry = tk.Entry(
            input_frame,
            textvariable=self.name_var,
            font=("Segoe UI", 13),
            bg="#1E1E36",
            fg=TEXT,
            insertbackground=TEXT,
            relief="flat",
            highlightbackground=BORDER,
            highlightthickness=1,
        )
        name_entry.pack(fill="x", ipady=8, pady=(4, 0))

        # ── Camera preview ──────────────────────────────────────────
        preview_container = tk.Frame(self.root, bg=BORDER)
        preview_container.pack(padx=24, pady=12)

        self.canvas = tk.Canvas(preview_container, width=480, height=360, bg="#000", highlightthickness=0)
        self.canvas.pack(padx=2, pady=2)

        # Status label under preview
        self.status_var = tk.StringVar(value="Kamera kapalı")
        self.status_label = tk.Label(
            self.root, textvariable=self.status_var, font=("Segoe UI", 10), bg=BG, fg=TEXT_DIM
        )
        self.status_label.pack(pady=(0, 8))

        # ── Button row ──────────────────────────────────────────────
        btn_frame = tk.Frame(self.root, bg=BG)
        btn_frame.pack(fill="x", padx=24, pady=(0, 20))

        self.start_btn = self._make_button(btn_frame, "📷  Kamerayı Aç", ACCENT, self._start_camera)
        self.start_btn.pack(side="left", expand=True, fill="x", padx=(0, 6))

        self.capture_btn = self._make_button(btn_frame, "✅  Kaydet", SUCCESS, self._capture_face)
        self.capture_btn.pack(side="left", expand=True, fill="x", padx=(6, 6))
        self.capture_btn.configure(state="disabled")

        self.quit_btn = self._make_button(btn_frame, "✕  Kapat", DANGER, self._quit)
        self.quit_btn.pack(side="left", expand=True, fill="x", padx=(6, 0))

        self.root.protocol("WM_DELETE_WINDOW", self._quit)

    # ── helpers ─────────────────────────────────────────────────────
    @staticmethod
    def _make_button(parent: tk.Frame, text: str, colour: str, command) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            font=("Segoe UI", 12, "bold"),
            bg=colour,
            fg=TEXT,
            activebackground=colour,
            activeforeground=TEXT,
            relief="flat",
            cursor="hand2",
            command=command,
            padx=12,
            pady=10,
        )

    # ── camera logic ────────────────────────────────────────────────
    def _start_camera(self) -> None:
        if self.running:
            return
        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            messagebox.showerror("Hata", f"Kamera {self.camera_index} açılamadı.")
            return
        self.running = True
        self.start_btn.configure(state="disabled")
        self.capture_btn.configure(state="normal")
        self.status_var.set("Kamera açık – yüzünüzü çerçeveye yerleştirin")
        self._update_frame()

    def _update_frame(self) -> None:
        if not self.running:
            return
        ok, frame = self.cap.read()
        if not ok:
            self.status_var.set("Kameradan görüntü alınamadı!")
            return

        self.current_frame = frame.copy()

        # Face detection on a small copy
        small = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb_small)

        self.face_detected = len(locations) > 0

        # Draw rectangles on display frame
        for top, right, bottom, left in locations:
            top, right, bottom, left = top * 4, right * 4, bottom * 4, left * 4
            cv2.rectangle(frame, (left, top), (right, bottom), (79, 70, 229), 2)

        # Status update
        if self.face_detected:
            self.status_var.set(f"✓ {len(locations)} yüz algılandı – Kaydet'e basabilirsiniz")
            self.status_label.configure(fg=SUCCESS)
        else:
            self.status_var.set("Yüz algılanmadı – daha yakına gelin")
            self.status_label.configure(fg=TEXT_DIM)

        # Convert BGR → RGB → PIL → Tk, resize to canvas
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)
        img = img.resize((480, 360), Image.LANCZOS)
        self._photo = ImageTk.PhotoImage(image=img)
        self.canvas.create_image(0, 0, anchor="nw", image=self._photo)

        self.root.after(30, self._update_frame)

    def _capture_face(self) -> None:
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("Uyarı", "Lütfen bir isim girin.")
            return
        if not self.face_detected or self.current_frame is None:
            messagebox.showwarning("Uyarı", "Çerçevede yüz algılanmadı. Tekrar deneyin.")
            return

        rgb_full = cv2.cvtColor(self.current_frame, cv2.COLOR_BGR2RGB)
        encodings = face_recognition.face_encodings(rgb_full)
        if not encodings:
            messagebox.showwarning("Uyarı", "Yüz encode edilemedi. Tekrar deneyin.")
            return

        self.output_dir.mkdir(parents=True, exist_ok=True)
        out_path = self.output_dir / f"{name}.jpg"
        cv2.imwrite(str(out_path), self.current_frame)

        self.saved = True
        self.status_var.set(f"✓ '{name}' kaydedildi → {out_path}")
        self.status_label.configure(fg=SUCCESS)
        messagebox.showinfo("Başarılı", f"Yüz '{name}' olarak kaydedildi!\n{out_path}")
        self._quit()

    def _quit(self) -> None:
        self.running = False
        if self.cap and self.cap.isOpened():
            self.cap.release()
        self.root.destroy()

    def run(self) -> int:
        self.root.mainloop()
        return 0 if self.saved else 1


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Record a known face from the webcam")
    parser.add_argument("--name", default="", help="Pre-fill name label for the person")
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
    app = FaceRecorderApp(
        preset_name=args.name,
        output_dir=args.output_dir,
        camera_index=args.camera,
    )
    return app.run()


if __name__ == "__main__":
    sys.exit(main())
