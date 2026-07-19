from flask import Flask, render_template, send_from_directory
app = Flask(__name__)
@app.route("/")
def index():
    return render_template("index.html")
@app.route("/model/hand_landmarker.task")
def serve_hand_model():
    return send_from_directory(app.root_path, "hand_landmarker.task")
if __name__ == "__main__":
    app.run(debug=True)