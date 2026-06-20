import cv2
import numpy as np
from deepface import DeepFace
from load_faces import load_known_faces


# โหลดข้อมูลใบหน้าจาก SQLite
person_face_encodings, person_face_names = load_known_faces()


def find_match(embedding, threshold=0.4):
    """ฟังก์ชันเปรียบเทียบใบหน้ากับที่รู้จัก"""
    min_dist = float("inf")
    match_name = "UNKNOWN"

    for known_enc, name in zip(person_face_encodings, person_face_names):
        dist = np.linalg.norm(np.array(embedding) - np.array(known_enc))

        if dist < min_dist:
            min_dist = dist
            match_name = name

    print(f"Best: {match_name} (dist={min_dist:.2f})")

    return match_name if min_dist < threshold else "UNKNOWN"


# เปิดกล้องสำหรับ Mac
videoCapture = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)

if not videoCapture.isOpened():
    print("Cannot open camera")
    exit()

frameProcess = True
data_locations = []
data_names = []


while True:
    ret, frame = videoCapture.read()

    if not ret:
        print("Cannot receive frame")
        break

    # ลดขนาดภาพเพื่อให้ประมวลผลเร็วขึ้น
    resizing = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)

    # ประมวลผลใบหน้าแบบข้ามเฟรม
    if frameProcess:
        try:
            results = DeepFace.represent(
                img_path=resizing,
                model_name="VGG-Face",
                enforce_detection=False
            )

            data_locations = []
            data_names = []

            for face in results:
                embedding = face["embedding"]
                region = face["facial_area"]

                # scale กลับ x4 เพราะ resize 0.25
                x = int(region["x"] * 4)
                y = int(region["y"] * 4)
                w = int(region["w"] * 4)
                h = int(region["h"] * 4)

                name = find_match(embedding)

                data_locations.append((x, y, w, h))
                data_names.append(name)

        except Exception as e:
            print("DeepFace error:", e)

    frameProcess = not frameProcess

    # วาดกรอบและชื่อบนภาพ
    for (x, y, w, h), name in zip(data_locations, data_names):
        cv2.rectangle(frame, (x, y), (x + w, y + h), (26, 174, 10), 2)
        cv2.rectangle(frame, (x, y + h - 35), (x + w, y + h), (26, 174, 10), cv2.FILLED)
        cv2.putText(
            frame,
            name,
            (x + 6, y + h - 6),
            cv2.FONT_HERSHEY_DUPLEX,
            1.0,
            (255, 255, 255),
            1
        )

    # แสดงผล ต้องอยู่ใน while แต่ไม่ควรอยู่ใน for
    cv2.imshow("Face Recognition", frame)

    # กด q เพื่อปิดโปรแกรม
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


videoCapture.release()
cv2.destroyAllWindows()