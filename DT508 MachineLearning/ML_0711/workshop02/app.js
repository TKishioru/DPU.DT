"use strict";

const MODEL_FOLDER = "./my_model/";
const CAMERA_SIZE = 400;
const FLIP_CAMERA = true;
const MIN_PART_CONFIDENCE = 0.5;

let model = null;
let webcam = null;
let canvasContext = null;
let maxPredictions = 0;
let animationFrameId = null;
let isCameraRunning = false;
let isStarting = false;

const canvas = document.getElementById("canvas");
const labelContainer = document.getElementById("label-container");
const statusMessage = document.getElementById("status-message");
const startButton = document.getElementById("start-button");
const stopButton = document.getElementById("stop-button");

function setStatus(message, type = "secondary") {
    statusMessage.className = `alert alert-${type} text-center`;
    statusMessage.textContent = message;
}

function getModelURL(filename) {
    return new URL(
        `${MODEL_FOLDER}${filename}`,
        window.location.href
    ).href;
}

async function checkFile(url, fileName) {
    let response;

    try {
        response = await fetch(url, {
            method: "GET",
            cache: "no-store"
        });
    } catch (error) {
        throw new Error(
            `ไม่สามารถเชื่อมต่อเพื่อโหลด ${fileName} ได้ ` +
            `กรุณาเปิดเว็บไซต์ผ่าน Local Server`
        );
    }

    if (!response.ok) {
        throw new Error(
            `ไม่พบไฟล์ ${fileName} หรือเซิร์ฟเวอร์ตอบกลับ HTTP ${response.status}`
        );
    }
}

async function loadModel() {
    if (model) {
        return;
    }

    if (!window.tmPose) {
        throw new Error(
            "โหลดไลบรารี Teachable Machine Pose ไม่สำเร็จ"
        );
    }

    if (!window.tf) {
        throw new Error(
            "โหลดไลบรารี TensorFlow.js ไม่สำเร็จ"
        );
    }

    const modelURL = getModelURL("model.json");
    const metadataURL = getModelURL("metadata.json");

    console.log("Model URL:", modelURL);
    console.log("Metadata URL:", metadataURL);

    setStatus("กำลังตรวจสอบไฟล์โมเดล...", "info");

    await checkFile(modelURL, "model.json");
    await checkFile(metadataURL, "metadata.json");

    setStatus("กำลังโหลดโมเดล...", "info");

    try {
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();
    } catch (error) {
        console.error("Model loading error:", error);

        throw new Error(
            "เปิดไฟล์โมเดลไม่ได้ กรุณาตรวจสอบว่าโมเดลถูก Export " +
            "จาก Teachable Machine ประเภท Pose Project"
        );
    }

    createPredictionLabels();
}

function createPredictionLabels() {
    labelContainer.innerHTML = "";

    for (let index = 0; index < maxPredictions; index += 1) {
        const predictionItem = document.createElement("div");
        predictionItem.className = "prediction-item";

        const predictionText = document.createElement("div");
        predictionText.className = "prediction-text";
        predictionText.textContent = `Class ${index + 1}: 0.00%`;

        const progress = document.createElement("div");
        progress.className = "progress";
        progress.setAttribute("role", "progressbar");
        progress.setAttribute("aria-valuemin", "0");
        progress.setAttribute("aria-valuemax", "100");

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressBar.style.width = "0%";
        progressBar.textContent = "0.00%";

        progress.appendChild(progressBar);
        predictionItem.appendChild(predictionText);
        predictionItem.appendChild(progress);

        labelContainer.appendChild(predictionItem);
    }
}

async function startCamera() {
    if (isCameraRunning || isStarting) {
        return;
    }

    isStarting = true;
    startButton.disabled = true;

    try {
        /*
         * ห้ามเปิด index.html ด้วย file://
         * ต้องเปิดผ่าน http://localhost หรือ https://
         */
        if (window.location.protocol === "file:") {
            throw new Error(
                "ไม่สามารถทำงานผ่านไฟล์โดยตรงได้ " +
                "กรุณาเปิดด้วย Live Server หรือ Python Local Server"
            );
        }

        await loadModel();

        setStatus("กำลังขอสิทธิ์ใช้งานกล้อง...", "warning");

        webcam = new tmPose.Webcam(
            CAMERA_SIZE,
            CAMERA_SIZE,
            FLIP_CAMERA
        );

        await webcam.setup();
        await webcam.play();

        canvas.width = CAMERA_SIZE;
        canvas.height = CAMERA_SIZE;

        canvasContext = canvas.getContext("2d");

        if (!canvasContext) {
            throw new Error("ไม่สามารถสร้าง Canvas Context ได้");
        }

        isCameraRunning = true;

        startButton.disabled = true;
        stopButton.disabled = false;

        setStatus(
            "เปิดกล้องสำเร็จ กำลังตรวจจับท่าทาง",
            "success"
        );

        animationFrameId = window.requestAnimationFrame(loop);
    } catch (error) {
        console.error("Start camera error:", error);

        stopCamera(false);

        setStatus(
            getReadableError(error),
            "danger"
        );
    } finally {
        isStarting = false;

        if (!isCameraRunning) {
            startButton.disabled = false;
        }
    }
}

async function loop() {
    if (!isCameraRunning || !webcam) {
        return;
    }

    try {
        webcam.update();
        await predict();

        if (isCameraRunning) {
            animationFrameId =
                window.requestAnimationFrame(loop);
        }
    } catch (error) {
        console.error("Prediction error:", error);

        setStatus(
            `เกิดข้อผิดพลาดระหว่างตรวจจับ: ${error.message}`,
            "danger"
        );

        stopCamera(false);
    }
}

async function predict() {
    if (!model || !webcam) {
        return;
    }

    const poseResult =
        await model.estimatePose(webcam.canvas);

    const pose = poseResult.pose;
    const posenetOutput = poseResult.posenetOutput;

    const predictions =
        await model.predict(posenetOutput);

    updatePredictionLabels(predictions);
    drawPose(pose);
}

function updatePredictionLabels(predictions) {
    predictions.forEach((prediction, index) => {
        const predictionItem =
            labelContainer.children[index];

        if (!predictionItem) {
            return;
        }

        const percentage =
            prediction.probability * 100;

        const predictionText =
            predictionItem.querySelector(".prediction-text");

        const progressBar =
            predictionItem.querySelector(".progress-bar");

        predictionText.textContent =
            `${prediction.className}: ${percentage.toFixed(2)}%`;

        progressBar.style.width =
            `${percentage}%`;

        progressBar.textContent =
            `${percentage.toFixed(2)}%`;

        progressBar.setAttribute(
            "aria-valuenow",
            percentage.toFixed(2)
        );
    });
}

function drawPose(pose) {
    if (!canvasContext || !webcam?.canvas) {
        return;
    }

    canvasContext.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    canvasContext.drawImage(
        webcam.canvas,
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (!pose) {
        return;
    }

    tmPose.drawKeypoints(
        pose.keypoints,
        MIN_PART_CONFIDENCE,
        canvasContext
    );

    tmPose.drawSkeleton(
        pose.keypoints,
        MIN_PART_CONFIDENCE,
        canvasContext
    );
}

function stopCamera(showStatus = true) {
    isCameraRunning = false;

    if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (webcam) {
        try {
            webcam.stop();
        } catch (error) {
            console.warn("Stop camera warning:", error);
        }

        webcam = null;
    }

    if (canvasContext) {
        canvasContext.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );
    }

    startButton.disabled = false;
    stopButton.disabled = true;

    if (showStatus) {
        setStatus("ปิดกล้องแล้ว", "secondary");
    }
}

function getReadableError(error) {
    const errorName = error?.name || "";
    const errorMessage =
        error?.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError"
    ) {
        return (
            "เบราว์เซอร์ไม่ได้รับอนุญาตให้ใช้กล้อง " +
            "กรุณากดอนุญาตสิทธิ์กล้องแล้วลองใหม่"
        );
    }

    if (
        errorName === "NotFoundError" ||
        errorName === "DevicesNotFoundError"
    ) {
        return "ไม่พบกล้องบนอุปกรณ์นี้";
    }

    if (
        errorName === "NotReadableError" ||
        errorName === "TrackStartError"
    ) {
        return (
            "ไม่สามารถอ่านข้อมูลจากกล้องได้ " +
            "กล้องอาจกำลังถูกโปรแกรมอื่นใช้งาน"
        );
    }

    if (errorName === "OverconstrainedError") {
        return "กล้องไม่รองรับการตั้งค่าที่กำหนด";
    }

    if (errorName === "SecurityError") {
        return (
            "เบราว์เซอร์บล็อกกล้องด้วยเหตุผลด้านความปลอดภัย " +
            "กรุณาเปิดผ่าน localhost หรือ HTTPS"
        );
    }

    return errorMessage;
}

startButton.addEventListener("click", startCamera);

stopButton.addEventListener("click", () => {
    stopCamera(true);
});

window.addEventListener("beforeunload", () => {
    stopCamera(false);
});