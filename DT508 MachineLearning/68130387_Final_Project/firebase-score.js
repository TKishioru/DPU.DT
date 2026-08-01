import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";

import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBVSBgmX5hGx22Bw-NE-hFfFm2BKy5BPY0",
  authDomain: "pose-dino-runner.firebaseapp.com",
  projectId: "pose-dino-runner",
  storageBucket: "pose-dino-runner.firebasestorage.app",
  messagingSenderId: "887755850146",
  appId: "1:887755850146:web:10f3a54e90b93c77b7f2fb",
};

/* =========================================================
   SETTINGS
========================================================= */

/*
  แสดงบน Leaderboard สูงสุด 10 คน
*/
const TOP_PLAYER_LIMIT = 10;

/*
  โหลดคะแนนครั้งละ 25 รายการ

  เพราะบางคนอาจเล่นหลายรอบและติดคะแนนสูงหลายรายการ
  ระบบจะโหลดชุดถัดไปจนกว่าจะพบชื่อไม่ซ้ำครบ 10 คน
*/
const SCORE_QUERY_BATCH_SIZE = 25;

/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const database = getFirestore(firebaseApp);

let anonymousLoginPromise = null;

/* =========================================================
   ANONYMOUS LOGIN
========================================================= */

async function getCurrentUser() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (anonymousLoginPromise === null) {
    anonymousLoginPromise = signInAnonymously(auth)
      .then((credential) => {
        return credential.user;
      })
      .catch((error) => {
        /*
          ให้ลอง Login ใหม่ได้ หากครั้งแรกผิดพลาด
        */
        anonymousLoginPromise = null;

        throw error;
      });
  }

  return anonymousLoginPromise;
}

/* =========================================================
   SAVE EVERY GAME ATTEMPT

   ทุกครั้งที่เรียกฟังก์ชันนี้:
   - สร้าง Document ใหม่
   - ไม่อัปเดต Document เดิม
========================================================= */

export async function saveScore(score, playerName) {
  const user = await getCurrentUser();

  const safeName = sanitizePlayerName(playerName);

  if (!safeName) {
    throw new Error("PLAYER_NAME_REQUIRED");
  }

  const safeScore = Math.max(0, Math.floor(Number(score) || 0));

  const documentReference = await addDoc(
    collection(database, "scoreAttempts"),
    {
      userId: user.uid,
      name: safeName,
      score: safeScore,
      playedAt: serverTimestamp(),
    },
  );

  return {
    id: documentReference.id,
    userId: user.uid,
    name: safeName,
    score: safeScore,
  };
}

/* =========================================================
   LOAD TOP 10 UNIQUE PLAYERS

   วิธีทำงาน:
   1. เรียงทุกคะแนนจากมากไปน้อย
   2. อ่านทีละชุด
   3. ข้ามชื่อที่เคยพบแล้ว
   4. หยุดเมื่อได้ผู้เล่นไม่ซ้ำครบ 10 คน
========================================================= */

export async function loadTopPlayers(maximumPlayers = TOP_PLAYER_LIMIT) {
  const requestedLimit = Math.min(
    TOP_PLAYER_LIMIT,
    Math.max(1, Math.floor(maximumPlayers)),
  );

  const scoreCollection = collection(database, "scoreAttempts");

  const uniquePlayers = [];

  const foundPlayerNames = new Set();

  let lastDocument = null;

  while (uniquePlayers.length < requestedLimit) {
    const scoreQuery =
      lastDocument === null
        ? query(
            scoreCollection,
            orderBy("score", "desc"),
            limit(SCORE_QUERY_BATCH_SIZE),
          )
        : query(
            scoreCollection,
            orderBy("score", "desc"),
            startAfter(lastDocument),
            limit(SCORE_QUERY_BATCH_SIZE),
          );

    const snapshot = await getDocs(scoreQuery);

    if (snapshot.empty) {
      break;
    }

    for (const scoreDocument of snapshot.docs) {
      const scoreData = scoreDocument.data();

      const playerName = sanitizePlayerName(scoreData.name);

      if (!playerName) {
        continue;
      }

      /*
        ใช้ชื่อที่ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็ก
        สำหรับตรวจชื่อซ้ำ

        เช่น:
        TK
        tk
        TK  (มีช่องว่างท้าย)

        จะถือว่าเป็นผู้เล่นชื่อเดียวกัน
      */
      const playerKey = normalizePlayerName(playerName);

      if (foundPlayerNames.has(playerKey)) {
        continue;
      }

      foundPlayerNames.add(playerKey);

      uniquePlayers.push({
        id: scoreDocument.id,
        name: playerName,
        score: Math.max(0, Number(scoreData.score) || 0),
        playedAt: scoreData.playedAt ?? null,
      });

      if (uniquePlayers.length >= requestedLimit) {
        break;
      }
    }

    lastDocument = snapshot.docs[snapshot.docs.length - 1];

    /*
      ถ้าได้ข้อมูลน้อยกว่าขนาดชุด
      แปลว่าอ่านถึงรายการสุดท้ายแล้ว
    */
    if (snapshot.docs.length < SCORE_QUERY_BATCH_SIZE) {
      break;
    }
  }

  return uniquePlayers.map((player, index) => {
    return {
      ...player,
      rank: index + 1,
    };
  });
}

/* =========================================================
   RENDER LEADERBOARD
========================================================= */

export async function renderLeaderboard() {
  const leaderboardList = document.getElementById("leaderboardList");

  const leaderboardStatus = document.getElementById("leaderboardStatus");

  if (!leaderboardList) {
    return;
  }

  setText(leaderboardStatus, "กำลังโหลดคะแนน...");

  leaderboardList.innerHTML = `
    <li class="leaderboard-empty">
      กำลังโหลดคะแนน...
    </li>
  `;

  try {
    const players = await loadTopPlayers(10);

    leaderboardList.innerHTML = "";

    if (players.length === 0) {
      leaderboardList.innerHTML = `
        <li class="leaderboard-empty">
          ยังไม่มีคะแนนในระบบ
        </li>
      `;

      setText(leaderboardStatus, "ยังไม่มีคะแนน");

      return;
    }

    for (const player of players) {
      const listItem = document.createElement("li");

      listItem.className = "leaderboard-item";

      /*
        อันดับ
      */
      const rankElement = document.createElement("span");

      rankElement.className = "leaderboard-rank";

      rankElement.textContent = getRankText(player.rank);

      /*
        ชื่อผู้เล่น
      */
      const nameElement = document.createElement("span");

      nameElement.className = "leaderboard-name";

      nameElement.textContent = player.name;

      /*
        วันที่และเวลา
      */
      const dateElement = document.createElement("time");

      dateElement.className = "leaderboard-date";

      dateElement.textContent = formatFirebaseDate(player.playedAt);

      /*
        คะแนน
      */
      const scoreElement = document.createElement("strong");

      scoreElement.className = "leaderboard-score";

      scoreElement.textContent = player.score.toLocaleString("th-TH");

      listItem.append(rankElement, nameElement, dateElement, scoreElement);

      leaderboardList.appendChild(listItem);
    }

    setText(leaderboardStatus, `แสดง ${players.length} อันดับสูงสุด`);
  } catch (error) {
    console.error("Cannot load leaderboard:", error);

    leaderboardList.innerHTML = `
      <li class="leaderboard-empty">
        ไม่สามารถโหลดตารางคะแนนได้
      </li>
    `;

    setText(leaderboardStatus, "โหลดคะแนนไม่สำเร็จ");
  }
}

/* =========================================================
   PLAYER NAME
========================================================= */

export function getPlayerName() {
  const playerNameInput = document.getElementById("playerNameInput");

  return sanitizePlayerName(playerNameInput?.value ?? "");
}

export function isPlayerNameValid() {
  return getPlayerName().length > 0;
}

/* =========================================================
   CLEAR PLAYER FOR NEXT ROUND
========================================================= */

export function clearPlayerName() {
  const playerNameInput = document.getElementById("playerNameInput");

  if (!playerNameInput) {
    return;
  }

  playerNameInput.value = "";

  playerNameInput.disabled = false;
}

/* =========================================================
   HELPERS
========================================================= */

function sanitizePlayerName(playerName) {
  return String(playerName ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

function normalizePlayerName(playerName) {
  return sanitizePlayerName(playerName).toLocaleLowerCase("th-TH");
}

function formatFirebaseDate(timestamp) {
  if (!timestamp?.toDate) {
    return "กำลังซิงก์เวลา";
  }

  const date = timestamp.toDate();

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function getRankText(rank) {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return String(rank);
}

function setText(element, text) {
  if (element) {
    element.textContent = text;
  }
}
