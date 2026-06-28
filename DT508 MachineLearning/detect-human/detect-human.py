import cv2
from pathlib import Path


# =========================
# ตั้งค่า
# =========================

VIDEO_PATH = Path("videos/ryan.mp4")
USE_CAMERA = True  # True = ใช้กล้อง, False = ใช้วิดีโอ

video_speed = 1

# ตรวจจับใบหน้า
face_scale_factor = 1.1
face_min_neighbors = 5
min_face_size = (80, 80)

# ตรวจจับรอยยิ้ม
smile_scale_factor = 1.5
smile_min_neighbors = 12
min_smile_size = (20, 10)

# นับยิ้มแบบไม่ซ้ำ
min_smile_frames = 5
min_not_smile_frames = 5

# tracking คน
max_distance = 120
max_missing_frames = 10


# =========================
# โหลด Cascade
# =========================

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

smile_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_smile.xml"
)

if face_cascade.empty():
    print("โหลด face cascade ไม่สำเร็จ")
    exit()

if smile_cascade.empty():
    print("โหลด smile cascade ไม่สำเร็จ")
    exit()


# =========================
# เปิดวิดีโอหรือกล้อง
# =========================

if USE_CAMERA:
    cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)
else:
    cap = cv2.VideoCapture(str(VIDEO_PATH))

if not cap.isOpened():
    print("ไม่สามารถเปิดวิดีโอหรือกล้องได้")
    exit()


fps = cap.get(cv2.CAP_PROP_FPS)

if fps == 0:
    fps = 30

delay = int((1000 / fps) / video_speed)


# =========================
# ตัวแปร Tracking และนับยิ้ม
# =========================

tracks = {}
next_track_id = 1
total_smile_count = 0


def get_centroid(x, y, w, h):
    cx = x + w // 2
    cy = y + h // 2
    return cx, cy


def get_distance(p1, p2):
    return ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5


def get_largest_box(boxes):
    if len(boxes) == 0:
        return None

    return max(boxes, key=lambda box: box[2] * box[3])


# =========================
# เริ่มอ่านเฟรม
# =========================

while True:
    ret, frame = cap.read()

    if not ret or frame is None:
        print("วิดีโอจบแล้ว")
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=face_scale_factor,
        minNeighbors=face_min_neighbors,
        minSize=min_face_size
    )

    detections = []

    # =========================
    # Detect ใบหน้า + ปาก + ยิ้ม
    # =========================

    for (x, y, w, h) in faces:
        # กำหนดพื้นที่ปาก 1 จุดต่อ 1 ใบหน้า
        mouth_y_start = y + int(h * 0.50)
        mouth_y_end = y + h

        mouth_x_start = x
        mouth_x_end = x + w

        mouth_roi_gray = gray[mouth_y_start:mouth_y_end, mouth_x_start:mouth_x_end]

        if mouth_roi_gray.size == 0:
            continue

        smiles = smile_cascade.detectMultiScale(
            mouth_roi_gray,
            scaleFactor=smile_scale_factor,
            minNeighbors=smile_min_neighbors,
            minSize=min_smile_size
        )

        largest_smile = get_largest_box(smiles)

        is_smiling = largest_smile is not None

        centroid = get_centroid(x, y, w, h)

        detections.append({
            "face_box": (x, y, w, h),
            "mouth_box": (
                mouth_x_start,
                mouth_y_start,
                mouth_x_end - mouth_x_start,
                mouth_y_end - mouth_y_start
            ),
            "smile_box": largest_smile,
            "is_smiling": is_smiling,
            "centroid": centroid
        })

    # =========================
    # Update tracking
    # =========================

    for track_id in list(tracks.keys()):
        tracks[track_id]["missing"] += 1

    used_track_ids = set()

    for detection in detections:
        best_track_id = None
        best_distance = float("inf")

        for track_id, track in tracks.items():
            if track_id in used_track_ids:
                continue

            distance = get_distance(
                detection["centroid"],
                track["centroid"]
            )

            if distance < best_distance:
                best_distance = distance
                best_track_id = track_id

        if best_track_id is not None and best_distance < max_distance:
            track = tracks[best_track_id]

            track["face_box"] = detection["face_box"]
            track["mouth_box"] = detection["mouth_box"]
            track["smile_box"] = detection["smile_box"]
            track["is_smiling"] = detection["is_smiling"]
            track["centroid"] = detection["centroid"]
            track["missing"] = 0

            detection["track_id"] = best_track_id
            used_track_ids.add(best_track_id)

        else:
            tracks[next_track_id] = {
                "face_box": detection["face_box"],
                "mouth_box": detection["mouth_box"],
                "smile_box": detection["smile_box"],
                "is_smiling": detection["is_smiling"],
                "centroid": detection["centroid"],
                "missing": 0,
                "smile_frames": 0,
                "not_smile_frames": 0,
                "is_counting_smile": False
            }

            detection["track_id"] = next_track_id
            used_track_ids.add(next_track_id)
            next_track_id += 1

    # ลบคนที่หายไปนาน
    for track_id in list(tracks.keys()):
        if tracks[track_id]["missing"] > max_missing_frames:
            del tracks[track_id]

    # =========================
    # นับยิ้มสะสม
    # =========================

    current_people_count = 0
    current_smiling_count = 0

    for track_id, track in tracks.items():
        if track["missing"] != 0:
            continue

        current_people_count += 1

        if track["is_smiling"]:
            current_smiling_count += 1
            track["smile_frames"] += 1
            track["not_smile_frames"] = 0
        else:
            track["not_smile_frames"] += 1
            track["smile_frames"] = 0

        if (
            track["smile_frames"] >= min_smile_frames
            and not track["is_counting_smile"]
        ):
            total_smile_count += 1
            track["is_counting_smile"] = True

        if track["not_smile_frames"] >= min_not_smile_frames:
            track["is_counting_smile"] = False

    # =========================
    # วาดกรอบและข้อความ
    # =========================

    for track_id, track in tracks.items():
        if track["missing"] != 0:
            continue

        x, y, w, h = track["face_box"]
        mx, my, mw, mh = track["mouth_box"]

        is_smiling = track["is_smiling"]
        status = "Smiling" if is_smiling else "Not Smiling"

        face_color = (0, 255, 0) if is_smiling else (255, 0, 0)

        # กรอบหน้า
        cv2.rectangle(
            frame,
            (x, y),
            (x + w, y + h),
            face_color,
            2
        )

        cv2.putText(
            frame,
            f"Person {track_id}: {status}",
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            face_color,
            2
        )

        # กรอบพื้นที่ปาก 1 จุดต่อ 1 ใบหน้า
        cv2.rectangle(
            frame,
            (mx, my),
            (mx + mw, my + mh),
            (0, 255, 255),
            2
        )

        cv2.putText(
            frame,
            "MOUTH AREA",
            (mx, my - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 255, 255),
            2
        )

        # ถ้าตรวจเจอยิ้ม ให้วาดกรอบยิ้มภายในพื้นที่ปาก
        if track["smile_box"] is not None:
            sx, sy, sw, sh = track["smile_box"]

            real_sx = mx + sx
            real_sy = my + sy

            cv2.rectangle(
                frame,
                (real_sx, real_sy),
                (real_sx + sw, real_sy + sh),
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                "SMILE",
                (real_sx, real_sy - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2
            )

    # =========================
    # แสดงผลรวม
    # =========================

    cv2.putText(
        frame,
        f"People: {current_people_count}",
        (10, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"Smiling Now: {current_smiling_count}",
        (10, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    cv2.putText(
        frame,
        f"Total Smile Count: {total_smile_count}",
        (10, 115),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 0, 255),
        2
    )

    cv2.imshow("Face Mouth Smile Detection", frame)

    key = cv2.waitKey(delay) & 0xFF

    if key == ord("q") or key == 27:
        break


cap.release()
cv2.destroyAllWindows()