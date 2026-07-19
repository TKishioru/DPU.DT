# database.py
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo
import os

DB_PATH = "database/attendance.db"
TZ = ZoneInfo("Asia/Bangkok")


def now_bangkok():
    """เวลาปัจจุบันโซนไทย (UTC+7) เป็นสตริงสำหรับบันทึกใน DB"""
    return datetime.now(TZ).strftime("%Y-%m-%d %H:%M:%S")


def today_bangkok():
    """วันที่ปัจจุบันโซนไทย"""
    return datetime.now(TZ).strftime("%Y-%m-%d")

def init_db():
    """สร้างฐานข้อมูลและตาราง"""
    # สร้างโฟลเดอร์ database ถ้ายังไม่มี
    os.makedirs("database", exist_ok=True)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # ตาราง students (นักเรียน)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            image_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ตาราง attendance (บันทึกเข้า-ออก)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students (id)
        )
    """)
    
    conn.commit()
    conn.close()
    print("Database initialized successfully!")


def add_student(name, image_path):
    """เพิ่มนักเรียนใหม่"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO students (name, image_path, created_at) VALUES (?, ?, ?)",
            (name, image_path, now_bangkok())
        )
        
        conn.commit()
        student_id = cursor.lastrowid
        conn.close()
        
        return {"success": True, "student_id": student_id, "message": f"เพิ่ม {name} สำเร็จ"}
    
    except sqlite3.IntegrityError:
        return {"success": False, "message": f"ชื่อ {name} มีในระบบแล้ว"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def get_all_students():
    """ดึงรายชื่อนักเรียนทั้งหมด"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, image_path, created_at FROM students ORDER BY name")
    students = cursor.fetchall()
    
    conn.close()
    
    return [
        {
            "id": s[0],
            "name": s[1],
            "image_path": (s[2] or "").replace("\\", "/"),
            "created_at": s[3]
        }
        for s in students
    ]


def record_attendance(student_id, action):
    """บันทึกการเข้า-ออก"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # ดึงชื่อนักเรียน
        cursor.execute("SELECT name FROM students WHERE id = ?", (student_id,))
        result = cursor.fetchone()
        
        if not result:
            return {"success": False, "message": "ไม่พบนักเรียน"}
        
        student_name = result[0]
        
        # บันทึกการเข้า-ออก (ใช้เวลาไทย ไม่ใช่ UTC ของ SQLite)
        cursor.execute(
            "INSERT INTO attendance (student_id, action, timestamp) VALUES (?, ?, ?)",
            (student_id, action, now_bangkok())
        )
        
        conn.commit()
        conn.close()
        
        action_text = "เข้า" if action == "IN" else "ออก"
        return {
            "success": True,
            "message": f"{student_name} {action_text}ห้องเรียนเรียบร้อย",
            "student_name": student_name,
            "action": action
        }
    
    except Exception as e:
        return {"success": False, "message": str(e)}


def get_attendance_history(limit=50):
    """ดึงประวัติการเข้า-ออก"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            a.id,
            s.name,
            a.action,
            a.timestamp
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        ORDER BY a.timestamp DESC
        LIMIT ?
    """, (limit,))
    
    records = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": r[0],
            "name": r[1],
            "action": r[2],
            "timestamp": r[3]
        }
        for r in records
    ]


def get_today_attendance():
    """ดึงรายชื่อที่เข้าวันนี้"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT DISTINCT
            s.id,
            s.name,
            MAX(a.timestamp) as last_seen
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE DATE(a.timestamp) = ?
        AND a.action = 'IN'
        GROUP BY s.id, s.name
        ORDER BY last_seen DESC
    """, (today_bangkok(),))
    
    records = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": r[0],
            "name": r[1],
            "last_seen": r[2]
        }
        for r in records
    ]


# สร้างฐานข้อมูลตอน import
if __name__ == "__main__":
    init_db()
