# face_utils.py
from deepface import DeepFace
import os
import threading

# ใช้ absolute path เพื่อไม่ให้ไฟล์หลุดจาก cwd ของ Flask reloader
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FACES_DIR = os.path.join(BASE_DIR, "faces")

# opencv ใช้ไม่ได้บน OpenCV 5 (ไม่มี haarcascade) — retinaface เสถียรและเร็วกว่า mtcnn
MODEL_NAME = "VGG-Face"
DETECTOR = "retinaface"
DISTANCE_METRIC = "cosine"

_recognize_lock = threading.Lock()


def init_faces_dir():
    """สร้างโฟลเดอร์เก็บรูปถ่าย"""
    os.makedirs(FACES_DIR, exist_ok=True)


def sanitize_filename(name):
    """
    ป้องกันปัญหา "non-english characters" ใน DeepFace
    """
    safe_name = name.encode('utf-8').hex()
    return safe_name


def _list_face_images():
    return [
        os.path.join(FACES_DIR, f)
        for f in os.listdir(FACES_DIR)
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
    ]


def clear_representation_cache():
    """ลบไฟล์ .pkl ของ DeepFace ในโฟลเดอร์ faces"""
    for f in os.listdir(FACES_DIR):
        if f.endswith('.pkl'):
            path = os.path.join(FACES_DIR, f)
            try:
                os.remove(path)
                print(f"--- DEBUG: Removed representation cache: {path}")
            except OSError as e:
                print(f"--- DEBUG: Could not remove {path}: {e}")


def refresh_embeddings():
    """
    สร้าง embedding ล่วงหน้าหลังเพิ่ม/แก้รูปนักเรียน
    เพื่อไม่ให้ DeepFace.find ต้อง rebuild ทุกครั้งที่สแกน
    """
    images = _list_face_images()
    if not images:
        return

    clear_representation_cache()
    print(f"--- DEBUG: Building face embeddings for {len(images)} image(s)...")
    # ใช้รูปแรกเป็น query เพื่อบังคับให้ DeepFace สร้าง representations ของทั้งโฟลเดอร์
    DeepFace.find(
        img_path=images[0],
        db_path=FACES_DIR,
        model_name=MODEL_NAME,
        detector_backend=DETECTOR,
        distance_metric=DISTANCE_METRIC,
        enforce_detection=False,
        silent=True,
    )
    print("--- DEBUG: Face embeddings ready.")


def save_face_image(image_data, student_name):
    """บันทึกรูปถ่ายนักเรียน"""
    try:
        safe_name = sanitize_filename(student_name)
        filename = f"{safe_name}.jpg"
        filepath = os.path.join(FACES_DIR, filename)

        # คุณภาพคงที่ เพื่อลดโอกาสที่ DeepFace มองว่าไฟล์ถูก replace
        image_data.convert("RGB").save(filepath, format="JPEG", quality=95)

        print(f"--- DEBUG: Image saved to ASCII-safe path: {filepath}")
        return {"success": True, "filepath": filepath, "safe_name": safe_name}
    except Exception as e:
        print(f"--- DEBUG: Error in save_face_image: {e}")
        return {"success": False, "message": f"บันทึกรูปไม่สำเร็จ: {str(e)}"}


def detect_face(image_path):
    """ตรวจสอบว่ามีใบหน้าในภาพหรือไม่"""
    print(f"\n--- DEBUG: Starting face detection for: {image_path}")

    if not os.path.exists(image_path):
        print(f"--- DEBUG: ERROR! File does not exist at path: {image_path}")
        return False

    try:
        print(f"--- DEBUG: Calling DeepFace.extract_faces with backend '{DETECTOR}'...")
        faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend=DETECTOR,
            enforce_detection=True
        )
        print(f"--- DEBUG: DeepFace found {len(faces)} face(s).")
        return len(faces) > 0

    except ValueError as ve:
        print(f"--- DEBUG: DeepFace raised ValueError (Likely no face found): {ve}")
        return False
    except Exception as e:
        print(f"--- DEBUG: An UNEXPECTED error occurred in detect_face!")
        print(f"--- DEBUG: Error Type: {type(e).__name__}")
        print(f"--- DEBUG: Error Details: {e}")
        raise e


def recognize_face(image_path):
    """จับคู่ใบหน้ากับฐานข้อมูล (มี lock กัน request ซ้อน)"""
    if not _recognize_lock.acquire(blocking=False):
        return {"success": False, "message": "ระบบกำลังสแกนอยู่ กรุณารอสักครู่"}

    try:
        print(f"\n--- DEBUG: Starting face recognition for: {image_path}")
        face_images = _list_face_images()
        if not face_images:
            return {"success": False, "message": "ยังไม่มีข้อมูลใบหน้าในระบบ"}

        print(f"--- DEBUG: Calling DeepFace.find with backend '{DETECTOR}'...")
        result = DeepFace.find(
            img_path=image_path,
            db_path=FACES_DIR,
            model_name=MODEL_NAME,
            enforce_detection=True,
            detector_backend=DETECTOR,
            distance_metric=DISTANCE_METRIC,
            silent=True,
        )

        if len(result) > 0 and len(result[0]) > 0:
            matched_path = result[0]['identity'].iloc[0]
            hex_name = os.path.splitext(os.path.basename(matched_path))[0]

            distance = float(result[0]['distance'].iloc[0])
            confidence = (1 - distance) * 100
            print(f"--- DEBUG: Face recognized, hex_name: {hex_name} with confidence {confidence:.2f}%")

            return {
                "success": True,
                "hex_name": hex_name,
                "confidence": round(confidence, 2)
            }

        print("--- DEBUG: DeepFace.find did not find any matching face.")
        return {"success": False, "message": "ไม่พบใบหน้าที่ตรงกัน"}

    except ValueError as ve:
        print(f"--- DEBUG: DeepFace raised ValueError during recognition: {ve}")
        return {"success": False, "message": "ไม่พบใบหน้าในภาพ"}
    except Exception as e:
        print(f"--- DEBUG: An UNEXPECTED error occurred in recognize_face: {e}")
        return {"success": False, "message": f"เกิดข้อผิดพลาด: {str(e)}"}
    finally:
        _recognize_lock.release()


init_faces_dir()
