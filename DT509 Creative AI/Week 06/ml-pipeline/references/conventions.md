# ข้อตกลงโปรเจกต์ penguin-pipeline

## โครงสร้าง
- clean.py    -> ฟังก์ชัน clean(df) -> DataFrame
- train.py    -> ฟังก์ชัน train(X, y) -> model
- evaluate.py -> ฟังก์ชัน evaluate(model, X, y) -> dict (accuracy, confusion_matrix)

## สไตล์
- Python 3.11, type hint ทุกฟังก์ชัน, snake_case
- ไม่ใช้ print ในโค้ดหลัก ใช้ logging
- ทุกไฟล์มี `if __name__ == "__main__":` ไว้รันทดสอบได้

## ข้อมูล
- คอลัมน์ที่ใช้เป็น feature: bill_length_mm, bill_depth_mm, flipper_length_mm, body_mass_g
- คอลัมน์เป้าหมาย: species (Adelie, Chinstrap, Gentoo)
- ไม่ใช้คอลัมน์ island, sex, year
- ค่าว่าง: เติมด้วยค่ามัธยฐานของชุด train เท่านั้น
- แถวที่ species ว่าง: ตัดทิ้ง

## โมเดล
- เริ่มที่ LogisticRegression(max_iter=1000) ใน Pipeline ที่มี StandardScaler
- ถ้าผู้ใช้ขอปรับโมเดล ให้ลอง RandomForestClassifier(random_state=42) เทียบ และรายงานทั้งสองตัว
