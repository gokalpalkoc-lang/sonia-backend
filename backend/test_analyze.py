import cv2
import numpy as np
from api.face_utils import save_calibration, load_calibrations

# Create a dummy image
img = np.zeros((100, 100, 3), dtype=np.uint8)

print("Starting save_calibration...")
try:
    success, msg = save_calibration("Bilinmeyen Kişi", "neutral", img)
    print("Result:", success, msg)
    
    # Load it back
    print("Loaded cals:", load_calibrations("Bilinmeyen Kişi"))
except Exception as e:
    import traceback
    traceback.print_exc()
