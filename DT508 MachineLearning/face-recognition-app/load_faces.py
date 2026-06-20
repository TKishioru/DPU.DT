import sqlite3
from deepface import DeepFace
import numpy as np
def load_known_faces():
    person_face_encodings = []
    person_face_names = []
    # เชื่อมต่อ SQLite
    conn = sqlite3.connect("face_recognition.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name, image FROM persons")
    rows = cursor.fetchall()
    conn.close()
     # โหลด face encoding จากแต่ละคน
    for name, image_file in rows:
        try:
            result = DeepFace.represent(
                img_path=f"images/{image_file}",
                model_name="VGG-Face",
                enforce_detection=False
            )
            encoding = result[0]["embedding"]
            person_face_names.append(name)
            person_face_encodings.append(encoding)
            print(f"โหลดใบหน้า: {name}")
        except Exception as e:
            print(f"โหลดไม่ได้: {name} → {e}")
    return person_face_encodings, person_face_names