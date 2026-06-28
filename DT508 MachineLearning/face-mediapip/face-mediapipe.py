from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# =========================
# ตั้งค่า
# =========================

MODEL_PATH = Path("face_landmarker.task")

USE_CAMERA = True
VIDEO_SOURCE = 0
# VIDEO_SOURCE = "videos/ryan.mp4"

WINDOW_NAME = "MediaPipe Tasks Face Smile Detection"

# ถ้าใช้วิดีโอ 1.0 = ปกติ, 0.5 = ช้าลง
video_speed = 1.0

# จำนวนหน้าสูงสุดที่ต้องการตรวจ
max_num_faces = 3

# เกณฑ์ดูว่ายิ้มไหม
# ค่าน้อย = จับยิ้มง่ายขึ้น แต่อาจมั่วขึ้น
# ค่ามาก = จับยิ้มยากขึ้น แต่แม่นขึ้น
smile_threshold = 0.35

# ใช้กันนับยิ้มซ้ำทุกเฟรม
min_smile_frames = 5
min_not_smile_frames = 5
max_distance = 120
max_missing_frames = 10


# =========================
# ตัวแปรนับยิ้ม / tracking
# =========================

tracks = {}
next_track_id = 1
total_smile_count = 0


def get_distance(p1, p2):
    return float(np.linalg.norm(np.array(p1) - np.array(p2)))


def get_blendshape_score(face_blendshapes, category_name):
    for category in face_blendshapes:
        if category.category_name == category_name:
            return category.score

    return 0.0


def get_smile_score(face_blendshapes):
    left_score = get_blendshape_score(face_blendshapes, "mouthSmileLeft")
    right_score = get_blendshape_score(face_blendshapes, "mouthSmileRight")

    return (left_score + right_score) / 2


def normalized_to_pixel(landmark, frame_width, frame_height):
    x = int(landmark.x * frame_width)
    y = int(landmark.y * frame_height)

    return x, y


def get_face_box(face_landmarks, frame_width, frame_height):
    xs = [int(lm.x * frame_width) for lm in face_landmarks]
    ys = [int(lm.y * frame_height) for lm in face_landmarks]

    x_min = max(min(xs), 0)
    y_min = max(min(ys), 0)
    x_max = min(max(xs), frame_width - 1)
    y_max = min(max(ys), frame_height - 1)

    return x_min, y_min, x_max, y_max


def get_face_centroid(face_box):
    x_min, y_min, x_max, y_max = face_box

    cx = (x_min + x_max) // 2
    cy = (y_min + y_max) // 2

    return cx, cy


def get_mouth_points(face_landmarks, frame_width, frame_height):
    # จุดปากโดยประมาณจาก FaceMesh landmark
    # 61 = มุมปากซ้าย, 291 = มุมปากขวา, 13 = ริมฝีปากบน, 14 = ริมฝีปากล่าง
    mouth_indices = [61, 291, 13, 14]

    points = []

    for index in mouth_indices:
        landmark = face_landmarks[index]
        point = normalized_to_pixel(landmark, frame_width, frame_height)
        points.append(point)

    return points


def update_tracks(detections):
    global next_track_id

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
            track["centroid"] = detection["centroid"]
            track["mouth_points"] = detection["mouth_points"]
            track["is_smiling"] = detection["is_smiling"]
            track["smile_score"] = detection["smile_score"]
            track["missing"] = 0

            used_track_ids.add(best_track_id)

        else:
            tracks[next_track_id] = {
                "face_box": detection["face_box"],
                "centroid": detection["centroid"],
                "mouth_points": detection["mouth_points"],
                "is_smiling": detection["is_smiling"],
                "smile_score": detection["smile_score"],
                "missing": 0,
                "smile_frames": 0,
                "not_smile_frames": 0,
                "is_counting_smile": False
            }

            used_track_ids.add(next_track_id)
            next_track_id += 1

    for track_id in list(tracks.keys()):
        if tracks[track_id]["missing"] > max_missing_frames:
            del tracks[track_id]


def update_smile_count():
    global total_smile_count

    current_people_count = 0
    current_smiling_count = 0

    for track in tracks.values():
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

    return current_people_count, current_smiling_count


def draw_results(frame, people_count, smiling_count):
    for track_id, track in tracks.items():
        if track["missing"] != 0:
            continue

        x_min, y_min, x_max, y_max = track["face_box"]
        is_smiling = track["is_smiling"]
        smile_score = track["smile_score"]

        color = (0, 255, 0) if is_smiling else (0, 0, 255)
        status = "Smiling" if is_smiling else "Not Smiling"

        # กรอบหน้า
        cv2.rectangle(
            frame,
            (x_min, y_min),
            (x_max, y_max),
            color,
            2
        )

        cv2.putText(
            frame,
            f"Person {track_id}: {status} {smile_score:.2f}",
            (x_min, y_min - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2
        )

        # จุดปาก
        mouth_points = track["mouth_points"]

        for point in mouth_points:
            cv2.circle(frame, point, 4, (255, 255, 0), -1)

        # กรอบคร่าว ๆ รอบปาก
        mouth_xs = [p[0] for p in mouth_points]
        mouth_ys = [p[1] for p in mouth_points]

        mx1 = min(mouth_xs) - 10
        my1 = min(mouth_ys) - 10
        mx2 = max(mouth_xs) + 10
        my2 = max(mouth_ys) + 10

        cv2.rectangle(
            frame,
            (mx1, my1),
            (mx2, my2),
            (255, 255, 0),
            2
        )

        cv2.putText(
            frame,
            "MOUTH",
            (mx1, my1 - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 0),
            2
        )

    cv2.putText(
        frame,
        f"People: {people_count}",
        (10, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        f"Smiling Now: {smiling_count}",
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


def main():
    if not MODEL_PATH.exists():
        print(f"ไม่พบไฟล์โมเดล: {MODEL_PATH}")
        print("ให้ดาวน์โหลด face_landmarker.task มาไว้ในโฟลเดอร์เดียวกับไฟล์ Python")
        return

    if USE_CAMERA:
        cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_AVFOUNDATION)
    else:
        cap = cv2.VideoCapture(VIDEO_SOURCE)

    if not cap.isOpened():
        print("Cannot open video source")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps == 0:
        fps = 30

    delay = int((1000 / fps) / video_speed)

    BaseOptions = python.BaseOptions
    FaceLandmarker = vision.FaceLandmarker
    FaceLandmarkerOptions = vision.FaceLandmarkerOptions
    VisionRunningMode = vision.RunningMode

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=VisionRunningMode.VIDEO,
        num_faces=max_num_faces,
        output_face_blendshapes=True,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    frame_index = 0

    with FaceLandmarker.create_from_options(options) as landmarker:
        while True:
            ret, frame = cap.read()

            if not ret or frame is None:
                break

            if USE_CAMERA:
                frame = cv2.flip(frame, 1)

            frame_height, frame_width = frame.shape[:2]

            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame = np.ascontiguousarray(rgb_frame)

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            timestamp_ms = int((frame_index / fps) * 1000)

            result = landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            detections = []

            if result.face_landmarks:
                for index, face_landmarks in enumerate(result.face_landmarks):
                    face_box = get_face_box(
                        face_landmarks,
                        frame_width,
                        frame_height
                    )

                    centroid = get_face_centroid(face_box)

                    mouth_points = get_mouth_points(
                        face_landmarks,
                        frame_width,
                        frame_height
                    )

                    smile_score = 0.0

                    if result.face_blendshapes:
                        face_blendshapes = result.face_blendshapes[index]
                        smile_score = get_smile_score(face_blendshapes)

                    is_smiling = smile_score >= smile_threshold

                    detections.append({
                        "face_box": face_box,
                        "centroid": centroid,
                        "mouth_points": mouth_points,
                        "smile_score": smile_score,
                        "is_smiling": is_smiling
                    })

            update_tracks(detections)

            people_count, smiling_count = update_smile_count()

            draw_results(frame, people_count, smiling_count)

            cv2.imshow(WINDOW_NAME, frame)

            key = cv2.waitKey(delay) & 0xFF

            if key == ord("q") or key == 27:
                break

            frame_index += 1

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()