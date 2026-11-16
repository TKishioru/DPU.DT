# ไฟล์สำหรับชุดทดสอบข้อ 7 "รีวิว train.py ที่แนบมา"
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

df = pd.read_csv("penguins.csv")
features = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
df[features] = df[features].fillna(df[features].mean())

X = StandardScaler().fit_transform(df[features])
y = df["species"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

model = LogisticRegression()
model.fit(X_train, y_train)
print("accuracy:", model.score(X_test, y_test))
