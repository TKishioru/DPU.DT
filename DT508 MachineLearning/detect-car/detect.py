import cv2
import numpy as np


min_contour_width = 25
min_contour_height = 25
min_contour_area = 625

offset = 10
line_ratio = 0.90

# กำหนดความเร็ววิดีโอ
# 1.0 = ปกติ, 0.5 = ช้าลงครึ่งหนึ่ง, 0.25 = ช้ามาก
video_speed = 0.75

cars = 0
next_track_id = 0

tracks = {}
max_distance = 80
max_missing_frames = 10


def get_centroid(x, y, w, h):
    cx = x + int(w / 2)
    cy = y + int(h / 2)
    return cx, cy


def calculate_distance(point1, point2):
    return np.linalg.norm(np.array(point1) - np.array(point2))


cap = cv2.VideoCapture("videos/traffic.mp4")

if not cap.isOpened():
    print("ไม่สามารถเปิดวิดีโอได้")
    exit()


# คำนวณ delay ตาม FPS และความเร็ววิดีโอ
fps = cap.get(cv2.CAP_PROP_FPS)

if fps == 0:
    fps = 30

delay = int((1000 / fps) / video_speed)


ret, frame1 = cap.read()
ret, frame2 = cap.read()

if not ret or frame1 is None or frame2 is None:
    print("ไม่สามารถอ่านเฟรมจากวิดีโอได้")
    cap.release()
    exit()


while ret:
    frame_height, frame_width = frame1.shape[:2]
    line_height = int(frame_height * line_ratio)

    d = cv2.absdiff(frame1, frame2)
    grey = cv2.cvtColor(d, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(grey, (5, 5), 0)

    _, th = cv2.threshold(blur, 20, 255, cv2.THRESH_BINARY)

    dilated = cv2.dilate(
        th,
        np.ones((3, 3), np.uint8),
        iterations=2
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    closing = cv2.morphologyEx(
        dilated,
        cv2.MORPH_CLOSE,
        kernel
    )

    contours, _ = cv2.findContours(
        closing,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    detections = []

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)

        contour_valid = (
            w >= min_contour_width
            and h >= min_contour_height
            and area >= min_contour_area
        )

        if not contour_valid:
            continue

        centroid = get_centroid(x, y, w, h)

        detections.append({
            "bbox": (x, y, w, h),
            "centroid": centroid
        })

    for track_id in list(tracks.keys()):
        tracks[track_id]["missing"] += 1

    used_tracks = set()

    for detection in detections:
        current_centroid = detection["centroid"]

        best_track_id = None
        best_distance = float("inf")

        for track_id, track in tracks.items():
            if track_id in used_tracks:
                continue

            dist = calculate_distance(
                current_centroid,
                track["centroid"]
            )

            if dist < best_distance:
                best_distance = dist
                best_track_id = track_id

        if best_track_id is not None and best_distance < max_distance:
            old_centroid = tracks[best_track_id]["centroid"]

            tracks[best_track_id]["prev_centroid"] = old_centroid
            tracks[best_track_id]["centroid"] = current_centroid
            tracks[best_track_id]["bbox"] = detection["bbox"]
            tracks[best_track_id]["missing"] = 0

            used_tracks.add(best_track_id)

        else:
            tracks[next_track_id] = {
                "bbox": detection["bbox"],
                "centroid": current_centroid,
                "prev_centroid": current_centroid,
                "missing": 0,
                "counted": False
            }

            next_track_id += 1

    for track_id in list(tracks.keys()):
        if tracks[track_id]["missing"] > max_missing_frames:
            del tracks[track_id]

    cv2.line(
        frame1,
        (0, line_height),
        (frame_width, line_height),
        (0, 255, 255),
        2
    )

    cv2.putText(
        frame1,
        "Counting Line",
        (10, line_height - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (0, 255, 255),
        2
    )

    for track_id, track in tracks.items():
        x, y, w, h = track["bbox"]

        cx, cy = track["centroid"]
        prev_cx, prev_cy = track["prev_centroid"]

        crossed_line = (
            prev_cy < line_height <= cy
            or prev_cy > line_height >= cy
        )

        if crossed_line and not track["counted"]:
            cars += 1
            track["counted"] = True

        cv2.rectangle(
            frame1,
            (x - 10, y - 10),
            (x + w + 10, y + h + 10),
            (0, 255, 0),
            2
        )

        cv2.circle(
            frame1,
            (cx, cy),
            5,
            (0, 0, 255),
            -1
        )

        cv2.putText(
            frame1,
            f"Car {track_id}",
            (x, y - 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2
        )

    cv2.putText(
        frame1,
        "Total Cars Detected: " + str(cars),
        (10, 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 170, 0),
        2
    )

    cv2.imshow("Vehicle Detection", frame1)

    key = cv2.waitKey(delay) & 0xFF

    if key == 27 or key == ord("q"):
        break

    frame1 = frame2
    ret, frame2 = cap.read()


cv2.destroyAllWindows()
cap.release()