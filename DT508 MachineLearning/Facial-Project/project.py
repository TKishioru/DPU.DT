from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


# VIDEO_SOURCE = 0  # เปิดกล้อง
VIDEO_SOURCE = "videos/test1.mp4"  # เป็นคลิป

MODEL_PATH = Path(__file__).resolve().parent / "pose_landmarker_lite.task"
WINDOW_NAME = "Weight Lifting Counter"

VIDEO_SPEED = 1.0

LANDMARK_COLOR = (0, 0, 255)
LINE_COLOR = (0, 255, 0)
BOX_COLOR = (255, 255, 0)

LANDMARK_RADIUS = 4
LINE_THICKNESS = 2

# ตำแหน่งเส้นนับมือ
# 0.50 = กลางจอ, 0.40 = สูงขึ้น, 0.60 = ต่ำลง
COUNT_LINE_RATIO = 0.40

# landmark ข้อมือของ MediaPipe Pose
LEFT_WRIST = 15
RIGHT_WRIST = 16

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

    return points


def draw_count_line(frame, line_y):
    frame_height, frame_width = frame.shape[:2]

    cv2.line(
        frame,
        (0, line_y),
        (frame_width, line_y),
        (0, 255, 255),
        3
    )

    cv2.putText(
        frame,
        "Count Line",
        (10, line_y - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 255),
        2
    )


def check_hand_above_line(points, line_y):
    if len(points) <= RIGHT_WRIST:
        return False, None, None

    left_wrist = points[LEFT_WRIST]
    right_wrist = points[RIGHT_WRIST]

    left_above = left_wrist[1] < line_y
    right_above = right_wrist[1] < line_y

    hand_above = left_above or right_above

    return hand_above, left_wrist, right_wrist


def draw_wrist_status(frame, left_wrist, right_wrist, line_y):
    if left_wrist is not None:
        left_color = (0, 255, 0) if left_wrist[1] < line_y else (0, 0, 255)

        cv2.circle(
            frame,
            left_wrist,
            10,
            left_color,
            3
        )

        cv2.putText(
            frame,
            "L Wrist",
            (left_wrist[0] + 10, left_wrist[1] - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            left_color,
            2
        )

    if right_wrist is not None:
        right_color = (0, 255, 0) if right_wrist[1] < line_y else (0, 0, 255)

        cv2.circle(
            frame,
            right_wrist,
            10,
            right_color,
            3
        )

        cv2.putText(
            frame,
            "R Wrist",
            (right_wrist[0] + 10, right_wrist[1] - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            right_color,
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

    rep_count = 0
    hand_was_above_line = False

    with create_pose_landmarker() as pose_landmarker:
        while True:
            success, frame = cap.read()

            if not success or frame is None:
                break

            if VIDEO_SOURCE == 0:
                frame = cv2.flip(frame, 1)

            frame_height, frame_width = frame.shape[:2]
            count_line_y = int(frame_height * COUNT_LINE_RATIO)

            mp_image = create_mp_image(frame)

            timestamp_ms = int((frame_index / fps) * 1000)

            result = pose_landmarker.detect_for_video(
                mp_image,
                timestamp_ms
            )

            body_count = 0
            hand_is_above_line = False
            left_wrist = None
            right_wrist = None

            draw_count_line(frame, count_line_y)

            if result.pose_landmarks:
                body_count = len(result.pose_landmarks)

                for index, pose_landmarks in enumerate(result.pose_landmarks, start=1):
                    points = draw_pose(frame, pose_landmarks, index)

                    hand_is_above_line, left_wrist, right_wrist = check_hand_above_line(
                        points,
                        count_line_y
                    )

                    draw_wrist_status(
                        frame,
                        left_wrist,
                        right_wrist,
                        count_line_y
                    )

                    # นับ 1 ครั้ง ตอนที่มือข้ามขึ้นไปอยู่เหนือเส้น
                    if hand_is_above_line and not hand_was_above_line:
                        rep_count += 1
                        hand_was_above_line = True

                    # รีเซ็ตสถานะ เมื่อมือกลับลงมาต่ำกว่าเส้น
                    if not hand_is_above_line:
                        hand_was_above_line = False

            status_text = "HAND UP" if hand_is_above_line else "HAND DOWN"

            cv2.putText(
                frame,
                f"Bodies: {body_count}",
                (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 255),
                2
            )

            cv2.putText(
                frame,
                f"Status: {status_text}",
                (10, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 255, 0) if hand_is_above_line else (0, 0, 255),
                2
            )

            cv2.putText(
                frame,
                f"Reps: {rep_count}",
                (10, 115),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (255, 255, 255),
                3
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