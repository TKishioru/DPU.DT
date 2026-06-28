from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


VIDEO_SOURCE = 0
# VIDEO_SOURCE = "videos/WIN_20220925_13_54_04_Pro.mp4"

MODEL_PATH = Path("face_landmarker.task")

WINDOW_NAME = "MediaPipe Face Landmark Detection"

LANDMARK_COLOR = (0, 165, 255)  # BGR
LANDMARK_RADIUS = 1
LINE_COLOR = (0, 255, 0)
LINE_THICKNESS = 1

MAX_NUM_FACES = 1
VIDEO_SPEED = 1.0


# จุดเชื่อมหลัก ๆ ของใบหน้า
# ใช้ชุด connection จาก MediaPipe Tasks/FaceLandmarksConnections
FACE_CONNECTIONS = [
    # กรอบใบหน้า
    (10, 338), (338, 297), (297, 332), (332, 284), (284, 251),
    (251, 389), (389, 356), (356, 454), (454, 323), (323, 361),
    (361, 288), (288, 397), (397, 365), (365, 379), (379, 378),
    (378, 400), (400, 377), (377, 152), (152, 148), (148, 176),
    (176, 149), (149, 150), (150, 136), (136, 172), (172, 58),
    (58, 132), (132, 93), (93, 234), (234, 127), (127, 162),
    (162, 21), (21, 54), (54, 103), (103, 67), (67, 109),
    (109, 10),

    # ตาซ้าย
    (33, 7), (7, 163), (163, 144), (144, 145), (145, 153),
    (153, 154), (154, 155), (155, 133), (33, 246), (246, 161),
    (161, 160), (160, 159), (159, 158), (158, 157), (157, 173),
    (173, 133),

    # ตาขวา
    (263, 249), (249, 390), (390, 373), (373, 374), (374, 380),
    (380, 381), (381, 382), (382, 362), (263, 466), (466, 388),
    (388, 387), (387, 386), (386, 385), (385, 384), (384, 398),
    (398, 362),

    # คิ้วซ้าย
    (70, 63), (63, 105), (105, 66), (66, 107),

    # คิ้วขวา
    (336, 296), (296, 334), (334, 293), (293, 300),

    # จมูก
    (168, 6), (6, 197), (197, 195), (195, 5), (5, 4),
    (4, 45), (4, 275),

    # ปาก
    (61, 146), (146, 91), (91, 181), (181, 84), (84, 17),
    (17, 314), (314, 405), (405, 321), (321, 375), (375, 291),
    (61, 185), (185, 40), (40, 39), (39, 37), (37, 0),
    (0, 267), (267, 269), (269, 270), (270, 409), (409, 291),
]


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


def draw_landmarks(frame, face_landmarks):
    frame_height, frame_width = frame.shape[:2]

    points = []

    for landmark in face_landmarks:
        point = normalized_to_pixel(
            landmark,
            frame_width,
            frame_height
        )
        points.append(point)

    # วาดเส้นเชื่อม landmark
    for start_idx, end_idx in FACE_CONNECTIONS:
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


def draw_face_box(frame, face_landmarks, face_id):
    frame_height, frame_width = frame.shape[:2]

    x_min, y_min, x_max, y_max = get_face_box(
        face_landmarks,
        frame_width,
        frame_height
    )

    cv2.rectangle(
        frame,
        (x_min, y_min),
        (x_max, y_max),
        (255, 0, 0),
        2
    )

    cv2.putText(
        frame,
        f"Face {face_id}",
        (x_min, y_min - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 0, 0),
        2
    )


def main():
    if not MODEL_PATH.exists():
        print(f"ไม่พบไฟล์โมเดล: {MODEL_PATH}")
        print("กรุณาดาวน์โหลด face_landmarker.task มาไว้ในโฟลเดอร์เดียวกับไฟล์ Python")
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

    base_options = python.BaseOptions(
        model_asset_path=str(MODEL_PATH)
    )

    options = vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=MAX_NUM_FACES,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    frame_index = 0

    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        while True:
            ret, frame = cap.read()

            if not ret or frame is None:
                break

            if VIDEO_SOURCE == 0:
                frame = cv2.flip(frame, 1)

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

            face_count = 0

            if result.face_landmarks:
                face_count = len(result.face_landmarks)

                for index, face_landmarks in enumerate(result.face_landmarks, start=1):
                    draw_face_box(frame, face_landmarks, index)
                    draw_landmarks(frame, face_landmarks)

            cv2.putText(
                frame,
                f"Faces: {face_count}",
                (10, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (0, 0, 255),
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