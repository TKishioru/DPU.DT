import { drawDinosaur } from "./draw-dinosaur.js";
import { drawBird } from "./draw-bird.js";

const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const highScoreValue = document.getElementById("highScoreValue");
const speedValue = document.getElementById("speedValue");

const startOverlay = document.getElementById("startOverlay");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownValue = document.getElementById("countdownValue");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreValue = document.getElementById("finalScoreValue");

const startGameButton = document.getElementById("startGameButton");
const pauseGameButton = document.getElementById("pauseGameButton");
const resumeGameButton = document.getElementById("resumeGameButton");
const endGameButton = document.getElementById("endGameButton");
const restartGameButton = document.getElementById("restartGameButton");

/* =========================================================
   GAME STATES
========================================================= */

export const GAME_STATE = Object.freeze({
  IDLE: "idle",
  COUNTDOWN: "countdown",
  PLAYING: "playing",
  PAUSED: "paused",
  GAME_OVER: "game_over",
});

/*
  กดปุ่มเริ่มเกมแล้วนับถอยหลัง 5 วินาที
  ก่อนเริ่มการเคลื่อนไหวของเกมจริง
*/
const COUNTDOWN_SECONDS = 5;

let gameState = GAME_STATE.IDLE;

/*
  ฟังก์ชันเหล่านี้จะถูกส่งมาจาก pose-ml.js
  เพื่อให้ระบบเกมตรวจว่ากล้องและ Calibration พร้อมหรือไม่
*/
let canStartGameCallback = () => false;
let bodyFoundCallback = () => true;
let statusCallback = () => {};
let poseNameCallback = () => "ยืน";

/* =========================================================
   GAME DATA
========================================================= */

const game = {
  width: gameCanvas.width,
  height: gameCanvas.height,

  groundY: 410,

  baseSpeed: 7,
  speed: 7,

  score: 0,
  highScore: 0,

  frameId: null,
  lastFrameTime: 0,

  elapsedSinceObstacle: 0,
  nextObstacleDelay: 1500,

  groundOffset: 0,
  obstacles: [],
};

/* =========================================================
   DINOSAUR DATA
========================================================= */

const dinosaur = {
  x: 125,
  y: 0,

  width: 85,
  height: 70,

  standingHeight: 70,
  crouchingHeight: 40,

  velocityY: 0,
  gravity: 2200,
  jumpForce: -850,

  isJumping: false,
  isCrouching: false,

  runFrame: 0,
  runFrameTimer: 0,
};

/* =========================================================
   INITIAL SETUP
========================================================= */

export function initializeCanvasGame(options = {}) {
  canStartGameCallback = options.canStartGame ?? canStartGameCallback;

  bodyFoundCallback = options.isBodyFound ?? bodyFoundCallback;

  statusCallback = options.onStatusChange ?? statusCallback;

  poseNameCallback = options.getCurrentPoseName ?? poseNameCallback;

  startGameButton.addEventListener("click", startGame);
  pauseGameButton.addEventListener("click", pauseGame);
  resumeGameButton.addEventListener("click", resumeGame);
  endGameButton.addEventListener("click", endGame);
  restartGameButton.addEventListener("click", restartGame);

  setupKeyboardControls();

  resetDinosaur();
  drawGame();

  startGameButton.disabled = true;
  pauseGameButton.disabled = true;
  endGameButton.disabled = true;
}

/* =========================================================
   PUBLIC FUNCTIONS
   เรียกจาก pose-ml.js
========================================================= */

export function enableStartGame(enabled) {
  const gameIsBusy =
    gameState === GAME_STATE.COUNTDOWN ||
    gameState === GAME_STATE.PLAYING ||
    gameState === GAME_STATE.PAUSED;

  startGameButton.disabled = gameIsBusy || !enabled;
}

export function getGameState() {
  return gameState;
}

export function isGamePlaying() {
  return gameState === GAME_STATE.PLAYING;
}

export function applyPoseToGame(pose) {
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  if (pose === "jump") {
    triggerJump();
    setCrouch(false);
    return;
  }

  if (pose === "crouch") {
    if (!dinosaur.isJumping) {
      setCrouch(true);
    }

    return;
  }

  setCrouch(false);
}

export function pauseGameBecausePoseLost() {
  if (gameState === GAME_STATE.PLAYING) {
    pauseGame();
  }
}

/* =========================================================
   START, PAUSE, RESUME, END
========================================================= */

export async function startGame() {
  if (
    gameState === GAME_STATE.PLAYING ||
    gameState === GAME_STATE.COUNTDOWN
  ) {
    return;
  }

  if (!canStartGameCallback()) {
    alert(
      "ยังไม่สามารถเริ่มเกมได้\n\n" +
        "กรุณาเปิดกล้อง ให้ระบบตรวจพบร่างกาย " +
        "และปรับเส้นอ้างอิงให้เรียบร้อยก่อน",
    );

    return;
  }

  resetGame();

  gameState = GAME_STATE.COUNTDOWN;

  startOverlay?.classList.add("hidden");
  pauseOverlay?.classList.add("hidden");
  gameOverOverlay?.classList.add("hidden");
  countdownOverlay?.classList.remove("hidden");

  startGameButton.disabled = true;
  pauseGameButton.disabled = true;
  endGameButton.disabled = true;

  for (let count = COUNTDOWN_SECONDS; count >= 1; count -= 1) {
    if (gameState !== GAME_STATE.COUNTDOWN) {
      return;
    }

    if (!canStartGameCallback() || !bodyFoundCallback()) {
      cancelCountdownBecauseBodyLost();
      return;
    }

    countdownValue.textContent = String(count);
    statusCallback(`เริ่มเกมใน ${count} วินาที`, "waiting");

    await wait(1000);
  }

  if (
    gameState !== GAME_STATE.COUNTDOWN ||
    !canStartGameCallback() ||
    !bodyFoundCallback()
  ) {
    cancelCountdownBecauseBodyLost();
    return;
  }

  countdownValue.textContent = "GO!";
  statusCallback("เริ่มเกม", "playing");

  await wait(500);

  if (gameState !== GAME_STATE.COUNTDOWN) {
    return;
  }

  gameState = GAME_STATE.PLAYING;
  game.lastFrameTime = performance.now();

  countdownOverlay?.classList.add("hidden");
  countdownValue.textContent = String(COUNTDOWN_SECONDS);

  pauseGameButton.disabled = false;
  endGameButton.disabled = false;

  statusCallback("กำลังเล่น", "playing");

  game.frameId = requestAnimationFrame(gameLoop);
}

function cancelCountdownBecauseBodyLost() {
  if (gameState !== GAME_STATE.COUNTDOWN) {
    return;
  }

  gameState = GAME_STATE.IDLE;

  countdownOverlay?.classList.add("hidden");
  countdownValue.textContent = String(COUNTDOWN_SECONDS);
  startOverlay?.classList.remove("hidden");

  startGameButton.disabled = false;
  pauseGameButton.disabled = true;
  endGameButton.disabled = true;

  statusCallback(
    "ไม่พบร่างกาย กรุณายืนในเฟรมแล้วกดเริ่มเกมอีกครั้ง",
    "waiting",
  );

  drawGame();
}

export function pauseGame() {
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  gameState = GAME_STATE.PAUSED;

  if (game.frameId !== null) {
    cancelAnimationFrame(game.frameId);
    game.frameId = null;
  }

  setCrouch(false);

  pauseOverlay.classList.remove("hidden");

  pauseGameButton.disabled = true;
  endGameButton.disabled = false;

  statusCallback("หยุดชั่วคราว", "waiting");
}

function resumeGame() {
  if (gameState !== GAME_STATE.PAUSED) {
    return;
  }

  if (!bodyFoundCallback()) {
    alert("ไม่พบร่างกาย กรุณายืนให้เห็นใบหน้าและไหล่ก่อนเล่นต่อ");
    return;
  }

  gameState = GAME_STATE.PLAYING;
  game.lastFrameTime = performance.now();

  pauseOverlay.classList.add("hidden");

  pauseGameButton.disabled = false;
  endGameButton.disabled = false;

  statusCallback("กำลังเล่น", "playing");

  game.frameId = requestAnimationFrame(gameLoop);
}

function endGame() {
  if (
    gameState !== GAME_STATE.PLAYING &&
    gameState !== GAME_STATE.PAUSED &&
    gameState !== GAME_STATE.COUNTDOWN
  ) {
    return;
  }

  showGameOver();
}

function restartGame() {
  startGame();
}

/* =========================================================
   RESET GAME
========================================================= */

function resetGame() {
  game.speed = game.baseSpeed;
  game.score = 0;

  game.obstacles = [];

  game.elapsedSinceObstacle = 0;
  game.nextObstacleDelay = randomBetween(1200, 1700);

  game.groundOffset = 0;

  resetDinosaur();

  scoreValue.textContent = "0";
  speedValue.textContent = "1.0x";

  drawGame();
}

function resetDinosaur() {
  dinosaur.height = dinosaur.standingHeight;
  dinosaur.y = game.groundY - dinosaur.height;

  dinosaur.velocityY = 0;

  dinosaur.isJumping = false;
  dinosaur.isCrouching = false;

  dinosaur.runFrame = 0;
  dinosaur.runFrameTimer = 0;
}

/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(timestamp) {
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  const deltaSeconds = Math.min(
    (timestamp - game.lastFrameTime) / 1000,
    0.034,
  );

  game.lastFrameTime = timestamp;

  if (!bodyFoundCallback()) {
    pauseGameBecausePoseLost();
    return;
  }

  updateGame(deltaSeconds);

  /*
    ถ้า updateGame ตรวจพบการชนและเปลี่ยนเป็น GAME_OVER
    ไม่ต้องวาดเฟรมต่อ
  */
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  drawGame();

  game.frameId = requestAnimationFrame(gameLoop);
}

function updateGame(deltaSeconds) {
  updateDifficulty();
  updateDinosaur(deltaSeconds);
  updateGround(deltaSeconds);
  updateObstacleSpawner(deltaSeconds);
  updateObstacles(deltaSeconds);

  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  game.score += deltaSeconds * 10;

  scoreValue.textContent = String(Math.floor(game.score));

  speedValue.textContent =
    `${(game.speed / game.baseSpeed).toFixed(1)}x`;
}

/* =========================================================
   DIFFICULTY
========================================================= */

function updateDifficulty() {
  const speedIncrease = Math.floor(game.score / 100) * 0.5;

  game.speed = Math.min(game.baseSpeed + speedIncrease, 14);
}

/* =========================================================
   DINOSAUR PHYSICS
========================================================= */

function updateDinosaur(deltaSeconds) {
  dinosaur.velocityY += dinosaur.gravity * deltaSeconds;

  dinosaur.y += dinosaur.velocityY * deltaSeconds;

  const floorPosition = game.groundY - dinosaur.height;

  if (dinosaur.y >= floorPosition) {
    dinosaur.y = floorPosition;
    dinosaur.velocityY = 0;
    dinosaur.isJumping = false;
  }

  dinosaur.runFrameTimer += deltaSeconds;

  if (dinosaur.runFrameTimer >= 0.12) {
    dinosaur.runFrame = dinosaur.runFrame === 0 ? 1 : 0;

    dinosaur.runFrameTimer = 0;
  }
}

function triggerJump() {
  if (gameState !== GAME_STATE.PLAYING) {
    return;
  }

  if (dinosaur.isJumping) {
    return;
  }

  dinosaur.isJumping = true;
  dinosaur.velocityY = dinosaur.jumpForce;

  setCrouch(false);
}

function setCrouch(shouldCrouch) {
  if (shouldCrouch && !dinosaur.isJumping) {
    dinosaur.isCrouching = true;
    dinosaur.height = dinosaur.crouchingHeight;
  } else {
    dinosaur.isCrouching = false;
    dinosaur.height = dinosaur.standingHeight;
  }

  /*
    เมื่อเปลี่ยนความสูงต้องเลื่อน y
    เพื่อให้เท้ายังคงอยู่บนพื้น
  */
  if (!dinosaur.isJumping) {
    dinosaur.y = game.groundY - dinosaur.height;
  }
}

/* =========================================================
   OBSTACLE SPAWNER
========================================================= */

function updateObstacleSpawner(deltaSeconds) {
  game.elapsedSinceObstacle += deltaSeconds * 1000;

  if (game.elapsedSinceObstacle < game.nextObstacleDelay) {
    return;
  }

  const obstacle = createRandomObstacle();

  game.obstacles.push(obstacle);

  game.elapsedSinceObstacle = 0;

  const speedRatio = game.speed / game.baseSpeed;

  const minimumDelay = Math.max(850, 1300 / speedRatio);

  const maximumDelay = Math.max(1400, 2200 / speedRatio);

  game.nextObstacleDelay = randomBetween(
    minimumDelay,
    maximumDelay,
  );
}

function createRandomObstacle() {
  let birdProbability = 0;

  if (game.score >= 220) {
    birdProbability = 0.4;
  } else if (game.score >= 80) {
    birdProbability = 0.28;
  }

  return Math.random() < birdProbability
    ? createBird()
    : createCactus();
}

function createCactus() {
  const width = randomBetween(34, 52);
  const height = randomBetween(58, 88);

  return {
    type: "cactus",

    x: game.width + 30,
    y: game.groundY - height,

    width,
    height,

    passed: false,
  };
}

function createBird() {
  const width = 64;
  const height = 40;

  /*
    ตำแหน่งนี้ทำให้ชนไดโนเสาร์ตอนยืน
    และย่อตัวหลบได้
  */
  const y =
    game.groundY - dinosaur.standingHeight + 7;

  return {
    type: "bird",

    x: game.width + 30,
    y,

    width,
    height,

    passed: false,
    animationTime: 0,
  };
}

/* =========================================================
   UPDATE OBSTACLES
========================================================= */

function updateObstacles(deltaSeconds) {
  const movement = game.speed * 60 * deltaSeconds;

  for (const obstacle of game.obstacles) {
    obstacle.x -= movement;

    if (obstacle.type === "bird") {
      obstacle.animationTime += deltaSeconds;
    }

    if (
      !obstacle.passed &&
      obstacle.x + obstacle.width < dinosaur.x
    ) {
      obstacle.passed = true;
      game.score += 10;
    }

    if (checkCollision(dinosaur, obstacle)) {
      showGameOver();
      return;
    }
  }

  game.obstacles = game.obstacles.filter(
    (obstacle) =>
      obstacle.x + obstacle.width > -80,
  );
}

/* =========================================================
   COLLISION
========================================================= */

function checkCollision(player, obstacle) {
  const playerBox = {
    x: player.x + (player.isCrouching ? 8 : 18),

    y: player.y + (player.isCrouching ? 5 : 7),

    width:
      player.width -
      (player.isCrouching ? 16 : 36),

    height:
      player.height -
      (player.isCrouching ? 10 : 12),
  };

  const obstacleBox =
    obstacle.type === "bird"
      ? {
          x: obstacle.x + 10,
          y: obstacle.y + 7,
          width: obstacle.width - 20,
          height: obstacle.height - 14,
        }
      : {
          x: obstacle.x + 4,
          y: obstacle.y + 4,
          width: obstacle.width - 8,
          height: obstacle.height - 8,
        };

  return (
    playerBox.x <
      obstacleBox.x + obstacleBox.width &&
    playerBox.x + playerBox.width >
      obstacleBox.x &&
    playerBox.y <
      obstacleBox.y + obstacleBox.height &&
    playerBox.y + playerBox.height >
      obstacleBox.y
  );
}

/* =========================================================
   GAME OVER
========================================================= */

function showGameOver() {
  gameState = GAME_STATE.GAME_OVER;

  if (game.frameId !== null) {
    cancelAnimationFrame(game.frameId);
    game.frameId = null;
  }

  const finalScore = Math.floor(game.score);

  game.highScore = Math.max(
    game.highScore,
    finalScore,
  );

  scoreValue.textContent = String(finalScore);
  finalScoreValue.textContent = String(finalScore);
  highScoreValue.textContent = String(game.highScore);

  countdownOverlay.classList.add("hidden");
  countdownValue.textContent =
    String(COUNTDOWN_SECONDS);

  pauseOverlay.classList.add("hidden");
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.remove("hidden");

  pauseGameButton.disabled = true;
  endGameButton.disabled = true;
  startGameButton.disabled = false;

  setCrouch(false);

  statusCallback("จบเกม", "offline");

  drawGame();
}

/* =========================================================
   GROUND
========================================================= */

function updateGround(deltaSeconds) {
  game.groundOffset -=
    game.speed * 60 * deltaSeconds;

  if (game.groundOffset <= -50) {
    game.groundOffset += 50;
  }
}

/* =========================================================
   DRAW GAME
========================================================= */

function drawGame() {
  gameCtx.clearRect(
    0,
    0,
    game.width,
    game.height,
  );

  drawSky();
  drawClouds();
  drawGround();
  drawGroundMarks();
  drawObstacles();

  drawDinosaur(gameCtx, dinosaur, {
    pixelSize: 5,
    bodyColor: "#555555",
    eyeWhiteColor: "#f8fafc",
    eyePupilColor: "#0f172a",
  });

  drawGameText();
}

function drawSky() {
  const gradient = gameCtx.createLinearGradient(
    0,
    0,
    0,
    game.height,
  );

  gradient.addColorStop(0, "#dff6ff");
  gradient.addColorStop(0.72, "#f4fbff");
  gradient.addColorStop(0.721, "#f7ead1");
  gradient.addColorStop(1, "#e5c995");

  gameCtx.fillStyle = gradient;

  gameCtx.fillRect(
    0,
    0,
    game.width,
    game.height,
  );

  gameCtx.fillStyle =
    "rgba(255, 211, 90, 0.8)";

  gameCtx.beginPath();

  gameCtx.arc(
    860,
    80,
    34,
    0,
    Math.PI * 2,
  );

  gameCtx.fill();
}

function drawClouds() {
  const clouds = [
    {
      x: 120,
      y: 80,
      scale: 1,
    },
    {
      x: 480,
      y: 125,
      scale: 0.75,
    },
    {
      x: 760,
      y: 175,
      scale: 0.55,
    },
  ];

  gameCtx.fillStyle =
    "rgba(255, 255, 255, 0.82)";

  for (const cloud of clouds) {
    const wrappedX =
      ((cloud.x -
        game.groundOffset * 0.12) %
        (game.width + 180)) -
      80;

    const y = cloud.y;
    const scale = cloud.scale;

    gameCtx.beginPath();

    gameCtx.arc(
      wrappedX,
      y,
      28 * scale,
      0,
      Math.PI * 2,
    );

    gameCtx.arc(
      wrappedX + 34 * scale,
      y - 12 * scale,
      34 * scale,
      0,
      Math.PI * 2,
    );

    gameCtx.arc(
      wrappedX + 70 * scale,
      y,
      27 * scale,
      0,
      Math.PI * 2,
    );

    gameCtx.fill();
  }
}

function drawGround() {
  gameCtx.strokeStyle = "#795548";
  gameCtx.lineWidth = 10;

  gameCtx.beginPath();
  gameCtx.moveTo(0, game.groundY);
  gameCtx.lineTo(game.width, game.groundY);
  gameCtx.stroke();
}

function drawGroundMarks() {
  gameCtx.strokeStyle =
    "rgba(121, 85, 72, 0.55)";

  gameCtx.lineWidth = 3;

  for (
    let x = game.groundOffset;
    x < game.width + 50;
    x += 50
  ) {
    gameCtx.beginPath();

    gameCtx.moveTo(
      x,
      game.groundY + 18,
    );

    gameCtx.lineTo(
      x + 25,
      game.groundY + 18,
    );

    gameCtx.stroke();
  }
}

function drawObstacles() {
  for (const obstacle of game.obstacles) {
    if (obstacle.type === "cactus") {
      drawCactus(obstacle);
      continue;
    }

    if (obstacle.type === "bird") {
      drawBird(gameCtx, obstacle, {
        pixelSize: 4,
        bodyColor: "#555555",
        eyeColor: "#f8fafc",
        pupilColor: "#0f172a",
        frameDuration: 0.16,
      });
    }
  }
}

/* =========================================================
   DRAW CACTUS
========================================================= */

function drawCactus(obstacle) {
  const {
    x,
    y,
    width,
    height,
  } = obstacle;

  gameCtx.save();

  gameCtx.fillStyle = "#15803d";
  gameCtx.strokeStyle = "#166534";
  gameCtx.lineWidth = 3;

  gameCtx.beginPath();

  gameCtx.roundRect(
    x + width * 0.3,
    y,
    width * 0.4,
    height,
    8,
  );

  gameCtx.fill();
  gameCtx.stroke();

  gameCtx.beginPath();

  gameCtx.roundRect(
    x,
    y + height * 0.38,
    width * 0.38,
    height * 0.18,
    6,
  );

  gameCtx.fill();
  gameCtx.stroke();

  gameCtx.beginPath();

  gameCtx.roundRect(
    x,
    y + height * 0.22,
    width * 0.18,
    height * 0.33,
    6,
  );

  gameCtx.fill();
  gameCtx.stroke();

  gameCtx.beginPath();

  gameCtx.roundRect(
    x + width * 0.62,
    y + height * 0.53,
    width * 0.38,
    height * 0.18,
    6,
  );

  gameCtx.fill();
  gameCtx.stroke();

  gameCtx.beginPath();

  gameCtx.roundRect(
    x + width * 0.82,
    y + height * 0.35,
    width * 0.18,
    height * 0.35,
    6,
  );

  gameCtx.fill();
  gameCtx.stroke();

  gameCtx.restore();
}

/* =========================================================
   DRAW TEXT
========================================================= */

function drawGameText() {
  gameCtx.save();

  gameCtx.fillStyle =
    "rgba(15, 23, 42, 0.78)";

  gameCtx.font =
    "bold 22px sans-serif";

  gameCtx.fillText(
    `Score: ${Math.floor(game.score)}`,
    24,
    36,
  );

  gameCtx.font = "16px sans-serif";

  gameCtx.fillText(
    `Pose: ${poseNameCallback()}`,
    24,
    62,
  );

  gameCtx.restore();
}

/* =========================================================
   KEYBOARD TEST
========================================================= */

function setupKeyboardControls() {
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.code === "Space" ||
        event.code === "ArrowUp"
      ) {
        event.preventDefault();
        triggerJump();
      }

      if (
        event.code === "ArrowDown" &&
        gameState === GAME_STATE.PLAYING
      ) {
        event.preventDefault();
        setCrouch(true);
      }

      if (event.code === "KeyP") {
        if (
          gameState === GAME_STATE.PLAYING
        ) {
          pauseGame();
        } else if (
          gameState === GAME_STATE.PAUSED
        ) {
          resumeGame();
        }
      }
    },
  );

  window.addEventListener(
    "keyup",
    (event) => {
      if (event.code === "ArrowDown") {
        setCrouch(false);
      }
    },
  );
}

/* =========================================================
   HELPERS
========================================================= */

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      milliseconds,
    );
  });
}