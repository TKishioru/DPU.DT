import time

import cv2
import mediapipe as mp


BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

latest_result = None


def process_result(result, output_image, timestamp_ms):
    global latest_result
    latest_result = result


options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path="hand_landmarker.task"
    ),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    result_callback=process_result
)


with HandLandmarker.create_from_options(options) as landmarker:
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

        if latest_result and latest_result.hand_landmarks:
            for hand in latest_result.hand_landmarks:
                for idx, lm in enumerate(hand):
                    cx = int(lm.x * w)
                    cy = int(lm.y * h)

                    # ปลายนิ้ว: 4, 8, 12, 16, 20
                    if idx in [4, 8, 12, 16, 20]:
                        color = (0, 255, 0)
                        size = 12
                    else:
                        color = (255, 255, 255)
                        size = 5

                    cv2.circle(
                        frame,
                        (cx, cy),
                        size,
                        color,
                        cv2.FILLED
                    )

        cv2.imshow(
            "Hand Landmarker",
            cv2.flip(frame, 1)
        )

        if cv2.waitKey(1) == 27:  # ESC
            break

    cap.release()
    cv2.destroyAllWindows()