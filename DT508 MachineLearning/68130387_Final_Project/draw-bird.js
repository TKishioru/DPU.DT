/* =========================================================
   DRAW BIRD
   รับผิดชอบ:
   - เก็บ Pixel Sprite ของนก
   - เลือกเฟรมปีกขึ้น / ปีกลง
   - วาดนกลงบน Canvas
========================================================= */

const BIRD_FRAMES = {
  /*
    ปีกยก
    ขนาดประมาณ 14 x 8 ช่อง
  */
  wingUp: [
"000010000000",
  "000011000000",
  "000011100000",
  "001011110000",
  "011011111000",
  "011111111100",
  "001111111111",
  "000111111100",
  "000011111111",
  "000001110000",
  "000000110000"
  ],

  /*
    ปีกลง
    ขนาดประมาณ 14 x 8 ช่อง
  */
  wingDown: [
"000100000000",
  "001100000000",
  "011100000000",
  "111100000000",
  "011111110000",
  "001111111100",
  "000111111111",
  "000011111100",
  "000011111111",
  "000011000000",
  "000010000000"
  ],
};

/* =========================================================
   ฟังก์ชันหลัก
========================================================= */

/**
 * วาดนกลงบน Canvas
 *
 * @param {CanvasRenderingContext2D} context
 * @param {object} bird
 * @param {object} options
 */
export function drawBird(
  context,
  bird,
  options = {},
) {
  if (!context || !bird) {
    return;
  }

  const {
    pixelSize = 4,
    bodyColor = "#555555",
    eyeColor = "#f8fafc",
    pupilColor = "#0f172a",
    frameDuration = 0.16,
  } = options;

  context.save();
  context.imageSmoothingEnabled = false;

  const frame = getBirdFrame(
    bird.animationTime ?? 0,
    frameDuration,
  );

  const spriteWidth =
    getFrameWidth(frame) * pixelSize;

  const spriteHeight =
    frame.length * pixelSize;

  /*
    จัด Sprite ให้อยู่กึ่งกลาง Hitbox
  */
  const drawX =
    Math.round(
      bird.x +
      (bird.width - spriteWidth) / 2,
    );

  const drawY =
    Math.round(
      bird.y +
      (bird.height - spriteHeight) / 2,
    );

  drawPixelSprite(
    context,
    frame,
    drawX,
    drawY,
    pixelSize,
    bodyColor,
  );

  const eyePosition = getBirdEyePosition(
    drawX,
    drawY,
    pixelSize,
  );

  drawBirdEye(
    context,
    eyePosition.x,
    eyePosition.y,
    {
      eyeColor,
      pupilColor,
      pixelSize,
    },
  );

  context.restore();
}

/* =========================================================
   เลือกเฟรม
========================================================= */

function getBirdFrame(
  animationTime,
  frameDuration,
) {
  const frameIndex =
    Math.floor(
      animationTime / frameDuration,
    ) % 2;

  return frameIndex === 0
    ? BIRD_FRAMES.wingUp
    : BIRD_FRAMES.wingDown;
}

/* =========================================================
   วาด Pixel Sprite
========================================================= */

function drawPixelSprite(
  context,
  frame,
  startX,
  startY,
  pixelSize,
  color,
) {
  context.fillStyle = color;

  for (
    let row = 0;
    row < frame.length;
    row += 1
  ) {
    const rowData = frame[row];

    for (
      let column = 0;
      column < rowData.length;
      column += 1
    ) {
      if (rowData[column] !== "1") {
        continue;
      }

      context.fillRect(
        Math.round(
          startX +
          column * pixelSize,
        ),
        Math.round(
          startY +
          row * pixelSize,
        ),
        pixelSize,
        pixelSize,
      );
    }
  }
}

/* =========================================================
   ตำแหน่งตา
========================================================= */

function getBirdEyePosition(
  drawX,
  drawY,
  pixelSize,
) {
  return {
    x:
      drawX +
      10.5 * pixelSize,

    y:
      drawY +
      4.5 * pixelSize,
  };
}

/* =========================================================
   วาดตานก
========================================================= */

function drawBirdEye(
  context,
  x,
  y,
  options = {},
) {
  const {
    eyeColor = "#f8fafc",
    pupilColor = "#0f172a",
    pixelSize = 4,
  } = options;

  const eyeRadius = Math.max(
    1.5,
    pixelSize * 0.42,
  );

  const pupilRadius = Math.max(
    0.8,
    pixelSize * 0.2,
  );

  context.fillStyle = eyeColor;

  context.beginPath();

  context.arc(
    x,
    y,
    eyeRadius,
    0,
    Math.PI * 2,
  );

  context.fill();

  context.fillStyle = pupilColor;

  context.beginPath();

  context.arc(
    x + pixelSize * 0.18,
    y,
    pupilRadius,
    0,
    Math.PI * 2,
  );

  context.fill();
}

/* =========================================================
   Helper
========================================================= */

function getFrameWidth(frame) {
  return frame.reduce(
    (maximumWidth, row) =>
      Math.max(
        maximumWidth,
        row.length,
      ),
    0,
  );
}