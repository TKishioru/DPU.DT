from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


VIDEO_SOURCE = 0
MODEL_PATH = Path("hand_landmarker.task")

WINDOW_NAME = "Hand Tracking"

MAX_NUM_HANDS = 2
VIDEO_SPEED = 1.0

# จุดปลายนิ้วของ MediaPipe Hand Landmark
# 4 = thumb, 8 = index, 12 = middle, 16 = ring, 20 = pinky
FINGER_TIPS = [4, 8, 12, 16, 20]

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # thumb
    (0, 5), (5, 6), (6, 7), (7, 8),          # index
    (0, 9), (9, 10), (10, 11), (11, 12),     # middle
    (0, 13), (13, 14), (14, 15), (15, 16),   # ring
    (0, 17), (17, 18), (18, 19), (19, 20),   # pinky
    (5, 9), (9, 13), (13, 17)
]


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


def create_hand_landmarker():
    base_options = python.BaseOptions(
        model_asset_path=str(MODEL_PATH)
    )

    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_hands=MAX_NUM_HANDS,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.HandLandmarker.create_from_options(options)


def draw_hand(frame, hand_landmarks, hand_id):
    frame_height, frame_width = frame.shape[:2]

    points = [
        normalized_to_pixel(landmark, frame_width, frame_height)
        for landmark in hand_landmarks
    ]

    # วาดเส้นเชื่อมข้อนิ้ว
    for start_idx, end_idx in HAND_CONNECTIONS:
        cv2.line(
            frame,
            points[start_idx],
            points[end_idx],
            (0, 255, 0),
            2
        )

    # วาดจุด landmark ทั้งมือ
    for index, point in enumerate(points):
        cv2.circle(
            frame,
            point,
            4,
            (0, 0, 255),
            -1
        )

    # วาดวงกลมใหญ่ที่ปลายนิ้ว
    for tip_index in FINGER_TIPS:
        tip_point = points[tip_index]

        cv2.circle(
            frame,
            tip_point,
            12,
            (255, 0, 255),
            3
        )

        cv2.putText(
            frame,
            str(tip_index),
            (tip_point[0] + 8, tip_point[1] - 8),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 0, 255),
            2
        )

    # วาดกรอบรอบมือ
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]

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
        f"Hand {hand_id}",
        (x_min, y_min - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 0),
        2
    )


def main():
    if not MODEL_PATH.exists():
        print(f"ไม่พบไฟล์โมเดล: {MODEL_PATH}")
        print("กรุณาดาวน์โหลด hand_landmarker.task มาไว้ในโฟลเดอร์เดียวกับไฟล์ Python")
        return

    # สำหรับ Mac ใช้ CAP_AVFOUNDATION จะเปิดกล้องเสถียรกว่า
    cap = cv2.VideoCapture(VIDEO_SOURCE, cv2.CAP_AVFOUNDATION)

    if not cap.isOpened():
        print("Cannot open camera")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps == 0:
        fps = 30

    delay = int((1000 / fps) / VIDEO_SPEED)

    frame_index = 0

    with create_hand_landmarker() as hand_landmarker:
        while True:
            ret, frame = cap.read()

            if not ret or frame is None:
                break

            # กลับภาพเหมือนกระจก
            frame = cv2.flip(frame, 1)

            mp_image = create_mp_image(frame)

            timestamp_ms = int((frame_index / fps) * 1000)

            result = hand_landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            hand_count = 0

            if result.hand_landmarks:
                hand_count = len(result.hand_landmarks)

                for hand_id, hand_landmarks in enumerate(result.hand_landmarks, start=1):
                    draw_hand(frame, hand_landmarks, hand_id)

            cv2.putText(
                frame,
                f"Hands: {hand_count}",
                (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 255),
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