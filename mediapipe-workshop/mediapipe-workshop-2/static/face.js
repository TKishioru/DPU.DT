import { FilesetResolver, FaceLandmarker, DrawingUtils } from
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.getElementById("video");

const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");

const loadingOverlay = document.getElementById("loadingOverlay");

const loadingText = document.getElementById("loadingText");

const faceCountEl = document.getElementById("faceCount");

const landmarkCountEl = document.getElementById("landmarkCount");

const statusEl = document.getElementById("statusText");

const layers = { mesh: true, eyes: true, lips: true, oval: true,
label: false };

let faceLandmarker = null;

let drawingUtils = null;

window.toggleLayer = (name) => {

layers[name] = !layers[name];

const btn = document.querySelector(`[data-layer="${name}"]`);

if (btn) {

btn.classList.toggle("active", layers[name]);

}

};
function setStatus(message) {

statusEl.textContent = message;

}

function setupCanvasSize() {

const videoWidth = video.videoWidth || 640;

const videoHeight = video.videoHeight || 480;

if (canvas.width !== videoWidth || canvas.height !== videoHeight)
{

canvas.width = videoWidth;

canvas.height = videoHeight;

}

}

function drawVideoFrame() {

if (video.readyState < 2) return;

setupCanvasSize();

ctx.save();

ctx.clearRect(0, 0, canvas.width, canvas.height);

ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

ctx.restore();

}
function drawFaceLandmarks(faceLandmarks) {

if (!drawingUtils || !Array.isArray(faceLandmarks)) return;

drawVideoFrame();

for (const landmarks of faceLandmarks) {

if (layers.mesh) {

drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {

color: "#C0C0C040",

lineWidth: 0.5

});

}

if (layers.eyes) {

drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {

color: "#FF3030",

lineWidth: 2

});

drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {

color: "#FF6060",

lineWidth: 1.5

});

drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {

color: "#30FF30",

lineWidth: 2

});

drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {

color: "#60FF60",

lineWidth: 1.5

});

}
if (layers.lips) {

drawingUtils.drawConnectors(landmarks,
FaceLandmarker.FACE_LANDMARKS_LIPS, {

color: "#E0E0E0",

lineWidth: 2

});

}

if (layers.oval) {

drawingUtils.drawConnectors(landmarks,
FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {

color: "#f9a8d4",

lineWidth: 2

});

}

if (layers.label) {

drawLandmarkWithLabel(landmarks, 33, "Right Eye", "#FF6060");

drawLandmarkWithLabel(landmarks, 263, "Left Eye", "#60FF60");

drawLandmarkWithLabel(landmarks, 1, "Nose", "#FFD700");

drawLandmarkWithLabel(landmarks, 13, "Mouth", "#f9a8d4");

}

}

}
async function init() {

loadingText.textContent = "กำลังโหลดโมเดล Face Landmarker...";

setStatus("กำลังเตรียมโมเดล...");

const vision = await FilesetResolver.forVisionTasks(

"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"

);

faceLandmarker = await FaceLandmarker.createFromOptions(vision, {

baseOptions: {

modelAssetPath: "/static/face_landmarker.task",

delegate: "GPU"

},

runningMode: "VIDEO",

numFaces: 3,

minFaceDetectionConfidence: 0.5,

minFacePresenceConfidence: 0.5,

minTrackingConfidence: 0.5

});

drawingUtils = new DrawingUtils(ctx);

await startCamera();

}
async function startCamera() {

const stream = await navigator.mediaDevices.getUserMedia({

video: {

width: { ideal: 1280 },

height: { ideal: 720 },

facingMode: "user"

},

audio: false

});

video.srcObject = stream;

video.setAttribute("playsinline", "true");

video.muted = true;

video.addEventListener("loadedmetadata", () => {

setupCanvasSize();

drawVideoFrame();

});

video.addEventListener("playing", () => {

setupCanvasSize();

drawVideoFrame();

});

try {

await video.play();

} catch (error) {

console.warn("video.play() failed", error);

}

loadingOverlay.style.display = "none";

setStatus("กำลังทำงาน");

setupCanvasSize();

drawVideoFrame();

detectLoop();

}
function detectLoop() {

let lastVideoTime = -1;

function render() {

if (video.readyState >= 2 && faceLandmarker) {

const nowInMs = Date.now();

if (video.currentTime !== lastVideoTime) {

lastVideoTime = video.currentTime;

const result = faceLandmarker.detectForVideo(video, nowInMs);

const faceCount = result.faceLandmarks?.length || 0;

faceCountEl.textContent = faceCount;

landmarkCountEl.textContent = faceCount > 0 ? `${result.faceLandmarks[0].length} pts` : "—";

setStatus(faceCount > 0 ? "ตรวจพบใบหน้า" : "กำลังค้นหาใบหน้า...");

drawFaceLandmarks(result.faceLandmarks || []);

}

}

requestAnimationFrame(render);

}

render();

}
function drawLandmarkWithLabel(landmarks, index, labelText, color) {

const lm = landmarks[index];

if (!lm) return;

const x = lm.x * canvas.width;

const y = lm.y * canvas.height;

ctx.beginPath();

ctx.arc(x, y, 4, 0, Math.PI * 2);

ctx.fillStyle = color;

ctx.fill();

ctx.beginPath();

ctx.moveTo(x, y);

ctx.lineTo(x + 20, y - 35);

ctx.strokeStyle = color;

ctx.lineWidth = 1.5;

ctx.stroke();

ctx.font = "bold 14px Segoe UI";

ctx.fillStyle = color;

ctx.fillText(labelText, x + 22, y - 38);

}
init().catch((err) => {

loadingText.textContent = `Error: ${err.message}`;

setStatus("เกิดข้อผิดพลาด");

console.error(err);

});