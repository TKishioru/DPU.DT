import time

import cv2
import mediapipe as mp


BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

latest_pose = None


def process_pose(result, output_image, timestamp_ms):
    global latest_pose
    latest_pose = result


options = PoseLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path="pose_landmarker_lite.task"
    ),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_poses=1,
    min_pose_detection_confidence=0.5,
    min_tracking_confidence=0.5,
    result_callback=process_pose
)


with PoseLandmarker.create_from_options(options) as landmarker:
    cap = cv2.VideoCapture(0)

    while cap.isOpened():
        ret, frame = cap.read()

        if not ret:
            break

        h, w, _ = frame.shape

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb_frame
        )

        landmarker.detect_async(
            mp_image,
            int(time.time() * 1000)
        )

        if latest_pose and latest_pose.pose_landmarks:
            for pose in latest_pose.pose_landmarks:
                for idx, lm in enumerate(pose):
                    cx = int(lm.x * w)
                    cy = int(lm.y * h)

                    cv2.circle(
                        frame,
                        (cx, cy),
                        5,
                        (0, 255, 255),
                        cv2.FILLED
                    )

        cv2.imshow(
            "Pose Landmarker",
            cv2.flip(frame, 1)
        )

        if cv2.waitKey(1) == 27:  # ESC
            break

    cap.release()
    cv2.destroyAllWindows()