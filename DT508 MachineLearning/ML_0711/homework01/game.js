const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

if (!videoElement || !canvasElement || !canvasCtx) {
    throw new Error(
        'ไม่พบ #input_video, #output_canvas หรือ Canvas Context'
    );
}

if (
    typeof Hands === 'undefined' ||
    typeof Camera === 'undefined'
) {
    throw new Error(
        'โหลด MediaPipe Hands หรือ Camera Utils ไม่สำเร็จ'
    );
}

/* =====================================================
   ตั้งค่าขนาดวัตถุ
===================================================== */

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 5;

const BALL_RADIUS = 6;

const BRICK_ROWS = 6;
const BRICK_COLUMNS = 10;
const BRICK_GAP = 6;
const BRICK_HEIGHT = 18;
const BRICK_TOP = 65;
const BRICK_SIDE_PADDING = 20;

const HAND_LOST_TIMEOUT = 500;
const AUTO_LAUNCH_DELAY = 800;

/* =====================================================
   ตัวแปรตรวจจับมือ
===================================================== */

let detectedHandCount = 0;

let targetPaddleX = 0;

let lastHandSeenTime = 0;
let firstHandSeenTime = 0;

let cameraStatus = 'กำลังเปิดกล้อง...';
let handStatus = 'ยังไม่พบมือ';

let isProcessingFrame = false;

/* =====================================================
   ตัวแปรเกม
===================================================== */

const paddle = {
    x: 0,
    y: 0,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT
};

const ball = {
    x: 0,
    y: 0,

    previousX: 0,
    previousY: 0,

    radius: BALL_RADIUS,

    vx: 4,
    vy: -4,

    stuckToPaddle: true
};

let bricks = [];

let score = 0;
let lives = 3;

/*
 * waiting  = รอเริ่มเกม
 * playing  = กำลังเล่น
 * won      = ชนะ
 * gameover = แพ้
 */
let gameState = 'waiting';

/* =====================================================
   ฟังก์ชันทั่วไป
===================================================== */

function clamp(value, minimum, maximum) {
    return Math.max(
        minimum,
        Math.min(maximum, value)
    );
}

/* =====================================================
   ตั้งค่า Canvas
===================================================== */

function resizeCanvas() {
    const rect =
        canvasElement.getBoundingClientRect();

    const oldWidth =
        canvasElement.width || 1;

    const oldHeight =
        canvasElement.height || 1;

    const newWidth = Math.max(
        1,
        Math.round(rect.width)
    );

    const newHeight = Math.max(
        1,
        Math.round(rect.height)
    );

    if (
        canvasElement.width === newWidth &&
        canvasElement.height === newHeight
    ) {
        return;
    }

    canvasElement.width = newWidth;
    canvasElement.height = newHeight;

    if (paddle.x === 0) {
        paddle.x =
            canvasElement.width / 2;

        targetPaddleX = paddle.x;
    } else {
        paddle.x =
            (paddle.x / oldWidth) *
            canvasElement.width;

        targetPaddleX =
            (targetPaddleX / oldWidth) *
            canvasElement.width;
    }

    paddle.y =
        canvasElement.height - 28;

    paddle.x = clamp(
        paddle.x,
        paddle.width / 2,
        canvasElement.width -
            paddle.width / 2
    );

    targetPaddleX = clamp(
        targetPaddleX,
        paddle.width / 2,
        canvasElement.width -
            paddle.width / 2
    );

    if (ball.stuckToPaddle) {
        placeBallOnPaddle();
    } else {
        ball.x =
            (ball.x / oldWidth) *
            canvasElement.width;

        ball.y =
            (ball.y / oldHeight) *
            canvasElement.height;
    }

    createBricks();
}

resizeCanvas();

window.addEventListener(
    'resize',
    resizeCanvas
);

if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver =
        new ResizeObserver(resizeCanvas);

    resizeObserver.observe(
        canvasElement
    );
}

/* =====================================================
   สร้างบล็อก
===================================================== */

function createBricks() {
    const usableWidth =
        canvasElement.width -
        BRICK_SIDE_PADDING * 2 -
        BRICK_GAP *
            (BRICK_COLUMNS - 1);

    const brickWidth =
        usableWidth / BRICK_COLUMNS;

    /*
     * เก็บสถานะเดิมไว้
     * เพื่อไม่ให้บล็อกกลับมาเมื่อปรับขนาดหน้าจอ
     */
    const oldBrickStates =
        bricks.map((brick) => brick.alive);

    bricks = [];

    for (
        let row = 0;
        row < BRICK_ROWS;
        row += 1
    ) {
        for (
            let column = 0;
            column < BRICK_COLUMNS;
            column += 1
        ) {
            const index =
                row * BRICK_COLUMNS +
                column;

            bricks.push({
                x:
                    BRICK_SIDE_PADDING +
                    column *
                        (
                            brickWidth +
                            BRICK_GAP
                        ),

                y:
                    BRICK_TOP +
                    row *
                        (
                            BRICK_HEIGHT +
                            BRICK_GAP
                        ),

                width: brickWidth,
                height: BRICK_HEIGHT,

                row,

                alive:
                    oldBrickStates[index] ===
                    undefined
                        ? true
                        : oldBrickStates[index]
            });
        }
    }
}

/* =====================================================
   ตั้งค่า MediaPipe
===================================================== */

const hands = new Hands({
    locateFile: (file) => {
        return (
            'https://cdn.jsdelivr.net/npm/' +
            `@mediapipe/hands/${file}`
        );
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,

    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

/* =====================================================
   รับผลตรวจจับมือ
===================================================== */

function onResults(results) {
    const handLandmarks =
        results.multiHandLandmarks || [];

    const currentTime =
        performance.now();

    detectedHandCount = Math.min(
        handLandmarks.length,
        2
    );

    if (detectedHandCount === 0) {
        handStatus = 'ยังไม่พบมือ';
        return;
    }

    /*
     * ใช้ Landmark หมายเลข 9
     * ซึ่งเป็นตำแหน่ง Middle Finger MCP
     */
    const handXPositions =
        handLandmarks
            .slice(0, 2)
            .map((landmarks) => {
                const handPoint =
                    landmarks[9];

                /*
                 * กล้องใน CSS ใช้ scaleX(-1)
                 * จึงกลับค่า X ให้ตรงกับภาพ
                 */
                return (
                    (1 - handPoint.x) *
                    canvasElement.width
                );
            });

    /*
     * พบมือ 1 ข้าง
     */
    if (detectedHandCount === 1) {
        targetPaddleX =
            handXPositions[0];

        handStatus =
            'พบมือ 1 ข้าง';
    }

    /*
     * พบมือ 2 ข้าง
     * ใช้ตำแหน่งกึ่งกลาง
     */
    if (detectedHandCount === 2) {
        targetPaddleX =
            (
                handXPositions[0] +
                handXPositions[1]
            ) / 2;

        handStatus =
            'พบมือ 2 ข้าง: ใช้ค่ากึ่งกลาง';
    }

    targetPaddleX = clamp(
        targetPaddleX,
        paddle.width / 2,
        canvasElement.width -
            paddle.width / 2
    );

    /*
     * เริ่มนับเวลาเมื่อพบมือใหม่
     */
    if (
        currentTime -
            lastHandSeenTime >
        HAND_LOST_TIMEOUT
    ) {
        firstHandSeenTime =
            currentTime;
    }

    lastHandSeenTime =
        currentTime;
}

/* =====================================================
   เปิดกล้อง
===================================================== */

const camera = new Camera(
    videoElement,
    {
        onFrame: async () => {
            if (
                isProcessingFrame ||
                videoElement.readyState < 2
            ) {
                return;
            }

            isProcessingFrame = true;

            try {
                await hands.send({
                    image: videoElement
                });
            } catch (error) {
                console.error(
                    'MediaPipe error:',
                    error
                );

                cameraStatus =
                    'ประมวลผลภาพไม่สำเร็จ';
            } finally {
                isProcessingFrame = false;
            }
        },

        width: 640,
        height: 480
    }
);

Promise.resolve(camera.start())
    .then(() => {
        cameraStatus =
            'กล้องพร้อมใช้งาน';
    })
    .catch((error) => {
        console.error(
            'Camera error:',
            error
        );

        cameraStatus =
            'เปิดกล้องไม่สำเร็จ';
    });

/* =====================================================
   วางลูกบอลบนแผ่นรับ
===================================================== */

function placeBallOnPaddle() {
    ball.x = paddle.x;

    ball.y =
        paddle.y -
        paddle.height / 2 -
        ball.radius -
        2;

    ball.previousX = ball.x;
    ball.previousY = ball.y;
}

/* =====================================================
   รีเซ็ตลูกบอล
===================================================== */

function resetBall() {
    ball.stuckToPaddle = true;

    ball.vx =
        Math.random() < 0.5
            ? -4
            : 4;

    ball.vy = -4;

    gameState = 'waiting';

    firstHandSeenTime =
        performance.now();

    placeBallOnPaddle();
}

/* =====================================================
   ปล่อยลูกบอล
===================================================== */

function launchBall() {
    if (!ball.stuckToPaddle) {
        return;
    }

    ball.stuckToPaddle = false;
    gameState = 'playing';

    const direction =
        Math.random() < 0.5
            ? -1
            : 1;

    ball.vx = 3.5 * direction;
    ball.vy = -4.5;
}

/* =====================================================
   เริ่มเกมใหม่
===================================================== */

function restartGame() {
    score = 0;
    lives = 3;

    gameState = 'waiting';

    bricks.forEach((brick) => {
        brick.alive = true;
    });

    resetBall();
}

/* =====================================================
   อัปเดตตำแหน่งแผ่นรับ
===================================================== */

function updatePaddle(currentTime) {
    const handIsActive =
        detectedHandCount > 0 &&
        currentTime -
            lastHandSeenTime <=
            HAND_LOST_TIMEOUT;

    if (!handIsActive) {
        detectedHandCount = 0;
        handStatus = 'ยังไม่พบมือ';
        return;
    }

    /*
     * Smoothing ลดการสั่น
     * ของค่าพิกัดมือจากกล้อง
     */
    paddle.x +=
        (
            targetPaddleX -
            paddle.x
        ) * 0.28;

    paddle.x = clamp(
        paddle.x,
        paddle.width / 2,
        canvasElement.width -
            paddle.width / 2
    );

    /*
     * เมื่อตรวจพบมือครบ 0.8 วินาที
     * ให้เริ่มเกมอัตโนมัติ
     */
    if (
        ball.stuckToPaddle &&
        currentTime -
            firstHandSeenTime >=
            AUTO_LAUNCH_DELAY &&
        (
            gameState === 'waiting'
        )
    ) {
        launchBall();
    }
}

/* =====================================================
   ตรวจลูกบอลชนแผ่นรับ
===================================================== */

function checkPaddleCollision() {
    /*
     * ตรวจเฉพาะตอนลูกบอลกำลังลง
     */
    if (ball.vy <= 0) {
        return;
    }

    const paddleLeft =
        paddle.x -
        paddle.width / 2;

    const paddleRight =
        paddle.x +
        paddle.width / 2;

    const paddleTop =
        paddle.y -
        paddle.height / 2;

    const paddleBottom =
        paddle.y +
        paddle.height / 2;

    const hitPaddle =
        ball.x + ball.radius >=
            paddleLeft &&
        ball.x - ball.radius <=
            paddleRight &&
        ball.y + ball.radius >=
            paddleTop &&
        ball.y - ball.radius <=
            paddleBottom;

    if (!hitPaddle) {
        return;
    }

    /*
     * ย้ายลูกบอลขึ้นเหนือแผ่นรับ
     * ป้องกันลูกบอลติดอยู่ภายในแผ่น
     */
    ball.y =
        paddleTop -
        ball.radius -
        0.1;

    /*
     * ตำแหน่งที่ชนแผ่นรับ
     * มีผลต่อทิศทางการเด้ง
     *
     * -1 = ขอบซ้าย
     *  0 = กึ่งกลาง
     *  1 = ขอบขวา
     */
    const hitPosition = clamp(
        (
            ball.x -
            paddle.x
        ) /
            (
                paddle.width / 2
            ),
        -1,
        1
    );

    /*
     * เพิ่มความเร็วเล็กน้อย
     * ทุกครั้งที่เด้งจากแผ่นรับ
     */
    const speed = Math.min(
        8,
        Math.max(
            5.5,
            Math.hypot(
                ball.vx,
                ball.vy
            ) + 0.08
        )
    );

    ball.vx =
        hitPosition *
        speed *
        0.9;

    const verticalSpeedSquared =
        Math.max(
            4,
            speed * speed -
                ball.vx * ball.vx
        );

    ball.vy =
        -Math.sqrt(
            verticalSpeedSquared
        );

    /*
     * ป้องกันลูกเด้งขึ้นตรงเกินไป
     */
    if (Math.abs(ball.vx) < 1.2) {
        ball.vx =
            ball.vx < 0
                ? -1.2
                : 1.2;
    }
}

/* =====================================================
   ตรวจลูกบอลชนบล็อก
===================================================== */

function checkBrickCollisions() {
    for (const brick of bricks) {
        if (!brick.alive) {
            continue;
        }

        /*
         * หาจุดบนบล็อกที่อยู่ใกล้
         * จุดกึ่งกลางลูกบอลมากที่สุด
         */
        const nearestX = clamp(
            ball.x,
            brick.x,
            brick.x +
                brick.width
        );

        const nearestY = clamp(
            ball.y,
            brick.y,
            brick.y +
                brick.height
        );

        const distanceX =
            ball.x - nearestX;

        const distanceY =
            ball.y - nearestY;

        const collision =
            distanceX * distanceX +
                distanceY * distanceY <=
            ball.radius * ball.radius;

        if (!collision) {
            continue;
        }

        brick.alive = false;
        score += 10;

        /*
         * ตรวจว่าลูกเข้าชนจากด้านข้าง
         * หรือด้านบน/ด้านล่าง
         */
        const previousOutsideLeft =
            ball.previousX +
                ball.radius <=
            brick.x;

        const previousOutsideRight =
            ball.previousX -
                ball.radius >=
            brick.x +
                brick.width;

        if (
            previousOutsideLeft ||
            previousOutsideRight
        ) {
            ball.vx *= -1;
        } else {
            ball.vy *= -1;
        }

        const hasRemainingBricks =
            bricks.some(
                (currentBrick) =>
                    currentBrick.alive
            );

        if (!hasRemainingBricks) {
            gameState = 'won';
            ball.stuckToPaddle = true;
        }

        /*
         * ให้หนึ่งเฟรมชนได้หนึ่งบล็อก
         * ป้องกันการกลับทิศซ้ำ
         */
        break;
    }
}

/* =====================================================
   อัปเดตลูกบอล
===================================================== */

function updateBall() {
    if (
        gameState === 'won' ||
        gameState === 'gameover'
    ) {
        placeBallOnPaddle();
        return;
    }

    if (ball.stuckToPaddle) {
        placeBallOnPaddle();
        return;
    }

    ball.previousX = ball.x;
    ball.previousY = ball.y;

    ball.x += ball.vx;
    ball.y += ball.vy;

    /*
     * ชนกำแพงซ้าย
     */
    if (
        ball.x -
            ball.radius <=
        0
    ) {
        ball.x = ball.radius;
        ball.vx =
            Math.abs(ball.vx);
    }

    /*
     * ชนกำแพงขวา
     */
    if (
        ball.x +
            ball.radius >=
        canvasElement.width
    ) {
        ball.x =
            canvasElement.width -
            ball.radius;

        ball.vx =
            -Math.abs(ball.vx);
    }

    /*
     * ชนกำแพงบน
     */
    if (
        ball.y -
            ball.radius <=
        0
    ) {
        ball.y = ball.radius;
        ball.vy =
            Math.abs(ball.vy);
    }

    checkPaddleCollision();
    checkBrickCollisions();

    /*
     * ลูกบอลตกออกจากด้านล่าง
     */
    if (
        ball.y -
            ball.radius >
        canvasElement.height
    ) {
        lives -= 1;

        if (lives <= 0) {
            lives = 0;

            gameState =
                'gameover';

            ball.stuckToPaddle =
                true;

            placeBallOnPaddle();
        } else {
            resetBall();
        }
    }
}

/* =====================================================
   วาดพื้นหลัง
===================================================== */

function drawBackground() {
    const gradient =
        canvasCtx.createLinearGradient(
            0,
            0,
            0,
            canvasElement.height
        );

    gradient.addColorStop(
        0,
        '#111827'
    );

    gradient.addColorStop(
        1,
        '#030712'
    );

    canvasCtx.fillStyle =
        gradient;

    canvasCtx.fillRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );
}

/* =====================================================
   วาดบล็อก
===================================================== */

function drawBricks() {
    const rowColors = [
        '#ef4444',
        '#f97316',
        '#eab308',
        '#22c55e',
        '#06b6d4',
        '#8b5cf6'
    ];

    for (const brick of bricks) {
        if (!brick.alive) {
            continue;
        }

        canvasCtx.fillStyle =
            rowColors[
                brick.row %
                    rowColors.length
            ];

        canvasCtx.fillRect(
            brick.x,
            brick.y,
            brick.width,
            brick.height
        );

        canvasCtx.strokeStyle =
            'rgba(255, 255, 255, 0.35)';

        canvasCtx.lineWidth = 1;

        canvasCtx.strokeRect(
            brick.x + 0.5,
            brick.y + 0.5,
            brick.width - 1,
            brick.height - 1
        );
    }
}

/* =====================================================
   วาดแผ่นรับ
===================================================== */

function drawPaddle() {
    canvasCtx.fillStyle =
        '#f8fafc';

    canvasCtx.fillRect(
        paddle.x -
            paddle.width / 2,

        paddle.y -
            paddle.height / 2,

        paddle.width,
        paddle.height
    );
}

/* =====================================================
   วาดลูกบอล
===================================================== */

function drawBall() {
    canvasCtx.beginPath();

    canvasCtx.arc(
        ball.x,
        ball.y,
        ball.radius,
        0,
        Math.PI * 2
    );

    canvasCtx.fillStyle =
        '#fde047';

    canvasCtx.fill();

    canvasCtx.strokeStyle =
        '#fef9c3';

    canvasCtx.lineWidth = 1;
    canvasCtx.stroke();
}

/* =====================================================
   แสดงคะแนนและสถานะมือ
===================================================== */

function drawHud() {
    canvasCtx.save();

    canvasCtx.font =
        '14px Arial';

    canvasCtx.textBaseline =
        'top';

    canvasCtx.fillStyle =
        '#f8fafc';

    canvasCtx.textAlign =
        'left';

    canvasCtx.fillText(
        `คะแนน: ${score}`,
        12,
        10
    );

    canvasCtx.textAlign =
        'center';

    canvasCtx.fillText(
        `ชีวิต: ${lives}`,
        canvasElement.width / 2,
        10
    );

    canvasCtx.textAlign =
        'right';

    canvasCtx.fillText(
        `มือ: ${detectedHandCount}`,
        canvasElement.width - 12,
        10
    );

    canvasCtx.font =
        '12px Arial';

    canvasCtx.fillStyle =
        '#cbd5e1';

    canvasCtx.textAlign =
        'left';

    canvasCtx.fillText(
        cameraStatus,
        12,
        30
    );

    canvasCtx.fillText(
        handStatus,
        12,
        45
    );

    canvasCtx.restore();
}

/* =====================================================
   แสดงข้อความกลางหน้าจอ
===================================================== */

function drawCenterMessage() {
    let title = '';
    let subtitle = '';

    if (gameState === 'waiting') {
        if (detectedHandCount > 0) {
            title =
                'เตรียมปล่อยลูกบอล';

            subtitle =
                'ระบบจะเริ่มอัตโนมัติ';
        } else {
            title =
                'ยกมือ 1 หรือ 2 ข้างเพื่อเริ่ม';

            subtitle =
                'มือเดียวใช้ตำแหน่งมือนั้น • สองมือใช้ค่ากึ่งกลาง';
        }
    }

    if (gameState === 'won') {
        title =
            'คุณทำลายบล็อกครบแล้ว!';

        subtitle =
            'กด R หรือคลิก Canvas เพื่อเริ่มใหม่';
    }

    if (gameState === 'gameover') {
        title = 'Game Over';

        subtitle =
            'กด R หรือคลิก Canvas เพื่อเริ่มใหม่';
    }

    if (!title) {
        return;
    }

    canvasCtx.save();

    canvasCtx.fillStyle =
        'rgba(3, 7, 18, 0.72)';

    canvasCtx.fillRect(
        0,
        canvasElement.height / 2 -
            46,

        canvasElement.width,
        92
    );

    canvasCtx.textAlign =
        'center';

    canvasCtx.textBaseline =
        'middle';

    canvasCtx.fillStyle =
        '#f8fafc';

    canvasCtx.font =
        'bold 22px Arial';

    canvasCtx.fillText(
        title,
        canvasElement.width / 2,
        canvasElement.height / 2 -
            10
    );

    canvasCtx.fillStyle =
        '#cbd5e1';

    canvasCtx.font =
        '13px Arial';

    canvasCtx.fillText(
        subtitle,
        canvasElement.width / 2,
        canvasElement.height / 2 +
            20
    );

    canvasCtx.restore();
}

/* =====================================================
   Game Loop
===================================================== */

function gameLoop(currentTime) {
    resizeCanvas();

    updatePaddle(currentTime);
    updateBall();

    drawBackground();
    drawBricks();
    drawPaddle();
    drawBall();
    drawHud();
    drawCenterMessage();

    requestAnimationFrame(
        gameLoop
    );
}

/* =====================================================
   ปุ่มสำหรับทดสอบ
===================================================== */

window.addEventListener(
    'keydown',
    (event) => {
        /*
         * กด R เพื่อเริ่มใหม่
         */
        if (
            event.code === 'KeyR' &&
            (
                gameState === 'won' ||
                gameState ===
                    'gameover'
            )
        ) {
            restartGame();
        }

        /*
         * กด Space เพื่อทดสอบปล่อยบอล
         */
        if (
            event.code === 'Space' &&
            ball.stuckToPaddle &&
            gameState === 'waiting'
        ) {
            event.preventDefault();
            launchBall();
        }
    }
);

canvasElement.addEventListener(
    'click',
    () => {
        if (
            gameState === 'won' ||
            gameState === 'gameover'
        ) {
            restartGame();
        }
    }
);

/* =====================================================
   เริ่มเกม
===================================================== */

createBricks();
resetBall();

requestAnimationFrame(
    gameLoop
);