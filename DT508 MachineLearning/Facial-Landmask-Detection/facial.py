from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# =========================
# Config
# =========================

VIDEO_SOURCE = 0
# VIDEO_SOURCE = "videos/WIN_20220925_13_54_04_Pro.mp4"

FACE_MODEL_PATH = Path("face_landmarker.task")
HAND_MODEL_PATH = Path("hand_landmarker.task")
POSE_MODEL_PATH = Path("pose_landmarker_lite.task")

WINDOW_NAME = "Face Hand Body Detection"

VIDEO_SPEED = 1.0

MAX_NUM_FACES = 1
MAX_NUM_HANDS = 2
MAX_NUM_POSES = 1


# =========================
# Connections
# =========================

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (0, 9), (9, 10), (10, 11), (11, 12),     # middle
    (0, 13), (13, 14), (14, 15), (15, 16),   # ring
    (0, 17), (17, 18), (18, 19), (19, 20),   # pinky
    (5, 9), (9, 13), (13, 17)
]

POSE_CONNECTIONS = [
    # face / head
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),

    # upper body
    (11, 12),
    (11, 13), (13, 15),
    (12, 14), (14, 16),

    # hands approximate
    (15, 17), (17, 19), (19, 21),
    (16, 18), (18, 20), (20, 22),

    # torso
    (11, 23), (12, 24), (23, 24),

    # legs
    (23, 25), (25, 27), (27, 29), (29, 31),
    (24, 26), (26, 28), (28, 30), (30, 32),
]


# =========================
# Utility functions
# =========================

def check_model_files():
    model_files = [
        FACE_MODEL_PATH,
        HAND_MODEL_PATH,
        POSE_MODEL_PATH
    ]

    for model_path in model_files:
        if not model_path.exists():
            print(f"ไม่พบไฟล์โมเดล: {model_path}")
            return False

    return True


def normalized_to_pixel(landmark, frame_width, frame_height):
    x = int(landmark.x * frame_width)
    y = int(landmark.y * frame_height)

    return x, y


def create_mp_image(frame):
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame)

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )

    return mp_image


# =========================
# Create detector functions
# =========================

def create_face_landmarker():
    base_options = python.BaseOptions(
        model_asset_path=str(FACE_MODEL_PATH)
    )

    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=MAX_NUM_FACES,
        output_face_blendshapes=True,
        output_facial_transformation_matrixes=False,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.FaceLandmarker.create_from_options(options)


def create_hand_landmarker():
    base_options = python.BaseOptions(
        model_asset_path=str(HAND_MODEL_PATH)
    )

    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_hands=MAX_NUM_HANDS,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.HandLandmarker.create_from_options(options)


def create_pose_landmarker():
    base_options = python.BaseOptions(
        model_asset_path=str(POSE_MODEL_PATH)
    )

    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=MAX_NUM_POSES,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.PoseLandmarker.create_from_options(options)


# =========================
# Detection functions
# =========================

def detect_face(face_landmarker, mp_image, timestamp_ms):
    return face_landmarker.detect_for_video(
        mp_image,
        timestamp_ms
    )


def detect_hands(hand_landmarker, mp_image, timestamp_ms):
    return hand_landmarker.detect_for_video(
        mp_image,
        timestamp_ms
    )


def detect_pose(pose_landmarker, mp_image, timestamp_ms):
    return pose_landmarker.detect_for_video(
        mp_image,
        timestamp_ms
    )


# =========================
# Draw face
# =========================

def draw_face_results(frame, face_result):
    frame_height, frame_width = frame.shape[:2]

    face_count = 0

    if not face_result.face_landmarks:
        return face_count

    face_count = len(face_result.face_landmarks)

    for face_index, face_landmarks in enumerate(face_result.face_landmarks, start=1):
        points = [
            normalized_to_pixel(lm, frame_width, frame_height)
            for lm in face_landmarks
        ]

        xs = [p[0] for p in points]
        ys = [p[1] for p in points]

        x_min = max(min(xs), 0)
        y_min = max(min(ys), 0)
        x_max = min(max(xs), frame_width - 1)
        y_max = min(max(ys), frame_height - 1)

        # กรอบใบหน้า
        cv2.rectangle(
            frame,
            (x_min, y_min),
            (x_max, y_max),
            (255, 0, 0),
            2
        )

        cv2.putText(
            frame,
            f"Face {face_index}",
            (x_min, y_min - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 0, 0),
            2
        )

        # วาด landmark บางส่วนเพื่อลดความรก
        for point in points[::3]:
            cv2.circle(
                frame,
                point,
                1,
                (0, 165, 255),
                -1
            )

        # จุดปากหลัก
        mouth_indices = [61, 291, 13, 14]

        mouth_points = []

        for index in mouth_indices:
            if index < len(points):
                mouth_points.append(points[index])
                cv2.circle(
                    frame,
                    points[index],
                    4,
                    (0, 255, 255),
                    -1
                )

        if mouth_points:
            mx1 = min(p[0] for p in mouth_points) - 10
            my1 = min(p[1] for p in mouth_points) - 10
            mx2 = max(p[0] for p in mouth_points) + 10
            my2 = max(p[1] for p in mouth_points) + 10

            cv2.rectangle(
                frame,
                (mx1, my1),
                (mx2, my2),
                (0, 255, 255),
                2
            )

            cv2.putText(
                frame,
                "Mouth",
                (mx1, my1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 255),
                2
            )

    return face_count


# =========================
# Draw hands
# =========================

def draw_hand_results(frame, hand_result):
    frame_height, frame_width = frame.shape[:2]

    hand_count = 0

    if not hand_result.hand_landmarks:
        return hand_count

    hand_count = len(hand_result.hand_landmarks)

    for hand_index, hand_landmarks in enumerate(hand_result.hand_landmarks, start=1):
        points = [
            normalized_to_pixel(lm, frame_width, frame_height)
            for lm in hand_landmarks
        ]

        # วาดเส้นมือ
        for start_idx, end_idx in HAND_CONNECTIONS:
            cv2.line(
                frame,
                points[start_idx],
                points[end_idx],
                (0, 255, 0),
                2
            )

        # วาดจุดมือ
        for point in points:
            cv2.circle(
                frame,
                point,
                3,
                (0, 0, 255),
                -1
            )

        # กรอบมือ
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]

        x_min = max(min(xs) - 10, 0)
        y_min = max(min(ys) - 10, 0)
        x_max = min(max(xs) + 10, frame_width - 1)
        y_max = min(max(ys) + 10, frame_height - 1)

        cv2.rectangle(
            frame,
            (x_min, y_min),
            (x_max, y_max),
            (0, 255, 0),
            2
        )

        cv2.putText(
            frame,
            f"Hand {hand_index}",
            (x_min, y_min - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

    return hand_count


# =========================
# Draw pose / body
# =========================

def draw_pose_results(frame, pose_result):
    frame_height, frame_width = frame.shape[:2]

    pose_count = 0

    if not pose_result.pose_landmarks:
        return pose_count

    pose_count = len(pose_result.pose_landmarks)

    for pose_index, pose_landmarks in enumerate(pose_result.pose_landmarks, start=1):
        points = [
            normalized_to_pixel(lm, frame_width, frame_height)
            for lm in pose_landmarks
        ]

        # วาดเส้นร่างกาย
        for start_idx, end_idx in POSE_CONNECTIONS:
            if start_idx >= len(points) or end_idx >= len(points):
                continue

            cv2.line(
                frame,
                points[start_idx],
                points[end_idx],
                (255, 255, 0),
                2
            )

        # วาดจุดร่างกาย
        for point in points:
            cv2.circle(
                frame,
                point,
                4,
                (255, 0, 255),
                -1
            )

        # กรอบร่างกาย
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]

        x_min = max(min(xs) - 20, 0)
        y_min = max(min(ys) - 20, 0)
        x_max = min(max(xs) + 20, frame_width - 1)
        y_max = min(max(ys) + 20, frame_height - 1)

        cv2.rectangle(
            frame,
            (x_min, y_min),
            (x_max, y_max),
            (255, 255, 0),
            2
        )

        cv2.putText(
            frame,
            f"Body {pose_index}",
            (x_min, y_min - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 0),
            2
        )

    return pose_count


# =========================
# Main
# =========================

def main():
    if not check_model_files():
        return

    if VIDEO_SOURCE == 0:
        cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_AVFOUNDATION)
    else:
        cap = cv2.VideoCapture(VIDEO_SOURCE)

    if not cap.isOpened():
        print("Cannot open video source")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps == 0:
        fps = 30

    delay = int((1000 / fps) / VIDEO_SPEED)

    frame_index = 0

    with (
        create_face_landmarker() as face_landmarker,
        create_hand_landmarker() as hand_landmarker,
        create_pose_landmarker() as pose_landmarker
    ):
        while True:
            ret, frame = cap.read()

            if not ret or frame is None:
                break

            if VIDEO_SOURCE == 0:
                frame = cv2.flip(frame, 1)

            mp_image = create_mp_image(frame)

            timestamp_ms = int((frame_index / fps) * 1000)

            face_result = detect_face(
                face_landmarker,
                mp_image,
                timestamp_ms
            )

            hand_result = detect_hands(
                hand_landmarker,
                mp_image,
                timestamp_ms
            )

            pose_result = detect_pose(
                pose_landmarker,
                mp_image,
                timestamp_ms
            )

            face_count = draw_face_results(frame, face_result)
            hand_count = draw_hand_results(frame, hand_result)
            body_count = draw_pose_results(frame, pose_result)

            cv2.putText(
                frame,
                f"Faces: {face_count}",
                (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 0, 0),
                2
            )

            cv2.putText(
                frame,
                f"Hands: {hand_count}",
                (10, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Bodies: {body_count}",
                (10, 115),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 0),
                2
            )

            cv2.imshow(WINDOW_NAME, frame)

            key = cv2.waitKey(delay) & 0xFF

            if key == ord("q") or key == 27:
                break

            frame_index += 1

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()