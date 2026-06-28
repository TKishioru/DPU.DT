from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


#VIDEO_SOURCE = 0  # เปิดกล้อง
VIDEO_SOURCE = "videos/WIN_20220925_13_54_04_Pro.mp4"  # เป็นคลิป

MODEL_PATH = Path(__file__).resolve().parent / "pose_landmarker_lite.task"
WINDOW_NAME = "MediaPipe Body Tracking"

VIDEO_SPEED = 1.0

LANDMARK_COLOR = (0, 0, 255)
LINE_COLOR = (0, 255, 0)
BOX_COLOR = (255, 255, 0)

LANDMARK_RADIUS = 4
LINE_THICKNESS = 2


POSE_CONNECTIONS = [
    # ใบหน้า / ศีรษะ
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),

    # ไหล่ แขน
    (11, 12),
    (11, 13), (13, 15),
    (12, 14), (14, 16),

    # มือโดยประมาณ
    (15, 17), (17, 19), (19, 21),
    (16, 18), (18, 20), (20, 22),

    # ลำตัว
    (11, 23), (12, 24), (23, 24),

    # ขา
    (23, 25), (25, 27), (27, 29), (29, 31),
    (24, 26), (26, 28), (28, 30), (30, 32),
]


def normalized_to_pixel(landmark, frame_width, frame_height):
    x = int(landmark.x * frame_width)
    y = int(landmark.y * frame_height)

    x = max(0, min(x, frame_width - 1))
    y = max(0, min(y, frame_height - 1))

    return x, y


def create_mp_image(frame):
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_frame = np.ascontiguousarray(rgb_frame)

    return mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb_frame
    )


def create_pose_landmarker():
    base_options = python.BaseOptions(
        model_asset_path=str(MODEL_PATH)
    )

    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    return vision.PoseLandmarker.create_from_options(options)


def draw_pose(frame, pose_landmarks, pose_id=1):
    frame_height, frame_width = frame.shape[:2]

    points = []

    for landmark in pose_landmarks:
        point = normalized_to_pixel(
            landmark,
            frame_width,
            frame_height
        )
        points.append(point)

    # วาดเส้นเชื่อมร่างกาย
    for start_idx, end_idx in POSE_CONNECTIONS:
        if start_idx >= len(points) or end_idx >= len(points):
            continue

        cv2.line(
            frame,
            points[start_idx],
            points[end_idx],
            LINE_COLOR,
            LINE_THICKNESS
        )

    # วาดจุด landmark
    for point in points:
        cv2.circle(
            frame,
            point,
            LANDMARK_RADIUS,
            LANDMARK_COLOR,
            -1
        )

    # วาดกรอบรอบร่างกาย
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
        BOX_COLOR,
        2
    )

    cv2.putText(
        frame,
        f"Body {pose_id}",
        (x_min, y_min - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        BOX_COLOR,
        2
    )


def main():
    if not MODEL_PATH.exists():
        print(f"ไม่พบไฟล์โมเดล: {MODEL_PATH}")
        print("กรุณาดาวน์โหลด pose_landmarker_lite.task มาไว้ในโฟลเดอร์เดียวกับไฟล์ Python")
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

    with create_pose_landmarker() as pose_landmarker:
        while True:
            success, frame = cap.read()

            if not success or frame is None:
                break

            if VIDEO_SOURCE == 0:
                frame = cv2.flip(frame, 1)

            mp_image = create_mp_image(frame)

            timestamp_ms = int((frame_index / fps) * 1000)

            result = pose_landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            body_count = 0

            if result.pose_landmarks:
                body_count = len(result.pose_landmarks)

                for index, pose_landmarks in enumerate(result.pose_landmarks, start=1):
                    draw_pose(frame, pose_landmarks, index)

            cv2.putText(
                frame,
                f"Bodies: {body_count}",
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