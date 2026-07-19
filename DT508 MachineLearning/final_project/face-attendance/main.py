from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import uuid
from PIL import Image

import database as db
import face_utils as face_module


app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ถ้า confidence ต่ำกว่านี้ ให้ถือว่าไม่พบใครในฐานข้อมูล
FACE_CONFIDENCE_THRESHOLD = 90.0


db.init_db()
face_module.init_faces_dir()


def parse_confidence(value):
    """
    แปลงค่า confidence ให้เป็นตัวเลขแบบเปอร์เซ็นต์ 0-100

    รองรับกรณี:
    - 95
    - 95.5
    - "95.5"
    - "95.5%"
    - 0.95  -> แปลงเป็น 95
    """
    try:
        if value is None:
            return 0.0

        if isinstance(value, str):
            value = value.replace("%", "").strip()

        confidence = float(value)

        # ถ้าค่าเป็น 0-1 เช่น 0.95 ให้แปลงเป็น 95
        if 0 <= confidence <= 1:
            confidence *= 100

        return confidence

    except (ValueError, TypeError):
        return 0.0


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/faces/<path:filename>')
def serve_face(filename):
    """เสิร์ฟรูปใบหน้าจากโฟลเดอร์ faces/"""
    return send_from_directory(face_module.FACES_DIR, filename)


@app.route('/api/students', methods=['GET'])
def get_students():
    students = db.get_all_students()
    return jsonify({
        "success": True,
        "students": students
    })


@app.route('/api/students/add', methods=['POST'])
def add_student():
    try:
        name = request.form.get('name', '').strip()
        image_file = request.files.get('image')

        if not name:
            return jsonify({
                "success": False,
                "message": "กรุณาระบุชื่อ"
            })

        if not image_file:
            return jsonify({
                "success": False,
                "message": "กรุณาอัปโหลดรูปถ่าย"
            })

        image = Image.open(image_file)
        save_result = face_module.save_face_image(image, name)

        if not save_result["success"]:
            return jsonify(save_result)

        try:
            face_found = face_module.detect_face(save_result["filepath"])

        except Exception as detect_err:
            os.remove(save_result["filepath"])

            return jsonify({
                "success": False,
                "message": f"ตรวจสอบใบหน้าไม่สำเร็จ: {str(detect_err)}"
            })

        if not face_found:
            os.remove(save_result["filepath"])

            return jsonify({
                "success": False,
                "message": "ไม่พบใบหน้าในภาพ กรุณาถ่ายใหม่"
            })

        # เก็บ path แบบ relative + forward slash สำหรับ URL เช่น /faces/xxx.jpg
        abs_path = save_result["filepath"]
        rel_path = os.path.relpath(abs_path, BASE_DIR)
        image_path = rel_path.replace("\\", "/")

        result = db.add_student(name, image_path)

        if result.get("success"):
            # สร้าง embedding ตอนเพิ่มนักเรียน
            # สแกนครั้งถัดไปจะเร็วขึ้น
            try:
                face_module.refresh_embeddings()

            except Exception as emb_err:
                print(f"--- DEBUG: refresh_embeddings failed: {emb_err}")

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        })


@app.route('/api/recognize', methods=['POST'])
def recognize():
    temp_path = None

    try:
        action = request.form.get('action', 'IN')
        image_file = request.files.get('image')

        if not image_file:
            return jsonify({
                "success": False,
                "message": "กรุณาถ่ายรูป"
            })

        # ไฟล์ชั่วคราวไม่ซ้ำกัน กัน request ซ้อนทับกัน
        temp_path = os.path.join(
            BASE_DIR,
            f"temp_scan_{uuid.uuid4().hex}.jpg"
        )

        image = Image.open(image_file)
        image.convert("RGB").save(
            temp_path,
            format="JPEG",
            quality=95
        )

        result = face_module.recognize_face(temp_path)

        if not result["success"]:
            return jsonify(result)

        # แปลงค่า confidence เป็นเปอร์เซ็นต์
        confidence = parse_confidence(result.get("confidence", 0))

        # ถ้าความมั่นใจต่ำกว่า 90% ให้ถือว่าไม่มีใครในฐานข้อมูล
        if confidence < FACE_CONFIDENCE_THRESHOLD:
            return jsonify({
                "success": False,
                "message": "ไม่พบใครในฐานข้อมูล",
                "confidence": confidence
            })

        # จับคู่ hex จากชื่อไฟล์กับนักเรียนใน DB
        hex_name = result.get("hex_name", "")
        students = db.get_all_students()

        student_id = None

        for s in students:
            basename = os.path.splitext(
                os.path.basename(s["image_path"])
            )[0]

            if (
                basename == hex_name
                or face_module.sanitize_filename(s["name"]) == hex_name
            ):
                student_id = s["id"]
                break

        if not student_id:
            return jsonify({
                "success": False,
                "message": "ไม่พบข้อมูลนักเรียน",
                "confidence": confidence
            })

        attendance_result = db.record_attendance(student_id, action)
        attendance_result["confidence"] = confidence

        return jsonify(attendance_result)

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        })

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)

            except OSError:
                pass


@app.route('/api/attendance/history', methods=['GET'])
def get_history():
    limit = request.args.get('limit', 50, type=int)
    records = db.get_attendance_history(limit)

    return jsonify({
        "success": True,
        "records": records
    })


@app.route('/api/attendance/today', methods=['GET'])
def get_today():
    records = db.get_today_attendance()

    return jsonify({
        "success": True,
        "records": records
    })


if __name__ == '__main__':
    app.run(
        debug=True,
        host='0.0.0.0',
        port=8000
    )