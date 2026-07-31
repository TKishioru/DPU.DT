/* =========================================================
   POSE ML — UPPER BODY VERSION

   รับผิดชอบ:
   - โหลด MediaPipe Pose Landmarker
   - เปิดและปิดกล้อง
   - ตรวจจับช่วงบนของร่างกาย
   - ใช้จมูกและไหล่ทั้งสองข้าง
   - Calibration ระดับไหล่
   - จำแนก Stand / Jump / Crouch
   - ส่งคำสั่งไปยัง canvas-game.js
========================================================= */

import {
  FilesetResolver,
  PoseLandmarker,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

import {
  initializeCanvasGame,
  enableStartGame,
  applyPoseToGame,
  pauseGameBecausePoseLost,
  getGameState,
  startGame,
  GAME_STATE,
} from "./canvas-game.js";

/* =========================================================
   SETTINGS
========================================================= */

/*
  ต้องยืนท่า Stand ต่อเนื่องกี่วินาที
*/
const STAND_READY_DURATION = 5000;

/*
  จำนวนวินาทีในการนับถอยหลังก่อนเริ่มเกม
*/
const AUTO_COUNTDOWN_SECONDS = 5;

/*
  หากหลุดจากท่า Stand เกินเวลานี้
  จะรีเซ็ตการยืนเตรียมพร้อม
*/
const STAND_LOST_TOLERANCE = 350;

/* =========================================================
   AUTO START STATE
========================================================= */

const autoStartState = {
  /*
    เริ่มจับเวลายืนเมื่อใด
  */
  standStartedAt: null,

  /*
    เวลาล่าสุดที่ตรวจพบท่า Stand
  */
  lastStandDetectedAt: null,

  /*
    ป้องกันเริ่มนับถอยหลังซ้ำ
  */
  isCountingDown: false,

  /*
    ป้องกันสั่งเริ่มเกมซ้ำ
  */
  hasStartedGame: false,

  /*
    ID ของ setInterval
  */
  countdownIntervalId: null,

  /*
    เวลาที่เหลือในการนับถอยหลัง
  */
  countdownRemaining: AUTO_COUNTDOWN_SECONDS,
};

/*
  true  = ทดสอบเกมด้วยคีย์บอร์ดโดยไม่เปิดกล้อง
  false = ใช้ MediaPipe ตรวจจับท่าทางตามปกติ
*/
const KEYBOARD_TEST_MODE = false;

const MEDIAPIPE_VERSION = "0.10.14";

/*
  จำนวนเฟรมที่ใช้ Calibration
*/
const CALIBRATION_SAMPLE_TARGET = 60;

/*
  ถ้าไม่พบร่างกายเกินเวลานี้ จะหยุดเกมชั่วคราว
*/
const BODY_LOST_TIMEOUT = 1500;

/*
  Visibility ขั้นต่ำของ Landmark
*/
const MIN_LANDMARK_VISIBILITY = 0.35;

/*
  จำนวนเฟรมที่ใช้หาค่าเฉลี่ย เพื่อลดการสั่น
*/
const SMOOTHING_FRAME_LIMIT = 5;

/* =========================================================
   DOM ELEMENTS
========================================================= */

const videoElement = document.getElementById("inputVideo");

const poseCanvas = document.getElementById("poseCanvas");

const poseCtx = poseCanvas.getContext("2d");

const cameraStatus = document.getElementById("cameraStatus");

const gameStatusBadge = document.getElementById("gameStatusBadge");

const poseDetectionStatus = document.getElementById("poseDetectionStatus");

const calibrationStatus = document.getElementById("calibrationStatus");

const cameraPlaceholder = document.getElementById("cameraPlaceholder");

const startCameraButton = document.getElementById("startCameraButton");

const stopCameraButton = document.getElementById("stopCameraButton");

const calibrateButton = document.getElementById("calibrateButton");

const resetCalibrationButton = document.getElementById(
  "resetCalibrationButton",
);

const jumpSensitivityInput = document.getElementById("jumpSensitivity");

const crouchSensitivityInput = document.getElementById("crouchSensitivity");

const jumpSensitivityValue = document.getElementById("jumpSensitivityValue");

const crouchSensitivityValue = document.getElementById(
  "crouchSensitivityValue",
);

const calibrationProgressContainer = document.getElementById(
  "calibrationProgressContainer",
);

const calibrationProgressText = document.getElementById(
  "calibrationProgressText",
);

const calibrationProgressBar = document.getElementById(
  "calibrationProgressBar",
);

const baselineShoulderValue = document.getElementById("baselineShoulderValue");

/*
  HTML เดิมอาจใช้ชื่อ Hip
  แต่ในระบบใหม่นำช่องนี้มาแสดงค่าจมูก
*/
const baselineHipValue = document.getElementById("baselineHipValue");

const jumpLineValue = document.getElementById("jumpLineValue");

const crouchLineValue = document.getElementById("crouchLineValue");

const poseValue = document.getElementById("poseValue");

const currentShoulderValue = document.getElementById("currentShoulderValue");

/*
  HTML เดิมอาจใช้ชื่อ Hip
  แต่ระบบใหม่นำมาแสดงค่าจมูก
*/
const currentHipValue = document.getElementById("currentHipValue");

/*
  HTML เดิมอาจใช้ชื่อ Hip Velocity
  แต่ระบบใหม่นำมาแสดงความเร็วของไหล่
*/
const hipVelocityValue = document.getElementById("hipVelocityValue");

const fpsValue = document.getElementById("fpsValue");

/* =========================================================
   MEDIAPIPE VARIABLES
========================================================= */

let poseLandmarker = null;
let drawingUtils = null;

let mediaStream = null;

let cameraAnimationId = null;

let lastVideoTime = -1;

let isCameraRunning = false;
let isDetecting = false;

/* =========================================================
   POSE APPLICATION STATE
========================================================= */

const POSE_APP_STATE = Object.freeze({
  IDLE: "idle",
  CALIBRATING: "calibrating",
  READY: "ready",
});

let poseAppState = POSE_APP_STATE.IDLE;

/* =========================================================
   POSE STATE
========================================================= */

const poseState = {
  /*
    พบช่วงบนของร่างกายหรือไม่
  */
  bodyFound: false,

  /*
    ท่าที่ได้รับการยืนยันแล้ว
  */
  currentPose: "stand",

  /*
    ท่าที่ตรวจพบล่าสุด แต่ยังไม่ยืนยัน
  */
  candidatePose: "stand",

  candidateFrames: 0,

  /*
    ระดับไหล่เฟรมก่อนหน้า
  */
  previousShoulderY: null,

  /*
    ความเร็วของไหล่ในแนวตั้ง

    ค่าบวก = เคลื่อนขึ้น
    ค่าลบ = เคลื่อนลง
  */
  shoulderVelocityY: 0,

  /*
    เก็บค่าหลายเฟรมสำหรับลดการสั่น
  */
  shoulderHistory: [],
  noseHistory: [],

  /*
    เวลาล่าสุดที่ตรวจพบช่วงบนของร่างกาย
  */
  lastDetectedAt: 0,
};

/* =========================================================
   CALIBRATION DATA
========================================================= */

const calibration = {
  complete: false,

  shoulderSamples: [],
  noseSamples: [],

  sampleTarget: CALIBRATION_SAMPLE_TARGET,

  baselineShoulderY: null,
  baselineNoseY: null,

  jumpLineY: null,
  crouchLineY: null,
};

/* =========================================================
   CREATE MEDIAPIPE
========================================================= */

async function createPoseLandmarker() {
  if (poseLandmarker !== null) {
    return;
  }

  setCameraStatus("กำลังโหลด MediaPipe...", "waiting");

  const vision = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/" +
        "mediapipe-models/pose_landmarker/" +
        "pose_landmarker_lite/float16/1/" +
        "pose_landmarker_lite.task",

      delegate: "GPU",
    },

    runningMode: "VIDEO",

    /*
          ตรวจจับเพียง 1 คน
        */
    numPoses: 1,

    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,

    outputSegmentationMasks: false,
  });

  drawingUtils = new DrawingUtils(poseCtx);
}

/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {
  if (isCameraRunning) {
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert(
      "เบราว์เซอร์ไม่รองรับการใช้งานกล้อง\n\n" +
        "กรุณาเปิดผ่าน Chrome, Edge หรือ Safari รุ่นใหม่",
    );

    return;
  }

  try {
    startCameraButton.disabled = true;

    setCameraStatus("กำลังเปิดกล้อง...", "waiting");

    await createPoseLandmarker();

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: {
          ideal: 1280,
        },

        height: {
          ideal: 720,
        },

        /*
            ใช้กล้องหน้า
          */
        facingMode: "user",
      },

      audio: false,
    });

    videoElement.srcObject = mediaStream;

    await waitForVideoMetadata();

    await videoElement.play();

    resizePoseCanvas();

    isCameraRunning = true;
    lastVideoTime = -1;

    cameraPlaceholder?.classList.add("hidden");

    startCameraButton.disabled = true;
    stopCameraButton.disabled = false;
    calibrateButton.disabled = false;

    setCameraStatus("กล้องทำงาน", "online");

    cameraAnimationId = requestAnimationFrame(predictWebcam);
  } catch (error) {
    console.error("Start camera error:", error);

    stopMediaStream();

    isCameraRunning = false;

    startCameraButton.disabled = false;
    stopCameraButton.disabled = true;
    calibrateButton.disabled = true;

    setCameraStatus("เปิดกล้องไม่สำเร็จ", "offline");

    alert(
      "ไม่สามารถเปิดกล้องได้\n\n" +
        "1. ตรวจสอบสิทธิ์การใช้กล้อง\n" +
        "2. เปิดเว็บไซต์ผ่าน localhost หรือ HTTPS\n" +
        "3. ตรวจสอบว่ากล้องไม่ได้ถูกโปรแกรมอื่นใช้งาน",
    );
  }
}

function waitForVideoMetadata() {
  return new Promise((resolve, reject) => {
    if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const handleLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();

      reject(new Error("ไม่สามารถโหลดข้อมูลวิดีโอได้"));
    };

    const cleanup = () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);

      videoElement.removeEventListener("error", handleError);
    };

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);

    videoElement.addEventListener("error", handleError);
  });
}

/* =========================================================
   STOP CAMERA
========================================================= */

function stopCamera() {
  isCameraRunning = false;
  isDetecting = false;

  resetAutoStartState();

  if (cameraAnimationId !== null) {
    cancelAnimationFrame(cameraAnimationId);

    cameraAnimationId = null;
  }

  stopMediaStream();

  videoElement.srcObject = null;

  clearPoseCanvas();

  cameraPlaceholder?.classList.remove("hidden");

  resetPoseTrackingState();

  startCameraButton.disabled = false;
  stopCameraButton.disabled = true;
  calibrateButton.disabled = true;

  enableStartGame(KEYBOARD_TEST_MODE);

  setCameraStatus("กล้องยังไม่เปิด", "offline");

  setPoseDetectionStatus(false);

  if (getGameState() === GAME_STATE.PLAYING) {
    pauseGameBecausePoseLost();
  }
}

function stopMediaStream() {
  if (mediaStream === null) {
    return;
  }

  mediaStream.getTracks().forEach((track) => {
    track.stop();
  });

  mediaStream = null;
}

/* =========================================================
   RESIZE POSE CANVAS
========================================================= */

function resizePoseCanvas() {
  poseCanvas.width = videoElement.videoWidth || 1280;

  poseCanvas.height = videoElement.videoHeight || 720;
}

function clearPoseCanvas() {
  poseCtx.clearRect(0, 0, poseCanvas.width, poseCanvas.height);
}

/* =========================================================
   WEBCAM DETECTION LOOP
========================================================= */

function predictWebcam() {
  if (!isCameraRunning || poseLandmarker === null) {
    return;
  }

  cameraAnimationId = requestAnimationFrame(predictWebcam);

  if (videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  /*
    ป้องกันตรวจซ้อนกัน
  */
  if (isDetecting) {
    return;
  }

  /*
    ตรวจเฉพาะเมื่อวิดีโอเปลี่ยนเฟรม
  */
  if (videoElement.currentTime === lastVideoTime) {
    return;
  }

  isDetecting = true;

  lastVideoTime = videoElement.currentTime;

  try {
    const timestamp = performance.now();

    const result = poseLandmarker.detectForVideo(videoElement, timestamp);

    processPoseResult(result, timestamp);
  } catch (error) {
    console.error("Pose detection error:", error);
  } finally {
    isDetecting = false;
  }
}

/* =========================================================
   PROCESS POSE RESULT
========================================================= */

function processPoseResult(result, timestamp) {
  clearPoseCanvas();

  const landmarks = result.landmarks?.[0];

  if (!landmarks || !hasRequiredLandmarks(landmarks)) {
    processBodyNotFound(timestamp);
    return;
  }

  poseState.bodyFound = true;
  poseState.lastDetectedAt = timestamp;

  setPoseDetectionStatus(true);

  drawUpperBodyPose(landmarks);

  /*
    คำนวณระดับกลางของไหล่
  */
  const rawShoulderY = average(landmarks[11].y, landmarks[12].y);

  /*
    ใช้ตำแหน่งจมูกเป็นข้อมูลเสริม
  */
  const rawNoseY = landmarks[0].y;

  const shoulderY = smoothValue(
    poseState.shoulderHistory,
    rawShoulderY,
    SMOOTHING_FRAME_LIMIT,
  );

  const noseY = smoothValue(
    poseState.noseHistory,
    rawNoseY,
    SMOOTHING_FRAME_LIMIT,
  );

  updateShoulderVelocity(shoulderY);

  updateDebugValues(shoulderY, noseY);

  if (poseAppState === POSE_APP_STATE.CALIBRATING) {
    collectCalibrationSample(shoulderY, noseY);
  }

  if (calibration.complete) {
    const candidatePose = classifyPose(shoulderY);

    const confirmedPose = confirmPose(candidatePose);

    updatePoseDisplay(confirmedPose);

    /*
    ตรวจการยืนเตรียมพร้อม
    เฉพาะตอนเกมยังไม่เริ่ม
  */
    updateAutoStart(confirmedPose, timestamp);

    applyPoseToGame(confirmedPose);
  }

  drawReferenceLines();
  updateFps(timestamp);
}

function processBodyNotFound(timestamp) {
  poseState.bodyFound = false;

  setPoseDetectionStatus(false);

  drawReferenceLines();

  /*
    ถ้าอยู่ในโหมดทดสอบคีย์บอร์ด
    ไม่ต้องหยุดเกมเมื่อหาตัวไม่พบ
  */
  if (KEYBOARD_TEST_MODE) {
    return;
  }

  const bodyLostDuration = timestamp - poseState.lastDetectedAt;

  if (bodyLostDuration > BODY_LOST_TIMEOUT) {
    pauseGameBecausePoseLost();
  }
}

/* =========================================================
   CHECK UPPER BODY LANDMARKS
========================================================= */

function hasRequiredLandmarks(landmarks) {
  /*
    ตรวจเพียง:
    0  = จมูก
    11 = ไหล่ซ้าย
    12 = ไหล่ขวา
  */
  const requiredIndexes = [0, 11, 12];

  return requiredIndexes.every((index) => {
    const landmark = landmarks[index];

    if (!landmark) {
      return false;
    }

    const visibility = landmark.visibility ?? 1;

    return (
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      visibility >= MIN_LANDMARK_VISIBILITY
    );
  });
}

/* =========================================================
   DRAW UPPER BODY
========================================================= */

function drawUpperBodyPose(landmarks) {
  if (drawingUtils === null) {
    return;
  }

  /*
    วาดเส้นเฉพาะช่วงแขนและไหล่
  */
  const upperBodyConnections = [
    {
      start: 11,
      end: 12,
    },

    {
      start: 11,
      end: 13,
    },

    {
      start: 13,
      end: 15,
    },

    {
      start: 12,
      end: 14,
    },

    {
      start: 14,
      end: 16,
    },
  ];

  drawingUtils.drawConnectors(landmarks, upperBodyConnections, {
    color: "#22d3ee",
    lineWidth: 3,
  });

  const upperBodyIndexes = [0, 11, 12, 13, 14, 15, 16];

  /*
    วาดทีละ Landmark เพื่อรักษาตำแหน่งเดิม
    ของแต่ละจุด
  */
  const visibleLandmarks = upperBodyIndexes
    .map((index) => landmarks[index])
    .filter((landmark) => {
      if (!landmark) {
        return false;
      }

      return (landmark.visibility ?? 1) >= 0.25;
    });

  drawingUtils.drawLandmarks(visibleLandmarks, {
    color: "#f8fafc",
    fillColor: "#0891b2",
    lineWidth: 2,
    radius: 4,
  });
}

/* =========================================================
   SHOULDER VELOCITY
========================================================= */

function updateShoulderVelocity(shoulderY) {
  if (poseState.previousShoulderY !== null) {
    poseState.shoulderVelocityY = poseState.previousShoulderY - shoulderY;
  } else {
    poseState.shoulderVelocityY = 0;
  }

  poseState.previousShoulderY = shoulderY;
}

/* =========================================================
   AUTO START BY STANDING
========================================================= */

function updateAutoStart(currentPose, timestamp) {
  /*
    โหมดคีย์บอร์ดไม่ใช้ระบบนี้
  */
  if (KEYBOARD_TEST_MODE) {
    return;
  }

  /*
    ต้องเปิดกล้องและ Calibration สำเร็จ
  */
  if (!isCameraRunning || !poseState.bodyFound || !calibration.complete) {
    resetStandReadyTimer();
    return;
  }

  const currentGameState = getGameState();

  /*
    ไม่ต้องตรวจเมื่อเกมกำลังเล่น
    หยุดชั่วคราว หรือนับถอยหลังอยู่
  */
  if (
    currentGameState === GAME_STATE.PLAYING ||
    currentGameState === GAME_STATE.PAUSED ||
    currentGameState === GAME_STATE.COUNTDOWN ||
    autoStartState.isCountingDown
  ) {
    return;
  }

  /*
    หากเกมเคยเริ่มอัตโนมัติแล้ว
    ไม่เริ่มซ้ำจนกว่าจะ Reset
  */
  if (autoStartState.hasStartedGame) {
    return;
  }

  if (currentPose === "stand") {
    autoStartState.lastStandDetectedAt = timestamp;

    /*
      เฟรมแรกที่ตรวจพบ Stand
    */
    if (autoStartState.standStartedAt === null) {
      autoStartState.standStartedAt = timestamp;
    }

    const standingDuration = timestamp - autoStartState.standStartedAt;

    const remainingMilliseconds = Math.max(
      0,
      STAND_READY_DURATION - standingDuration,
    );

    const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);

    setText(
      calibrationStatus,
      remainingSeconds > 0
        ? `ยืนเตรียมพร้อมอีก ${remainingSeconds} วินาที`
        : "เตรียมนับถอยหลัง",
    );

    setGameStatus(
      `ยืนเตรียมพร้อม ${Math.min(
        5,
        Math.floor(standingDuration / 1000) + 1,
      )}/5`,
      "waiting",
    );

    if (standingDuration >= STAND_READY_DURATION) {
      beginAutoCountdown();
    }

    return;
  }

  /*
    กรณี Landmark สั่นชั่วคราว
    ให้เผื่อเวลาเล็กน้อยก่อนรีเซ็ต
  */
  const timeSinceLastStand =
    autoStartState.lastStandDetectedAt === null
      ? Infinity
      : timestamp - autoStartState.lastStandDetectedAt;

  if (timeSinceLastStand > STAND_LOST_TOLERANCE) {
    resetStandReadyTimer();

    setText(calibrationStatus, "กรุณายืนตรงเพื่อเตรียมเริ่มเกม");

    setGameStatus(
      currentPose === "jump" ? "ตรวจพบท่ากระโดด" : "ตรวจพบท่าย่อตัว",
      "waiting",
    );
  }
}

async function beginAutoCountdown() {
  if (autoStartState.isCountingDown || autoStartState.hasStartedGame) {
    return;
  }

  autoStartState.isCountingDown = true;
  autoStartState.countdownRemaining = AUTO_COUNTDOWN_SECONDS;

  countdownOverlay?.classList.remove("hidden");

  setGameStatus("กำลังนับถอยหลัง", "waiting");

  setText(calibrationStatus, "เตรียมพร้อมเริ่มเกม");

  for (let count = AUTO_COUNTDOWN_SECONDS; count >= 1; count -= 1) {
    /*
      ตรวจว่าระหว่างนับถอยหลัง
      ยังพบร่างกายอยู่หรือไม่
    */
    if (!isCameraRunning || !poseState.bodyFound || !calibration.complete) {
      cancelAutoCountdown("ไม่พบร่างกาย ยกเลิกการเริ่มเกม");

      return;
    }

    autoStartState.countdownRemaining = count;

    setText(countdownValue, String(count));

    setText(calibrationStatus, `เริ่มเกมใน ${count} วินาที`);

    await wait(1000);
  }

  /*
    ตรวจอีกครั้งก่อนเริ่มเกม
  */
  if (!isCameraRunning || !poseState.bodyFound || !calibration.complete) {
    cancelAutoCountdown("ไม่พบร่างกาย ยกเลิกการเริ่มเกม");

    return;
  }

  setText(countdownValue, "GO!");

  setText(calibrationStatus, "เริ่มเกม");

  await wait(500);

  countdownOverlay?.classList.add("hidden");

  autoStartState.isCountingDown = false;
  autoStartState.hasStartedGame = true;

  enableStartGame(true);

  await startGame();
}

function cancelAutoCountdown(message = "ยกเลิกการเริ่มเกม") {
  autoStartState.isCountingDown = false;

  autoStartState.countdownRemaining = AUTO_COUNTDOWN_SECONDS;

  countdownOverlay?.classList.add("hidden");

  setText(countdownValue, String(AUTO_COUNTDOWN_SECONDS));

  setText(calibrationStatus, message);

  resetStandReadyTimer();

  setGameStatus("รอยืนเตรียมพร้อม", "waiting");
}

function resetStandReadyTimer() {
  autoStartState.standStartedAt = null;

  autoStartState.lastStandDetectedAt = null;
}

function resetAutoStartState() {
  if (autoStartState.countdownIntervalId !== null) {
    clearInterval(autoStartState.countdownIntervalId);

    autoStartState.countdownIntervalId = null;
  }

  autoStartState.standStartedAt = null;

  autoStartState.lastStandDetectedAt = null;

  autoStartState.isCountingDown = false;

  autoStartState.hasStartedGame = false;

  autoStartState.countdownRemaining = AUTO_COUNTDOWN_SECONDS;

  countdownOverlay?.classList.add("hidden");

  setText(countdownValue, String(AUTO_COUNTDOWN_SECONDS));
}

/* =========================================================
   CALIBRATION
========================================================= */

function startCalibration() {
  if (!isCameraRunning) {
    alert("กรุณาเปิดกล้องก่อน");
    return;
  }

  if (!poseState.bodyFound) {
    alert(
      "ยังไม่พบช่วงบนของร่างกาย\n\n" +
        "กรุณาให้กล้องเห็นใบหน้าและไหล่ทั้งสองข้าง",
    );

    return;
  }

  const currentGameState = getGameState();

  if (
    currentGameState === GAME_STATE.PLAYING ||
    currentGameState === GAME_STATE.COUNTDOWN
  ) {
    alert("ไม่สามารถ Calibration ระหว่างเล่นเกมได้");

    return;
  }

  calibration.complete = false;

  calibration.shoulderSamples = [];
  calibration.noseSamples = [];

  poseAppState = POSE_APP_STATE.CALIBRATING;

  calibrationProgressContainer?.classList.remove("hidden");

  if (calibrationProgressBar) {
    calibrationProgressBar.style.width = "0%";
  }

  setText(calibrationProgressText, "0%");

  setText(calibrationStatus, "กรุณายืนตรงและอย่าขยับ");

  calibrateButton.disabled = true;

  if (resetCalibrationButton) {
    resetCalibrationButton.disabled = true;
  }

  enableStartGame(false);

  setGameStatus("กำลังปรับเส้น", "waiting");
}

function collectCalibrationSample(shoulderY, noseY) {
  calibration.shoulderSamples.push(shoulderY);

  calibration.noseSamples.push(noseY);

  const currentSamples = calibration.shoulderSamples.length;

  const progress = Math.min(
    100,
    Math.round((currentSamples / calibration.sampleTarget) * 100),
  );

  if (calibrationProgressBar) {
    calibrationProgressBar.style.width = `${progress}%`;
  }

  setText(calibrationProgressText, `${progress}%`);

  if (currentSamples >= calibration.sampleTarget) {
    finishCalibration();
  }
}

function finishCalibration() {
  calibration.baselineShoulderY = robustAverage(calibration.shoulderSamples);

  calibration.baselineNoseY = robustAverage(calibration.noseSamples);

  updateCalibrationLines();

  calibration.complete = true;

  resetAutoStartState();

  poseAppState = POSE_APP_STATE.READY;

  calibrationProgressContainer?.classList.add("hidden");

  setText(calibrationStatus, "กรุณายืนตรง 5 วินาที");

  calibrateButton.disabled = false;

  if (resetCalibrationButton) {
    resetCalibrationButton.disabled = false;
  }

  setText(baselineShoulderValue, calibration.baselineShoulderY.toFixed(3));

  setText(baselineHipValue, calibration.baselineNoseY.toFixed(3));

  enableStartGame(true);

  setGameStatus("รอยืนเตรียมพร้อม", "waiting");
}

function resetCalibration() {
  const currentGameState = getGameState();

  if (
    currentGameState === GAME_STATE.PLAYING ||
    currentGameState === GAME_STATE.COUNTDOWN
  ) {
    return;
  }

  resetAutoStartState();

  calibration.complete = false;

  calibration.shoulderSamples = [];
  calibration.noseSamples = [];

  calibration.baselineShoulderY = null;

  calibration.baselineNoseY = null;

  calibration.jumpLineY = null;
  calibration.crouchLineY = null;

  poseAppState = POSE_APP_STATE.IDLE;

  resetPoseTrackingState();

  setText(baselineShoulderValue, "-");

  setText(baselineHipValue, "-");

  setText(jumpLineValue, "-");

  setText(crouchLineValue, "-");

  calibrationProgressContainer?.classList.add("hidden");

  if (calibrationProgressBar) {
    calibrationProgressBar.style.width = "0%";
  }

  setText(calibrationProgressText, "0%");

  setText(
    calibrationStatus,
    KEYBOARD_TEST_MODE ? "โหมดทดสอบคีย์บอร์ด" : "ยังไม่ปรับ",
  );

  if (resetCalibrationButton) {
    resetCalibrationButton.disabled = true;
  }

  enableStartGame(KEYBOARD_TEST_MODE);

  updatePoseDisplay("-");

  setGameStatus(
    KEYBOARD_TEST_MODE ? "พร้อมทดสอบเกม" : "รอเริ่มเกม",
    KEYBOARD_TEST_MODE ? "playing" : "waiting",
  );
}

/* =========================================================
   CALIBRATION LINES
========================================================= */

function updateCalibrationLines() {
  if (
    calibration.baselineShoulderY ===
    null
  ) {
    return;
  }

  const jumpOffset =
    getNumberInputValue(
      jumpSensitivityInput,
      0.075,
    );

  const crouchOffset =
    getNumberInputValue(
      crouchSensitivityInput,
      0.085,
    );

  /*
    กระโดด:
    ค่า Y ลดลง เส้นขยับขึ้น
  */
  calibration.jumpLineY =
    clamp(
      calibration.baselineShoulderY -
        jumpOffset,
      0.02,
      0.95,
    );

  /*
    ย่อตัว:
    ค่า Y เพิ่มขึ้น เส้นขยับลง
  */
  calibration.crouchLineY =
    clamp(
      calibration.baselineShoulderY +
        crouchOffset,
      0.02,
      0.98,
    );

  setText(
    jumpLineValue,
    calibration.jumpLineY.toFixed(3),
  );

  setText(
    crouchLineValue,
    calibration.crouchLineY.toFixed(3),
  );
}

function drawReferenceLines() {
  if (!calibration.complete) {
    return;
  }

  drawReferenceLine(calibration.jumpLineY, "#22c55e", "JUMP");

  drawReferenceLine(calibration.crouchLineY, "#f59e0b", "CROUCH");
}

function drawReferenceLine(
  normalizedY,
  color,
  label,
) {
  if (!Number.isFinite(normalizedY)) {
    return;
  }

  const y =
    normalizedY *
    poseCanvas.height;

  poseCtx.save();

  /*
    เพิ่มเงาดำใต้เส้น
    ทำให้มองเห็นได้ชัดบนพื้นหลังทุกสี
  */
  poseCtx.beginPath();
  poseCtx.moveTo(0, y);
  poseCtx.lineTo(
    poseCanvas.width,
    y,
  );

  poseCtx.strokeStyle =
    "rgba(0, 0, 0, 0.65)";

  poseCtx.lineWidth = 15;

  poseCtx.setLineDash([
    30,
    16,
  ]);

  poseCtx.stroke();

  /*
    วาดเส้นสีจริงทับด้านบน
  */
  poseCtx.beginPath();
  poseCtx.moveTo(0, y);
  poseCtx.lineTo(
    poseCanvas.width,
    y,
  );

  poseCtx.strokeStyle = color;
  poseCtx.lineWidth = 9;

  poseCtx.setLineDash([
    30,
    16,
  ]);

  poseCtx.stroke();

  poseCtx.setLineDash([]);

  poseCtx.font =
    "bold 30px sans-serif";

  poseCtx.lineWidth = 5;
  poseCtx.strokeStyle =
    "rgba(0, 0, 0, 0.8)";

  poseCtx.strokeText(
    label,
    22,
    Math.max(38, y - 15),
  );

  poseCtx.fillStyle = color;

  poseCtx.fillText(
    label,
    22,
    Math.max(38, y - 15),
  );

  poseCtx.restore();
}

/* =========================================================
   CLASSIFY POSE
========================================================= */

function classifyPose(shoulderY) {
  if (!calibration.complete) {
    return "stand";
  }

  const jumpEntryLine =
    calibration.jumpLineY;

  const crouchEntryLine =
    calibration.crouchLineY;

  /*
    เส้นกลับสู่ Stand
    ทำให้มีพื้นที่กลางกว้างขึ้น
  */
  const jumpExitLine =
    jumpEntryLine + 0.035;

  const crouchExitLine =
    crouchEntryLine - 0.035;

  const isMovingUp =
    poseState.shoulderVelocityY >
    0.0012;

  if (
    shoulderY < jumpEntryLine &&
    isMovingUp
  ) {
    return "jump";
  }

  if (
    poseState.currentPose === "jump" &&
    shoulderY < jumpExitLine
  ) {
    return "jump";
  }

  if (
    poseState.currentPose ===
      "crouch" &&
    shoulderY > crouchExitLine
  ) {
    return "crouch";
  }

  if (
    shoulderY > crouchEntryLine
  ) {
    return "crouch";
  }

  return "stand";
}

/* =========================================================
   CONFIRM POSE OVER MULTIPLE FRAMES
========================================================= */

function confirmPose(candidatePose) {
  /*
    Jump ต้องตอบสนองเร็วกว่าท่าอื่น
  */
  const requiredFrames = candidatePose === "jump" ? 2 : 3;

  if (candidatePose === poseState.candidatePose) {
    poseState.candidateFrames += 1;
  } else {
    poseState.candidatePose = candidatePose;

    poseState.candidateFrames = 1;
  }

  if (poseState.candidateFrames >= requiredFrames) {
    poseState.currentPose = candidatePose;
  }

  return poseState.currentPose;
}

/* =========================================================
   RESET POSE TRACKING
========================================================= */

function resetPoseTrackingState() {
  poseState.bodyFound = false;

  poseState.currentPose = "stand";
  poseState.candidatePose = "stand";
  poseState.candidateFrames = 0;

  poseState.previousShoulderY = null;

  poseState.shoulderVelocityY = 0;

  poseState.shoulderHistory = [];
  poseState.noseHistory = [];

  poseState.lastDetectedAt = 0;

  setText(currentShoulderValue, "-");

  setText(currentHipValue, "-");

  setText(hipVelocityValue, "-");
}

/* =========================================================
   DEBUG VALUES
========================================================= */

function updateDebugValues(shoulderY, noseY) {
  setText(currentShoulderValue, shoulderY.toFixed(3));

  /*
    ช่อง Hip เดิมแสดงค่าจมูก
  */
  setText(currentHipValue, noseY.toFixed(3));

  /*
    ช่อง Hip Velocity เดิม
    แสดงความเร็วไหล่
  */
  setText(hipVelocityValue, poseState.shoulderVelocityY.toFixed(4));
}

/* =========================================================
   UI STATUS
========================================================= */

function setCameraStatus(text, type) {
  if (!cameraStatus) {
    return;
  }

  cameraStatus.textContent = text;

  cameraStatus.className = "status-badge";

  if (type === "online") {
    cameraStatus.classList.add("status-online");

    return;
  }

  if (type === "waiting") {
    cameraStatus.classList.add("status-waiting");

    return;
  }

  cameraStatus.classList.add("status-offline");
}

function setGameStatus(text, type) {
  if (!gameStatusBadge) {
    return;
  }

  gameStatusBadge.textContent = text;

  gameStatusBadge.className = "status-badge";

  if (type === "playing") {
    gameStatusBadge.classList.add("status-playing");

    return;
  }

  if (type === "waiting") {
    gameStatusBadge.classList.add("status-waiting");

    return;
  }

  gameStatusBadge.classList.add("status-offline");
}

function setPoseDetectionStatus(found) {
  if (!poseDetectionStatus) {
    return;
  }

  if (found) {
    poseDetectionStatus.textContent = "พบช่วงบนของร่างกาย";

    poseDetectionStatus.style.color = "#86efac";

    poseDetectionStatus.style.borderColor = "rgba(34, 197, 94, 0.30)";

    poseDetectionStatus.style.background = "rgba(34, 197, 94, 0.14)";

    return;
  }

  poseDetectionStatus.textContent = "ไม่พบช่วงบนของร่างกาย";

  poseDetectionStatus.style.color = "";
  poseDetectionStatus.style.borderColor = "";

  poseDetectionStatus.style.background = "";
}

function updatePoseDisplay(pose) {
  if (!poseValue) {
    return;
  }

  poseValue.className = "stat-value";

  /*
    ก่อนตั้งค่าเส้นอ้างอิง
    ให้แสดงเป็นเครื่องหมาย -
  */
  if (
    pose === "-" ||
    !calibration.complete
  ) {
    poseValue.textContent = "-";
    poseValue.classList.add("pose-unset");
    return;
  }

  poseValue.textContent =
    getPoseThai(pose);

  if (pose === "jump") {
    poseValue.classList.add("pose-jump");
    return;
  }

  if (pose === "crouch") {
    poseValue.classList.add("pose-crouch");
    return;
  }

  poseValue.classList.add("pose-stand");
}

function getPoseThai(pose) {
  const poseNames = {
    stand: "ยืน",
    jump: "กระโดด",
    crouch: "ย่อตัว",
  };

  return poseNames[pose] ?? "ไม่ทราบ";
}

/* =========================================================
   SENSITIVITY CONTROLS
========================================================= */

function setupSensitivityControls() {
  updateSensitivityText();

  jumpSensitivityInput?.addEventListener("input", () => {
    updateSensitivityText();
    updateCalibrationLines();
  });

  crouchSensitivityInput?.addEventListener("input", () => {
    updateSensitivityText();
    updateCalibrationLines();
  });
}

function updateSensitivityText() {
  const jumpValue = getNumberInputValue(jumpSensitivityInput, 0.075);

  const crouchValue = getNumberInputValue(crouchSensitivityInput, 0.085);

  setText(jumpSensitivityValue, jumpValue.toFixed(3));

  setText(crouchSensitivityValue, crouchValue.toFixed(3));
}

/* =========================================================
   FPS
========================================================= */

let fpsFrameCount = 0;

let fpsLastUpdate = performance.now();

function updateFps(timestamp) {
  fpsFrameCount += 1;

  const elapsed = timestamp - fpsLastUpdate;

  if (elapsed < 1000) {
    return;
  }

  const fps = Math.round((fpsFrameCount * 1000) / elapsed);

  setText(fpsValue, String(fps));

  fpsFrameCount = 0;
  fpsLastUpdate = timestamp;
}

/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {
  startCameraButton?.addEventListener("click", startCamera);

  stopCameraButton?.addEventListener("click", stopCamera);

  calibrateButton?.addEventListener("click", startCalibration);

  resetCalibrationButton?.addEventListener("click", resetCalibration);

  window.addEventListener("resize", () => {
    if (isCameraRunning) {
      resizePoseCanvas();
    }
  });

  window.addEventListener("beforeunload", closeResources);
}

function closeResources() {
  stopMediaStream();

  if (poseLandmarker !== null) {
    poseLandmarker.close();
    poseLandmarker = null;
  }
}

/* =========================================================
   HELPER FUNCTIONS
========================================================= */
function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      milliseconds,
    );
  });
}

function clamp(
  value,
  minimum,
  maximum,
) {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function average(...values) {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  return (
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length
  );
}

function smoothValue(history, value, limit) {
  history.push(value);

  if (history.length > limit) {
    history.shift();
  }

  return average(...history);
}

function robustAverage(values) {
  const validValues = values.filter(Number.isFinite);

  if (validValues.length === 0) {
    return 0;
  }

  const sorted = [...validValues].sort((a, b) => a - b);

  /*
    ตัดค่าบนและล่างออก 10%
    เพื่อลดผลจากค่าหลุด
  */
  const removeCount = Math.floor(sorted.length * 0.1);

  const trimmed =
    removeCount > 0 && sorted.length > removeCount * 2
      ? sorted.slice(removeCount, sorted.length - removeCount)
      : sorted;

  return average(...trimmed);
}

function getNumberInputValue(input, fallback) {
  if (!input) {
    return fallback;
  }

  const value = Number(input.value);

  return Number.isFinite(value) ? value : fallback;
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {
  setupEventListeners();
  setupSensitivityControls();

  if (startCameraButton) {
    startCameraButton.disabled = false;
  }

  if (stopCameraButton) {
    stopCameraButton.disabled = true;
  }

  if (calibrateButton) {
    calibrateButton.disabled = true;
  }

  if (resetCalibrationButton) {
    resetCalibrationButton.disabled = true;
  }

  setCameraStatus("กล้องยังไม่เปิด", "offline");

  setPoseDetectionStatus(false);
  updatePoseDisplay("-");

  initializeCanvasGame({
    /*
      ตรวจว่าเกมสามารถเริ่มได้หรือไม่
    */
    canStartGame: () => {
      if (KEYBOARD_TEST_MODE) {
        return true;
      }

      return isCameraRunning && poseState.bodyFound && calibration.complete;
    },

    /*
      Canvas Game ใช้ตรวจว่าพบร่างกายหรือไม่
    */
    isBodyFound: () => {
      if (KEYBOARD_TEST_MODE) {
        return true;
      }

      return poseState.bodyFound;
    },

    /*
      ส่งสถานะจากเกมมาแสดง
    */
    onStatusChange: (text, type) => {
      setGameStatus(text, type);
    },

    /*
      ส่งชื่อท่าปัจจุบันไปแสดงบน Canvas
    */
    getCurrentPoseName: () => {
      if (KEYBOARD_TEST_MODE) {
        return "คีย์บอร์ด";
      }

      return getPoseThai(poseState.currentPose);
    },
  });

  if (KEYBOARD_TEST_MODE) {
    enableStartGame(true);

    setText(calibrationStatus, "โหมดทดสอบคีย์บอร์ด");

    setGameStatus("พร้อมทดสอบเกม", "playing");
  } else {
    enableStartGame(false);

    setText(calibrationStatus, "ยังไม่ปรับ");

    setGameStatus("รอเริ่มเกม", "waiting");
  }
}

initialize();
