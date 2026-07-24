"use strict";

// ตำแหน่งโฟลเดอร์โมเดล
const MODEL_URL = "./my_model/";

const CAMERA_SIZE = 200;
const FLIP_CAMERA = true;
const MIN_PART_CONFIDENCE = 0.5;
const MIN_CLASS_PROBABILITY = 0.5;
const MOVE_STEP = 0.05;
const MOVE_DELAY = 120;

let model = null;
let webcam = null;
let ctx = null;
let labelContainer = null;
let maxPredictions = 0;
let animationFrameId = null;

let isRunning = false;
let isStarting = false;
let lastMoveTime = 0;

/**
 * เริ่มโหลดโมเดลและเปิดกล้อง
 */
async function init() {
    if (isRunning || isStarting) {
        return;
    }

    isStarting = true;

    const startButton = document.querySelector(
        'button[onclick="init()"]'
    );

    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "กำลังเปิดกล้อง...";
    }

    try {
        checkRequiredLibraries();

        const modelURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";

        console.log("Model URL:", modelURL);
        console.log("Metadata URL:", metadataURL);

        // โหลดโมเดล Teachable Machine Pose
        model = await tmPose.load(
            modelURL,
            metadataURL
        );

        maxPredictions = model.getTotalClasses();

        // สร้างและเปิดกล้อง
        webcam = new tmPose.Webcam(
            CAMERA_SIZE,
            CAMERA_SIZE,
            FLIP_CAMERA
        );

        await webcam.setup();
        await webcam.play();

        setupCanvas();
        setupLabelContainer();

        isRunning = true;

        animationFrameId =
            window.requestAnimationFrame(loop);

        if (startButton) {
            startButton.textContent = "Camera Started";
        }
    } catch (error) {
        console.error("Initialization error:", error);

        stopCamera();

        alert(getReadableErrorMessage(error));

        if (startButton) {
            startButton.disabled = false;
            startButton.textContent = "Start Camera";
        }
    } finally {
        isStarting = false;
    }
}

/**
 * ตรวจสอบไลบรารีที่จำเป็น
 */
function checkRequiredLibraries() {
    if (typeof tf === "undefined") {
        throw new Error(
            "ไม่พบ TensorFlow.js กรุณาตรวจสอบ Script ใน index.html"
        );
    }

    if (typeof tmPose === "undefined") {
        throw new Error(
            "ไม่พบ Teachable Machine Pose Library"
        );
    }

    if (window.location.protocol === "file:") {
        throw new Error(
            "กรุณาเปิดเว็บไซต์ผ่าน Live Server หรือ localhost"
        );
    }
}

/**
 * ตั้งค่า Canvas
 */
function setupCanvas() {
    const canvas =
        document.getElementById("canvas");

    if (!canvas) {
        throw new Error(
            'ไม่พบ <canvas id="canvas">'
        );
    }

    canvas.width = CAMERA_SIZE;
    canvas.height = CAMERA_SIZE;

    ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error(
            "ไม่สามารถสร้าง Canvas Context ได้"
        );
    }
}

/**
 * สร้างพื้นที่แสดงผลการทำนาย
 */
function setupLabelContainer() {
    labelContainer =
        document.getElementById(
            "label-container"
        );

    if (!labelContainer) {
        throw new Error(
            'ไม่พบ <div id="label-container">'
        );
    }

    labelContainer.innerHTML = "";

    for (
        let index = 0;
        index < maxPredictions;
        index++
    ) {
        const label =
            document.createElement("div");

        label.textContent =
            `Class ${index + 1}: 0.00`;

        labelContainer.appendChild(label);
    }
}

/**
 * วนรับภาพจากกล้อง
 */
async function loop(timestamp) {
    if (!isRunning || !webcam) {
        return;
    }

    try {
        webcam.update();

        await predict(timestamp);

        if (isRunning) {
            animationFrameId =
                window.requestAnimationFrame(loop);
        }
    } catch (error) {
        console.error(
            "Prediction loop error:",
            error
        );

        stopCamera();

        alert(
            "เกิดข้อผิดพลาดระหว่างตรวจจับท่าทาง: " +
            error.message
        );
    }
}

/**
 * ประเมิน Pose และทำนาย Class
 */
async function predict(timestamp) {
    if (!model || !webcam) {
        return;
    }

    const poseResult =
        await model.estimatePose(
            webcam.canvas
        );

    const pose = poseResult.pose;
    const posenetOutput =
        poseResult.posenetOutput;

    const predictions =
        await model.predict(
            posenetOutput
        );

    displayPredictions(predictions);
    controlAFrameCamera(predictions, timestamp);
    drawPose(pose);
}

/**
 * แสดงผล Class และ Probability
 */
function displayPredictions(predictions) {
    for (
        let index = 0;
        index < maxPredictions;
        index++
    ) {
        const prediction =
            predictions[index];

        const label =
            labelContainer.children[index];

        if (!prediction || !label) {
            continue;
        }

        const percentage =
            prediction.probability * 100;

        label.textContent =
            `${prediction.className}: ` +
            `${percentage.toFixed(2)}%`;
    }
}

/**
 * อ่าน Probability ของ Class
 * ไม่สนใจตัวพิมพ์เล็กหรือพิมพ์ใหญ่
 */
function getClassProbability(
    predictions,
    targetClassName
) {
    const result = predictions.find(
        function (prediction) {
            return (
                prediction.className
                    .trim()
                    .toLowerCase() ===
                targetClassName
                    .trim()
                    .toLowerCase()
            );
        }
    );

    if (!result) {
        return 0;
    }

    return result.probability;
}

/**
 * ใช้ผลจากโมเดลควบคุมกล้องใน A-Frame
 */
function controlAFrameCamera(
    predictions,
    timestamp
) {
    if (
        timestamp - lastMoveTime <
        MOVE_DELAY
    ) {
        return;
    }

    const leftProbability =
        getClassProbability(
            predictions,
            "left"
        );

    const rightProbability =
        getClassProbability(
            predictions,
            "right"
        );

    const walkProbability =
        getClassProbability(
            predictions,
            "Walk"
        );

    const camera =
        document.querySelector(
            "a-entity[camera]"
        );

    if (!camera) {
        console.warn(
            "ไม่พบ A-Frame Camera"
        );

        return;
    }

    const currentPosition =
        camera.getAttribute("position");

    if (!currentPosition) {
        return;
    }

    let newPosition = null;

    if (
        leftProbability >
        MIN_CLASS_PROBABILITY
    ) {
        newPosition = {
            x: currentPosition.x - MOVE_STEP,
            y: currentPosition.y,
            z: currentPosition.z
        };
    } else if (
        rightProbability >
        MIN_CLASS_PROBABILITY
    ) {
        newPosition = {
            x: currentPosition.x + MOVE_STEP,
            y: currentPosition.y,
            z: currentPosition.z
        };
    } else if (
        walkProbability >
        MIN_CLASS_PROBABILITY
    ) {
        newPosition = {
            x: currentPosition.x,
            y: currentPosition.y,
            z: currentPosition.z - MOVE_STEP
        };
    }

    if (newPosition) {
        camera.setAttribute(
            "position",
            newPosition
        );

        lastMoveTime = timestamp;
    }
}

/**
 * วาดภาพจากกล้อง Keypoints และ Skeleton
 */
function drawPose(pose) {
    if (!webcam || !webcam.canvas || !ctx) {
        return;
    }

    ctx.clearRect(
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height
    );

    ctx.drawImage(
        webcam.canvas,
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height
    );

    if (!pose) {
        return;
    }

    tmPose.drawKeypoints(
        pose.keypoints,
        MIN_PART_CONFIDENCE,
        ctx
    );

    tmPose.drawSkeleton(
        pose.keypoints,
        MIN_PART_CONFIDENCE,
        ctx
    );
}

/**
 * หยุดกล้องและ Animation
 */
function stopCamera() {
    isRunning = false;

    if (animationFrameId !== null) {
        window.cancelAnimationFrame(
            animationFrameId
        );

        animationFrameId = null;
    }

    if (webcam) {
        try {
            webcam.stop();
        } catch (error) {
            console.warn(
                "Stop webcam warning:",
                error
            );
        }

        webcam = null;
    }

    if (ctx) {
        ctx.clearRect(
            0,
            0,
            ctx.canvas.width,
            ctx.canvas.height
        );
    }
}

/**
 * แปลง Error ให้เข้าใจง่าย
 */
function getReadableErrorMessage(error) {
    const errorName =
        error && error.name
            ? error.name
            : "";

    const errorMessage =
        error && error.message
            ? error.message
            : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

    if (
        errorName === "NotAllowedError" ||
        errorName === "PermissionDeniedError"
    ) {
        return (
            "ไม่ได้รับอนุญาตให้ใช้กล้อง " +
            "กรุณาอนุญาตสิทธิ์กล้องในเบราว์เซอร์"
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
            "กล้องอาจถูกโปรแกรมอื่นใช้งานอยู่"
        );
    }

    if (
        errorMessage.includes("model.json") ||
        errorMessage.includes("metadata.json") ||
        errorMessage.includes("Load failed") ||
        errorMessage.includes("fetch")
    ) {
        return (
            "โหลดโมเดลไม่สำเร็จ\n\n" +
            "กรุณาตรวจสอบว่าในโฟลเดอร์ my_model มีไฟล์:\n" +
            "- model.json\n" +
            "- metadata.json\n" +
            "- weights.bin\n\n" +
            "และเปิดเว็บไซต์ผ่าน Live Server หรือ localhost"
        );
    }

    return (
        "ไม่สามารถเริ่มระบบได้: " +
        errorMessage
    );
}

// ปิดกล้องเมื่อออกจากหน้าเว็บ
window.addEventListener(
    "beforeunload",
    stopCamera
);