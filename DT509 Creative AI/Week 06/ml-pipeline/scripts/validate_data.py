"""ตรวจไฟล์ข้อมูล penguins ก่อนเทรน

วิธีใช้: python scripts/validate_data.py <ไฟล์.csv>
exit 0 + "OK"   = ผ่าน
exit 1 + "FAIL" = ไม่ผ่าน ต้องหยุดและรายงานผู้ใช้
"""
import sys

import pandas as pd

REQUIRED = ["bill_length_mm", "bill_depth_mm",
            "flipper_length_mm", "body_mass_g", "species"]

if len(sys.argv) != 2:
    print("FAIL: ต้องระบุไฟล์ CSV 1 ไฟล์ เช่น python validate_data.py penguins.csv")
    sys.exit(1)

try:
    df = pd.read_csv(sys.argv[1])
except Exception as e:  # ไฟล์ไม่มี หรืออ่านไม่ได้
    print("FAIL: อ่านไฟล์ไม่ได้:", e)
    sys.exit(1)

missing_cols = [c for c in REQUIRED if c not in df.columns]
if missing_cols:
    print("FAIL: ไม่มีคอลัมน์", missing_cols)
    sys.exit(1)

print("rows:", len(df))
print("missing per column:")
print(df[REQUIRED].isna().sum().to_string())
print("species:", df["species"].value_counts().to_dict())
print("OK")
