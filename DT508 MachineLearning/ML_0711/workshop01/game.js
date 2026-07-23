const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');

if (!videoElement || !canvasElement) {
    throw new Error('ไม่พบ #input_video หรือ #output_canvas');
}

const canvasCtx = canvasElement.getContext('2d');

if (!canvasCtx) {
    throw new Error('ไม่สามารถสร้าง Canvas 2D Context ได้');
}

/* =========================
   ตัวแปรผู้เล่น
========================= */

const player = {
    x: 0,
    y: 0,
    size: 40
};

let isPlayerPositionInitialized = false;

/* =========================
   ตั้งค่า Canvas
========================= */

function resizeCanvas() {
    const rect = canvasElement.getBoundingClientRect();

    const previousWidth = canvasElement.width;
    const previousHeight = canvasElement.height;

    // ใช้ขนาดจริงที่ Canvas แสดงบนหน้าจอ
    canvasElement.width = Math.max(
        1,
        Math.round(rect.width)
    );

    canvasElement.height = Math.max(
        1,
        Math.round(rect.height)
    );

    // กำหนดตำแหน่งเริ่มต้นของผู้เล่น
    if (!isPlayerPositionInitialized) {
        player.x = canvasElement.width / 2;
        player.y = canvasElement.height - 100;

        isPlayerPositionInitialized = true;
        return;
    }

    // รักษาตำแหน่งโดยประมาณเมื่อปรับขนาดหน้าจอ
    if (previousWidth > 0 && previousHeight > 0) {
        player.x =
            (player.x / previousWidth) *
            canvasElement.width;

        player.y =
            (player.y / previousHeight) *
            canvasElement.height;
    }

    // ป้องกันยานออกนอก Canvas
    player.x = Math.max(
        player.size / 2,
        Math.min(
            canvasElement.width - player.size / 2,
            player.x
        )
    );

    player.y = Math.max(
        player.size / 2,
        Math.min(
            canvasElement.height - player.size / 2,
            player.y
        )
    );
}

resizeCanvas();

window.addEventListener(
    'resize',
    resizeCanvas
);

/* =========================
   รูปภาพผู้เล่น
========================= */

const playerImage = new Image();

playerImage.src = 'images/rocket.png';

playerImage.onerror = () => {
    console.error(
        'ไม่สามารถโหลดรูป images/rocket.png ได้'
    );
};

/* =========================
   ตัวแปรตรวจจับมือ
========================= */

let handsDistance = 0;
let isTwoHands = false;

/* =========================
   ตั้งค่า MediaPipe Hands
========================= */

if (
    typeof Hands === 'undefined' ||
    typeof Camera === 'undefined'
) {
    throw new Error(
        'โหลด MediaPipe ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต'
    );
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

/* =========================
   รับผลลัพธ์การตรวจจับมือ
========================= */

function onResults(results) {
    const detectedHands =
        results.multiHandLandmarks;

    if (
        detectedHands &&
        detectedHands.length === 2
    ) {
        isTwoHands = true;

        // Landmark หมายเลข 9
        // คือบริเวณโคนนิ้วกลาง
        const hand1 = detectedHands[0][9];
        const hand2 = detectedHands[1][9];

        /*
         * วิดีโอถูกกลับด้านด้วย CSS
         * จึงต้องกลับค่า x ของ MediaPipe
         * เพื่อให้ยานเคลื่อนไหวตรงกับภาพที่เห็น
         */
        const x1 =
            (1 - hand1.x) *
            canvasElement.width;

        const y1 =
            hand1.y *
            canvasElement.height;

        const x2 =
            (1 - hand2.x) *
            canvasElement.width;

        const y2 =
            hand2.y *
            canvasElement.height;

        // หาจุดกึ่งกลางระหว่างมือทั้งสอง
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        // จำกัดตำแหน่งไม่ให้ยานออกนอก Canvas
        player.x = Math.max(
            player.size / 2,
            Math.min(
                canvasElement.width -
                    player.size / 2,
                centerX
            )
        );

        player.y = Math.max(
            player.size / 2,
            Math.min(
                canvasElement.height -
                    player.size / 2,
                centerY
            )
        );

        // คำนวณระยะห่างระหว่างมือ
        handsDistance = Math.hypot(
            x2 - x1,
            y2 - y1
        );
    } else {
        isTwoHands = false;
        handsDistance = 0;
    }
}

/* =========================
   ตัวแปรเกม
========================= */

const bullets = [];
const enemies = [];

let boss = null;
let lastShotTime = 0;
let gameStartTime = 0;
let isGameOver = false;

// ระยะมือที่ใช้สั่งยิง
const shootThreshold = 150;

// ระยะเวลาระหว่างกระสุนแต่ละนัด
const shootCooldown = 200;

/* =========================
   จบเกม
========================= */

function endGame(message) {
    if (isGameOver) {
        return;
    }

    isGameOver = true;

    // ให้ Canvas วาดเฟรมล่าสุดก่อนแสดง Alert
    setTimeout(() => {
        alert(message);
    }, 0);
}

/* =========================
   วาดผู้เล่น
========================= */

function drawPlayer() {
    if (
        playerImage.complete &&
        playerImage.naturalWidth > 0
    ) {
        canvasCtx.drawImage(
            playerImage,
            player.x - player.size / 2,
            player.y - player.size / 2,
            player.size,
            player.size
        );
    } else {
        /*
         * แสดงสี่เหลี่ยมสีน้ำเงินแทน
         * หากยังโหลดรูปยานไม่ได้
         */
        canvasCtx.fillStyle =
            'deepskyblue';

        canvasCtx.fillRect(
            player.x - player.size / 2,
            player.y - player.size / 2,
            player.size,
            player.size
        );
    }
}

/* =========================
   ระบบยิงของผู้เล่น
========================= */

function updatePlayerShooting(currentTime) {
    const canShoot =
        isTwoHands &&
        handsDistance > shootThreshold &&
        currentTime - lastShotTime >=
            shootCooldown;

    if (!canShoot) {
        return;
    }

    bullets.push({
        x: player.x,
        y: player.y - player.size / 2,
        speed: 10,
        width: 4,
        height: 15
    });

    lastShotTime = currentTime;
}

/* =========================
   อัปเดตกระสุนผู้เล่น
========================= */

function updatePlayerBullets() {
    canvasCtx.fillStyle = 'yellow';

    for (
        let i = bullets.length - 1;
        i >= 0;
        i--
    ) {
        const bullet = bullets[i];

        // เคลื่อนกระสุนขึ้นด้านบน
        bullet.y -= bullet.speed;

        canvasCtx.fillRect(
            bullet.x - bullet.width / 2,
            bullet.y,
            bullet.width,
            bullet.height
        );

        // ลบกระสุนเมื่อออกจากหน้าจอ
        if (
            bullet.y + bullet.height < 0
        ) {
            bullets.splice(i, 1);
        }
    }
}

/* =========================
   ระบบศัตรูทั่วไป
========================= */

function updateEnemies() {
    // สุ่มสร้างศัตรู
    if (Math.random() < 0.02) {
        const enemySize = 30;

        enemies.push({
            x:
                enemySize / 2 +
                Math.random() *
                    (
                        canvasElement.width -
                        enemySize
                    ),
            y: -enemySize,
            speed: 3,
            size: enemySize
        });
    }

    canvasCtx.fillStyle = 'pink';

    for (
        let i = enemies.length - 1;
        i >= 0;
        i--
    ) {
        const enemy = enemies[i];

        // เคลื่อนศัตรูลง
        enemy.y += enemy.speed;

        canvasCtx.fillRect(
            enemy.x - enemy.size / 2,
            enemy.y - enemy.size / 2,
            enemy.size,
            enemy.size
        );

        /* -------------------------
           ศัตรูชนผู้เล่น
        ------------------------- */

        const playerCollisionDistance =
            player.size / 2 +
            enemy.size / 2;

        const enemyHitPlayer =
            Math.hypot(
                enemy.x - player.x,
                enemy.y - player.y
            ) <
            playerCollisionDistance;

        if (enemyHitPlayer) {
            endGame('Game Over!');
            return;
        }

        let enemyDestroyed = false;

        /* -------------------------
           กระสุนชนศัตรู
        ------------------------- */

        for (
            let j = bullets.length - 1;
            j >= 0;
            j--
        ) {
            const bullet = bullets[j];

            const hitEnemy =
                bullet.x +
                    bullet.width / 2 >
                    enemy.x -
                        enemy.size / 2 &&
                bullet.x -
                    bullet.width / 2 <
                    enemy.x +
                        enemy.size / 2 &&
                bullet.y +
                    bullet.height >
                    enemy.y -
                        enemy.size / 2 &&
                bullet.y <
                    enemy.y +
                        enemy.size / 2;

            if (hitEnemy) {
                enemies.splice(i, 1);
                bullets.splice(j, 1);

                enemyDestroyed = true;
                break;
            }
        }

        /*
         * ถ้าศัตรูถูกทำลายแล้ว
         * ไม่ตรวจเงื่อนไขอื่นต่อ
         */
        if (enemyDestroyed) {
            continue;
        }

        // ลบศัตรูเมื่อออกจากหน้าจอ
        if (
            enemy.y - enemy.size / 2 >
            canvasElement.height
        ) {
            enemies.splice(i, 1);
        }
    }
}

/* =========================
   สร้างบอส
========================= */

function createBoss() {
    boss = {
        x: canvasElement.width / 2,
        y: 100,
        hp: 100,
        maxHp: 100,
        size: 80,
        bullets: []
    };
}

/* =========================
   วาดบอส
========================= */

function drawBoss() {
    if (!boss) {
        return;
    }

    canvasCtx.fillStyle = 'red';

    canvasCtx.fillRect(
        boss.x - boss.size / 2,
        boss.y - boss.size / 2,
        boss.size,
        boss.size
    );

    // แสดง HP ของบอส
    canvasCtx.fillStyle = 'white';
    canvasCtx.font = '18px Arial';
    canvasCtx.textAlign = 'center';

    canvasCtx.fillText(
        `Boss HP: ${boss.hp}`,
        boss.x,
        boss.y -
            boss.size / 2 -
            15
    );
}

/* =========================
   ระบบกระสุนบอส
========================= */

function updateBossBullets() {
    if (!boss) {
        return;
    }

    // สุ่มยิงกระสุนแบบกระจาย
    if (Math.random() < 0.05) {
        for (
            let angle = -2;
            angle <= 2;
            angle++
        ) {
            boss.bullets.push({
                x: boss.x,
                y:
                    boss.y +
                    boss.size / 2,
                vx: angle * 2,
                vy: 5,
                radius: 5
            });
        }
    }

    canvasCtx.fillStyle = 'orange';

    for (
        let i =
            boss.bullets.length - 1;
        i >= 0;
        i--
    ) {
        const bossBullet =
            boss.bullets[i];

        bossBullet.x += bossBullet.vx;
        bossBullet.y += bossBullet.vy;

        canvasCtx.beginPath();

        canvasCtx.arc(
            bossBullet.x,
            bossBullet.y,
            bossBullet.radius,
            0,
            Math.PI * 2
        );

        canvasCtx.fill();

        /* -------------------------
           กระสุนบอสชนผู้เล่น
        ------------------------- */

        const collisionDistance =
            player.size / 2 +
            bossBullet.radius;

        const bulletHitPlayer =
            Math.hypot(
                bossBullet.x - player.x,
                bossBullet.y - player.y
            ) <
            collisionDistance;

        if (bulletHitPlayer) {
            endGame('Game Over!');
            return;
        }

        /* -------------------------
           ลบกระสุนเมื่อออกหน้าจอ
        ------------------------- */

        const isOutsideCanvas =
            bossBullet.y -
                bossBullet.radius >
                canvasElement.height ||
            bossBullet.x +
                bossBullet.radius <
                0 ||
            bossBullet.x -
                bossBullet.radius >
                canvasElement.width;

        if (isOutsideCanvas) {
            boss.bullets.splice(i, 1);
        }
    }
}

/* =========================
   กระสุนผู้เล่นชนบอส
========================= */

function checkBossCollision() {
    if (!boss) {
        return;
    }

    for (
        let i = bullets.length - 1;
        i >= 0;
        i--
    ) {
        const bullet = bullets[i];

        const hitBoss =
            bullet.x +
                bullet.width / 2 >
                boss.x -
                    boss.size / 2 &&
            bullet.x -
                bullet.width / 2 <
                boss.x +
                    boss.size / 2 &&
            bullet.y +
                bullet.height >
                boss.y -
                    boss.size / 2 &&
            bullet.y <
                boss.y +
                    boss.size / 2;

        if (!hitBoss) {
            continue;
        }

        boss.hp -= 1;
        bullets.splice(i, 1);

        if (boss.hp <= 0) {
            boss.hp = 0;
            endGame('You Win!');
            return;
        }
    }
}

/* =========================
   Game Loop
========================= */

function gameLoop(currentTime) {
    if (isGameOver) {
        return;
    }

    const elapsedTime =
        (
            currentTime -
            gameStartTime
        ) / 1000;

    // ล้างหน้าจอและวาดพื้นหลัง
    canvasCtx.fillStyle = '#111';

    canvasCtx.fillRect(
        0,
        0,
        canvasElement.width,
        canvasElement.height
    );

    // อัปเดตระบบยิง
    updatePlayerShooting(
        currentTime
    );

    // อัปเดตกระสุนผู้เล่น
    updatePlayerBullets();

    // สร้างบอสเมื่อครบ 90 วินาที
    if (
        elapsedTime >= 90 &&
        !boss
    ) {
        createBoss();

        // ล้างศัตรูทั่วไปเมื่อบอสปรากฏ
        enemies.length = 0;
    }

    if (boss) {
        drawBoss();
        updateBossBullets();

        if (isGameOver) {
            return;
        }

        checkBossCollision();
    } else {
        updateEnemies();
    }

    if (isGameOver) {
        return;
    }

    /*
     * วาดผู้เล่นทีหลังสุด
     * เพื่อไม่ให้ยานถูกวัตถุอื่นบัง
     */
    drawPlayer();

    requestAnimationFrame(
        gameLoop
    );
}

/* =========================
   เริ่มกล้องและเริ่มเกม
========================= */

const camera = new Camera(
    videoElement,
    {
        onFrame: async () => {
            await hands.send({
                image: videoElement
            });
        },
        width: 640,
        height: 480
    }
);

Promise.resolve(
    camera.start()
)
    .then(() => {
        /*
         * เริ่มจับเวลาเกมหลังจาก
         * เปิดกล้องสำเร็จแล้ว
         */
        gameStartTime =
            performance.now();

        requestAnimationFrame(
            gameLoop
        );
    })
    .catch((error) => {
        console.error(
            'ไม่สามารถเปิดกล้องได้:',
            error
        );

        alert(
            'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง'
        );
    });