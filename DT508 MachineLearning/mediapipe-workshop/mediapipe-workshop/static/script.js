import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
// ─── Elements ────────────────────────────────────────────
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const badgeContainer = document.getElementById("badgeContainer");
const handCountEl = document.getElementById("handCount");
const leftGestureEl = document.getElementById("leftGesture");
const rightGestureEl = document.getElementById("rightGesture");
const debugLogEl = document.getElementById("debugLog");
const retryButton = document.getElementById("retryButton");
const overlay = document.getElementById("loadingOverlay");
// ─── Init Model ──────────────────────────────────────────
let loadingComplete = false;
function showLoadingScreen(message = "ก าลังเตรียมระบบ...") {
  if (!overlay) return;
  overlay.classList.add("is-visible");
  overlay.style.display = "flex";
  loadingText.textContent = message;
}
function hideLoadingScreen() {
  if (loadingComplete) return;
  loadingComplete = true;
  if (overlay) {
    overlay.classList.remove("is-visible");
    overlay.style.display = "none";
  }
}
async function init() {
  loadingComplete = false;
  hideLoadingScreen();
  loadingText.textContent = "ก าลังเตรียมระบบ...";
  try {
    const cameraPromise = startCamera();
    const modelPromise = loadHandLandmarker();
    const [cameraResult, modelResult] = await Promise.allSettled([
      cameraPromise,
      modelPromise,
    ]);
    if (cameraResult.status === "rejected") {
      return;
    }
    hideLoadingScreen();
    if (modelResult.status === "fulfilled" && modelResult.value) {
      loadingText.textContent = "ก าลังตรวจจับมือ...";
      detectLoop(modelResult.value);
      loadingText.textContent = "พร้อมใช้งาน";
      debugLog("โหลดโมเดลส าเร็จแล้วระบบเริ่มตรวจจับ");
    } else {
      const message = modelResult.reason?.message || "ไม่สามารถโหลดโมเดลได้";
      loadingText.textContent = "ก าลังรอโมเดลตรวจจับ...";
      retryButton.style.display = "inline-flex";
      debugLog(`โหลดโมเดลไม่ส าเร็จ: ${message}`);
    }
  } catch (err) {
    console.error(err);
    showLoadingScreen(`เกิดข้อผิดพลาด: ${err.message}`);
    retryButton.style.display = "inline-flex";
    debugLog(`ข้อผิดพลาดเริ่มระบบ: ${err.message}`);
  }
}
async function loadHandLandmarker() {
  loadingText.textContent = "ก าลังโหลด WASM...";
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );
  loadingText.textContent = "ก าลังโหลดโมเดลตรวจจับมือ...";
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/model/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  } catch (err) {
    console.warn("GPU delegate failed, retrying with CPU", err);
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/model/hand_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  }
}
async function startCamera() {
  try {
    retryButton.style.display = "none";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    debugLog("อนุญาตกล้องแล้วก าลังแสดงภาพสด...");
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      debugLog(`ขนาดวิดีโอ ${video.videoWidth}x${video.videoHeight}`);
    }
    hideLoadingScreen();
    return stream;
  } catch (err) {
    console.error(err);
    showLoadingScreen();
    if (err.name === "NotAllowedError") {
      loadingText.textContent =
        "กรุณาอนุญาตกล้องในเบราว์เซอร์แล้วกดปุ่มด้านล่าง";
      retryButton.style.display = "inline-flex";
      debugLog("ปฏิเสธการเข้าถึงกล้อง");
    } else {
      loadingText.textContent = `ไม่สามารถเปิดกล้องได้: ${err.message}`;
      retryButton.style.display = "inline-flex";
      debugLog(`เกิดข้อผิดพลาดกล้อง: ${err.message}`);
    }
    throw err;
  }
}
// ─── Detection Loop ──────────────────────────────────────
let lastVideoTime = -1;
let lastDetectionResult = null;
function drawBaseFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}
function drawOverlay(result, drawingUtils) {
  badgeContainer.innerHTML = "";
  let leftGesture = "—";
  let rightGesture = "—";
  if (!result || !result.landmarks || result.landmarks.length === 0) {
    handCountEl.textContent = "0";
    leftGestureEl.textContent = "—";
    rightGestureEl.textContent = "—";
    return;
  }
  for (let i = 0; i < result.landmarks.length; i++) {
    const landmarks = result.landmarks[i];
    const handedness = result.handedness[i][0].displayName;
    const gesture = detectGesture(landmarks);
    drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: "#00FF88",
      lineWidth: 2,
    });
    drawingUtils.drawLandmarks(landmarks, {
      color: "#FF4081",
      lineWidth: 1,
      radius: 4,
    });
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = `${handedness === "Left" ? "ซ้าย" : "ขวา"}: ${gesture}`;
    badgeContainer.appendChild(badge);
    if (handedness === "Left") leftGesture = gesture;
    if (handedness === "Right") rightGesture = gesture;
  }
  handCountEl.textContent = result.landmarks.length;
  leftGestureEl.textContent = leftGesture;
  rightGestureEl.textContent = rightGesture;
}
function detectLoop(handLandmarker) {
  const drawingUtils = new DrawingUtils(ctx);
  function render() {
    drawBaseFrame();
    if (video.readyState >= 2) {
      const result = handLandmarker.detectForVideo(video, Date.now());
      if (result) {
        lastDetectionResult = result;
        debugLog(
          `ผลตรวจจับ: ${result.landmarks ? result.landmarks.length : 0} มือ`,
        );
        if (result.landmarks && result.landmarks.length > 0) {
          debugLog(`ตรวจพบมือ: ${result.landmarks.length}`);
        } else {
          debugLog("ยังไม่พบมือ");
        }
      }
    }
    if (lastDetectionResult && lastDetectionResult.landmarks) {
      drawOverlay(lastDetectionResult, drawingUtils);
    }
    requestAnimationFrame(render);
  }
  render();
}
function debugLog(message) {
  if (!debugLogEl) return;
  const timestamp = new Date().toLocaleTimeString();
  debugLogEl.textContent = `${timestamp}: ${message}`;
}
// ─── Gesture Detection ───────────────────────────────────
function detectGesture(lm) {
  // Paper: นิ้วทั้งหมดเหยียด
  const allExtended = [8, 12, 16, 20].every((tip) => lm[tip].y < lm[tip - 2].y);
  if (allExtended) return "กระดาษ";
  // Scissors: นิ้วชี้ + นิ้วกลางเหยียด
  const scissors =
    lm[8].y < lm[6].y && // นิ้วชี้เหยียด
    lm[12].y < lm[10].y && // นิ้วกลางเหยียด
    lm[16].y > lm[14].y && // นิ้วนางงอ
    lm[20].y > lm[18].y; // นิ้วก้อยงอ
  if (scissors) return "กรรไกร";
  // Rock: ค่าเริ่มต้น
  return "ค้อน";
}
// ─── Start ───────────────────────────────────────────────
init().catch((err) => {
  loadingText.textContent = ` Error: ${err.message}`;
  console.error(err);
});