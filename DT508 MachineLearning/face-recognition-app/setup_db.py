import sqlite3

def create_database ():
    # เชื่อมต่อหรือสร้างไฟล์ฐานข้อมูลใหม่โดยอัตโนมัติ
    conn = sqlite3.connect("face_recognition.db" )
    cursor = conn.cursor()

    # สร้างตาราง persons (ถ้ายังไม่มีในระบบ)
    cursor.execute( """
        CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        surname TEXT,
        gender TEXT,
        image TEXT -- ชื่อไฟล์รูปภาพ เช่น "pop.png"
        )
    """ )

    # เพิ่มข้อมูลตัวอย่าง (ชื่อ, นามสกุล, เพศ, ชื่อไฟล์รูป)
    sample_data = [
        ("oak" , "Error" , "Male" , "oak.png" ),
        ("pop" , "pongkul" , "Male" , "pop.png" ),
        ("pek" , "zeal" , "Male" , "pek.jpg" ),
    ]
    # INSERT OR IGNORE = ไม่เพิ่มซ้ำถ้าข้อมูลเดิมมีอยู่แล้ว
    cursor.executemany( """
        INSERT OR IGNORE INTO persons (name, surname, gender, image)
        VALUES (?, ?, ?, ?)
        """ , sample_data)
    conn.commit() # บันทึกการเปลี่ยนแปลงลงในไฟล์
    conn.close() # ปิดการเชื่อมต่อ
    print( "สร้างฐานข้อมูลและเพิ่มข้อมูลสำเร็จ" )

if __name__ == "__main__":
    create_database()