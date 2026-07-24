"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const MODEL_PATH = "./my_model/";
const MAX_FILES = 100;
const HIGH_RISK_THRESHOLD = 0.8;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const ALLOWED_FILE_EXTENSION = /\.(jpe?g|png|webp)$/i;

/* =========================================================
   STATE
========================================================= */

let model = null;
let modelLoadingPromise = null;
let queuePromise = null;
let runVersion = 0;
let nextItemId = 1;

const state = {
  items: [],
  activeFilter: "all",
  searchKeyword: "",
  sortMode: "upload-order"
};

/* =========================================================
   HTML ELEMENTS
========================================================= */

function getRequiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`ไม่พบ HTML element: #${id}`);
  }

  return element;
}

const fileInput =
  getRequiredElement("xray-file-input");

const uploadEmptyState =
  getRequiredElement("upload-empty-state");

const uploadCompactState =
  getRequiredElement("upload-compact-state");

const selectedCount =
  getRequiredElement("selected-count");

const remainingCount =
  getRequiredElement("remaining-count");

const progressContainer =
  getRequiredElement("progress-container");

const processedCount =
  getRequiredElement("processed-count");

const totalAnalysisCount =
  getRequiredElement("total-analysis-count");

const progressPercent =
  getRequiredElement("progress-percent");

const progressDescription =
  getRequiredElement("progress-description");

const progressBar =
  getRequiredElement("progress-bar");

const normalCount =
  getRequiredElement("normal-count");

const abnormalCount =
  getRequiredElement("abnormal-count");

const queuedCount =
  getRequiredElement("queued-count");

const queueTotalCount =
  getRequiredElement("queue-total-count");

const toolbarContainer =
  getRequiredElement("toolbar-container");

const searchInput =
  getRequiredElement("search-input");

const sortSelect =
  getRequiredElement("sort-select");

const gridContainer =
  getRequiredElement("grid-container");

const noResults =
  getRequiredElement("no-results");

const cardTemplate =
  getRequiredElement("xray-card-template");

const clearAllButton =
  getRequiredElement("btn-clear-all");

const filterButtons = Array.from(
  document.querySelectorAll(".filter-button")
);

const gridButtons = Array.from(
  document.querySelectorAll(".grid-button")
);

/* =========================================================
   MODEL
========================================================= */

async function loadModel() {
  if (model) {
    return model;
  }

  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }

  if (typeof window.tf === "undefined") {
    throw new Error(
      "ไม่พบ TensorFlow.js กรุณาตรวจสอบ Script ใน index.html"
    );
  }

  if (typeof window.tmImage === "undefined") {
    throw new Error(
      "ไม่พบ Teachable Machine Image Library"
    );
  }

  const modelURL =
    `${MODEL_PATH}model.json`;

  const metadataURL =
    `${MODEL_PATH}metadata.json`;

  progressDescription.textContent =
    "กำลังโหลดโมเดล TensorFlow.js...";

  console.log("Model URL:", modelURL);
  console.log("Metadata URL:", metadataURL);

  modelLoadingPromise = (async function () {
    try {
      await window.tf.ready();

      const loadedModel =
        await window.tmImage.load(
          modelURL,
          metadataURL
        );

      if (
        !loadedModel ||
        typeof loadedModel.predict !== "function"
      ) {
        throw new Error(
          "รูปแบบโมเดลไม่ถูกต้อง"
        );
      }

      model = loadedModel;

      console.log(
        "โหลดโมเดลสำเร็จ จำนวน Class:",
        model.getTotalClasses()
      );

      return model;
    } catch (error) {
      modelLoadingPromise = null;

      console.error(
        "Model loading error:",
        error
      );

      throw new Error(
        "โหลดโมเดลไม่สำเร็จ กรุณาตรวจสอบโฟลเดอร์ my_model " +
        "และไฟล์ model.json, metadata.json และไฟล์ weights " +
        "รวมถึงเปิดเว็บผ่าน Live Server หรือ localhost"
      );
    }
  })();

  return modelLoadingPromise;
}

/* =========================================================
   FILE INPUT
========================================================= */

fileInput.addEventListener(
  "change",
  function (event) {
    const files = Array.from(
      event.target.files || []
    );

    fileInput.value = "";

    addFiles(files);
  }
);

function addFiles(files) {
  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {
    return;
  }

  const remainingSlots =
    MAX_FILES - state.items.length;

  if (remainingSlots <= 0) {
    showMessage(
      "อัปโหลดครบ 100 ภาพแล้ว"
    );

    return;
  }

  const validFiles =
    files.filter(isValidImageFile);

  const invalidCount =
    files.length - validFiles.length;

  if (validFiles.length === 0) {
    showMessage(
      "รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP"
    );

    return;
  }

  const acceptedFiles =
    validFiles.slice(0, remainingSlots);

  acceptedFiles.forEach(
    createAnalysisItem
  );

  updateInterface();

  void processAnalysisQueue();

  if (invalidCount > 0) {
    showMessage(
      `ข้ามไฟล์ที่ไม่รองรับ ${invalidCount} ไฟล์`
    );
  } else if (
    validFiles.length > remainingSlots
  ) {
    showMessage(
      `เพิ่มได้อีกเพียง ${remainingSlots} ภาพ ` +
      "ระบบจึงรับเฉพาะไฟล์ชุดแรก"
    );
  }
}

function isValidImageFile(file) {
  if (!(file instanceof File)) {
    return false;
  }

  return (
    ALLOWED_MIME_TYPES.has(file.type) ||
    ALLOWED_FILE_EXTENSION.test(file.name)
  );
}

/* =========================================================
   CARD CREATION
========================================================= */

function createAnalysisItem(file) {
  const item = {
    id: nextItemId++,
    uploadOrder:
      state.items.length + 1,
    file,
    objectURL:
      window.URL.createObjectURL(file),
    filename: file.name,
    filesize: file.size,
    status: "queued",
    category: "queued",
    diagnosis: "รอการวิเคราะห์",
    topClass: "",
    confidence: 0,
    predictions: [],
    isHighRisk: false,
    errorMessage: "",
    card: null,
    imageElement: null
  };

  item.card = createCard(item);

  item.imageElement =
    item.card.querySelector(
      '[data-field="image"]'
    );

  state.items.push(item);

  gridContainer.appendChild(
    item.card
  );
}

function createCard(item) {
  const templateRoot =
    cardTemplate.content.firstElementChild;

  if (!templateRoot) {
    throw new Error(
      "ไม่พบโครงสร้างการ์ดใน #xray-card-template"
    );
  }

  const card =
    templateRoot.cloneNode(true);

  card.dataset.itemId =
    String(item.id);

  card.dataset.category =
    "queued";

  card.dataset.highRisk =
    "false";

  const image =
    card.querySelector(
      '[data-field="image"]'
    );

  const imageNumber =
    card.querySelector(
      '[data-field="image-number"]'
    );

  const filename =
    card.querySelector(
      '[data-field="filename"]'
    );

  const filesize =
    card.querySelector(
      '[data-field="filesize"]'
    );

  image.src = item.objectURL;

  image.alt =
    `ภาพเอกซเรย์ ${item.filename}`;

  imageNumber.textContent =
    "#" +
    String(item.uploadOrder).padStart(
      3,
      "0"
    );

  filename.textContent =
    item.filename;

  filename.title =
    item.filename;

  filesize.textContent =
    formatFileSize(item.filesize);

  updateCard(item, card);

  return card;
}

/* =========================================================
   ANALYSIS QUEUE
========================================================= */

async function processAnalysisQueue() {
  if (queuePromise) {
    return queuePromise;
  }

  const currentRunVersion =
    runVersion;

  queuePromise = (async function () {
    try {
      await loadModel();

      if (
        currentRunVersion !==
        runVersion
      ) {
        return;
      }

      while (
        currentRunVersion ===
        runVersion
      ) {
        const nextItem =
          state.items.find(
            function (item) {
              return (
                item.status ===
                "queued"
              );
            }
          );

        if (!nextItem) {
          break;
        }

        await analyzeItem(
          nextItem,
          currentRunVersion
        );

        await nextAnimationFrame();
      }
    } catch (error) {
      if (
        currentRunVersion !==
        runVersion
      ) {
        return;
      }

      console.error(
        "Analysis queue error:",
        error
      );

      state.items.forEach(
        function (item) {
          if (
            item.status === "queued" ||
            item.status === "processing"
          ) {
            item.status = "error";
            item.category = "error";
            item.diagnosis =
              "วิเคราะห์ไม่สำเร็จ";
            item.errorMessage =
              error.message;

            updateCard(item);
          }
        }
      );

      showMessage(error.message);
    } finally {
      queuePromise = null;

      updateInterface();

      if (
        state.items.some(
          function (item) {
            return (
              item.status ===
              "queued"
            );
          }
        )
      ) {
        void processAnalysisQueue();
      }
    }
  })();

  return queuePromise;
}

async function analyzeItem(
  item,
  currentRunVersion
) {
  item.status = "processing";
  item.category = "processing";

  updateCard(item);
  updateInterface();

  try {
    await waitForImage(
      item.imageElement
    );

    if (
      currentRunVersion !==
      runVersion
    ) {
      return;
    }

    const predictions =
      await model.predict(
        item.imageElement
      );

    if (
      currentRunVersion !==
      runVersion
    ) {
      return;
    }

    if (
      !Array.isArray(predictions) ||
      predictions.length === 0
    ) {
      throw new Error(
        "โมเดลไม่ส่งผลการวิเคราะห์กลับมา"
      );
    }

    const sortedPredictions =
      [...predictions].sort(
        function (first, second) {
          return (
            second.probability -
            first.probability
          );
        }
      );

    const topPrediction =
      sortedPredictions[0];

    item.predictions =
      sortedPredictions;

    item.topClass =
      String(
        topPrediction.className ||
        "ไม่ทราบผล"
      );

    item.confidence =
      Number(
        topPrediction.probability
      ) || 0;

    item.category =
      getPredictionCategory(
        item.topClass
      );

    item.diagnosis =
      getDiagnosisLabel(
        item.topClass
      );

    item.isHighRisk =
      item.category === "abnormal" &&
      item.confidence >=
        HIGH_RISK_THRESHOLD;

    item.status = "completed";
    item.errorMessage = "";
  } catch (error) {
    if (
      currentRunVersion !==
      runVersion
    ) {
      return;
    }

    console.error(
      `Prediction failed: ${item.filename}`,
      error
    );

    item.status = "error";
    item.category = "error";
    item.diagnosis =
      "วิเคราะห์ภาพไม่สำเร็จ";
    item.confidence = 0;
    item.predictions = [];
    item.isHighRisk = false;

    item.errorMessage =
      error && error.message
        ? error.message
        : "ไม่สามารถวิเคราะห์ภาพได้";
  }

  if (
    currentRunVersion ===
    runVersion
  ) {
    updateCard(item);
    updateInterface();
  }
}

/* =========================================================
   CARD UPDATE
========================================================= */

function updateCard(
  item,
  targetCard = item.card
) {
  if (!targetCard) {
    return;
  }

  const riskBadge =
    targetCard.querySelector(
      '[data-field="risk-badge"]'
    );

  const statusText =
    targetCard.querySelector(
      '[data-field="status-text"]'
    );

  const diagnosis =
    targetCard.querySelector(
      '[data-field="diagnosis"]'
    );

  const confidence =
    targetCard.querySelector(
      '[data-field="confidence"]'
    );

  const confidenceBar =
    targetCard.querySelector(
      '[data-field="confidence-bar"]'
    );

  const predictionList =
    targetCard.querySelector(
      '[data-field="prediction-list"]'
    );

  targetCard.dataset.category =
    item.category;

  targetCard.dataset.highRisk =
    item.isHighRisk
      ? "true"
      : "false";

  predictionList.innerHTML = "";

  if (item.status === "queued") {
    setRiskBadge(
      riskBadge,
      "queued",
      "◷ รอคิว"
    );

    setStatusText(
      statusText,
      "รอดำเนินการ",
      "slate"
    );

    diagnosis.textContent =
      "รอการวิเคราะห์...";

    confidence.textContent =
      "0%";

    confidenceBar.style.width =
      "0%";

    confidenceBar.className =
      "h-full rounded-full bg-slate-700 " +
      "transition-all duration-300";

    appendInformationText(
      predictionList,
      "กำลังรอคิววิเคราะห์ภาพ"
    );

    return;
  }

  if (item.status === "processing") {
    setRiskBadge(
      riskBadge,
      "processing",
      "AI กำลังวิเคราะห์"
    );

    setStatusText(
      statusText,
      "กำลังประมวลผล",
      "cyan"
    );

    diagnosis.textContent =
      "กำลังวิเคราะห์ภาพ...";

    confidence.textContent =
      "...";

    confidenceBar.style.width =
      "40%";

    confidenceBar.className =
      "progress-shine h-full rounded-full " +
      "bg-gradient-to-r from-cyan-500 " +
      "to-blue-500 transition-all duration-300";

    appendInformationText(
      predictionList,
      "TensorFlow.js กำลังประมวลผลภาพ"
    );

    return;
  }

  if (item.status === "error") {
    setRiskBadge(
      riskBadge,
      "error",
      "✕ เกิดข้อผิดพลาด"
    );

    setStatusText(
      statusText,
      "ไม่สำเร็จ",
      "rose"
    );

    diagnosis.textContent =
      "วิเคราะห์ภาพไม่สำเร็จ";

    confidence.textContent =
      "0%";

    confidenceBar.style.width =
      "0%";

    confidenceBar.className =
      "h-full rounded-full bg-rose-500 " +
      "transition-all duration-300";

    appendInformationText(
      predictionList,
      item.errorMessage
    );

    return;
  }

  const percentage =
    item.confidence * 100;

  diagnosis.textContent =
    item.diagnosis;

  confidence.textContent =
    `${percentage.toFixed(2)}%`;

  confidenceBar.style.width =
    `${Math.min(
      Math.max(percentage, 0),
      100
    )}%`;

  setStatusText(
    statusText,
    "✓ พร้อมใช้งาน",
    "emerald"
  );

  if (item.category === "normal") {
    setRiskBadge(
      riskBadge,
      "normal",
      "✓ ปอดปกติ"
    );

    confidenceBar.className =
      "h-full rounded-full bg-gradient-to-r " +
      "from-emerald-500 to-cyan-400 " +
      "transition-all duration-300";
  } else if (item.isHighRisk) {
    setRiskBadge(
      riskBadge,
      "high-risk",
      "⚠ เสี่ยงสูง"
    );

    confidenceBar.className =
      "h-full rounded-full bg-gradient-to-r " +
      "from-rose-500 to-orange-400 " +
      "transition-all duration-300";
  } else {
    setRiskBadge(
      riskBadge,
      "abnormal",
      "⚠ พบข้อสังเกต"
    );

    confidenceBar.className =
      "h-full rounded-full bg-gradient-to-r " +
      "from-amber-500 to-orange-400 " +
      "transition-all duration-300";
  }

  renderPredictionList(
    predictionList,
    item.predictions
  );
}

function setStatusText(
  element,
  text,
  color
) {
  const colorClassMap = {
    slate: "text-slate-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    rose: "text-rose-400"
  };

  element.className =
    `text-xs font-bold ${colorClassMap[color]}`;

  element.textContent =
    text;
}

function setRiskBadge(
  element,
  type,
  text
) {
  const baseClass =
    "absolute right-3 top-3 rounded-lg " +
    "border px-3 py-1.5 text-xs font-bold " +
    "shadow-lg backdrop-blur";

  const styleMap = {
    queued:
      "border-slate-600 " +
      "bg-slate-900/90 " +
      "text-slate-300",

    processing:
      "border-cyan-700 " +
      "bg-cyan-950/90 " +
      "text-cyan-300",

    normal:
      "border-emerald-700 " +
      "bg-emerald-950/90 " +
      "text-emerald-300",

    abnormal:
      "border-amber-700 " +
      "bg-amber-950/90 " +
      "text-amber-300",

    "high-risk":
      "border-rose-700 " +
      "bg-rose-950/90 " +
      "text-rose-300",

    error:
      "border-rose-700 " +
      "bg-rose-950/90 " +
      "text-rose-300"
  };

  element.className =
    `${baseClass} ${styleMap[type]}`;

  element.textContent =
    text;
}

function renderPredictionList(
  container,
  predictions
) {
  container.innerHTML = "";

  /*
   * เรียง Class ให้เหมือนกันทุกการ์ด
   * 1. NORMAL
   * 2. PNEUMONIA
   * 3. Class อื่น ๆ
   */
  const orderedPredictions =
    [...predictions].sort(
      function (first, second) {
        return (
          getPredictionDisplayOrder(
            first.className
          ) -
          getPredictionDisplayOrder(
            second.className
          )
        );
      }
    );

  orderedPredictions.forEach(
    function (prediction) {
      const percentage =
        (
          Number(
            prediction.probability
          ) || 0
        ) * 100;

      const row =
        document.createElement("div");

      row.className =
        "rounded-xl border border-slate-800 " +
        "bg-slate-950/70 p-2.5";

      const header =
        document.createElement("div");

      header.className =
        "flex items-center justify-between " +
        "gap-3 text-xs";

      const name =
        document.createElement("span");

      name.className =
        "truncate font-semibold text-slate-400";

      name.textContent =
        String(
          prediction.className ||
          "ไม่ทราบ Class"
        ).toUpperCase();

      const value =
        document.createElement("strong");

      value.className =
        "shrink-0 text-slate-200";

      value.textContent =
        `${percentage.toFixed(2)}%`;

      const progress =
        document.createElement("div");

      progress.className =
        "mt-2 h-1.5 overflow-hidden " +
        "rounded-full bg-slate-800";

      const bar =
        document.createElement("div");

      bar.className =
        "h-full rounded-full bg-cyan-500";

      bar.style.width =
        `${Math.min(
          Math.max(percentage, 0),
          100
        )}%`;

      header.append(
        name,
        value
      );

      progress.appendChild(bar);

      row.append(
        header,
        progress
      );

      container.appendChild(row);
    }
  );
}

function getPredictionDisplayOrder(
  className
) {
  const normalized =
    normalizeText(className);

  if (
    normalized.includes("normal")
  ) {
    return 1;
  }

  if (
    normalized.includes("pneumonia")
  ) {
    return 2;
  }

  return 99;
}

function appendInformationText(
  container,
  text
) {
  const paragraph =
    document.createElement("p");

  paragraph.className =
    "rounded-xl border border-slate-800 " +
    "bg-slate-950/70 p-3 text-xs " +
    "leading-5 text-slate-500";

  paragraph.textContent =
    text || "ไม่มีรายละเอียดเพิ่มเติม";

  container.appendChild(
    paragraph
  );
}

/* =========================================================
   CLASS MAPPING
========================================================= */

function getPredictionCategory(
  className
) {
  const normalized =
    normalizeText(className);

  const normalKeywords = [
    "normal",
    "healthy",
    "ปกติ"
  ];

  if (
    normalKeywords.some(
      function (keyword) {
        return normalized.includes(
          keyword
        );
      }
    )
  ) {
    return "normal";
  }

  const abnormalKeywords = [
    "pneumonia",
    "abnormal",
    "viral",
    "bacterial",
    "infected",
    "covid",
    "tuberculosis",
    "opacity",
    "disease",
    "ปอดอักเสบ",
    "ผิดปกติ"
  ];

  if (
    abnormalKeywords.some(
      function (keyword) {
        return normalized.includes(
          keyword
        );
      }
    )
  ) {
    return "abnormal";
  }

  return "abnormal";
}

function getDiagnosisLabel(
  className
) {
  const normalized =
    normalizeText(className);

  if (
    normalized.includes("normal") ||
    normalized.includes("healthy") ||
    normalized.includes("ปกติ")
  ) {
    return "ปอดปกติ (Normal)";
  }

  if (
    normalized.includes("viral")
  ) {
    return "Pneumonia จากเชื้อไวรัส";
  }

  if (
    normalized.includes("bacterial")
  ) {
    return "Pneumonia จากเชื้อแบคทีเรีย";
  }

  if (
    normalized.includes("pneumonia") ||
    normalized.includes("ปอดอักเสบ")
  ) {
    return "Pneumonia (ปอดอักเสบ)";
  }

  return (
    className ||
    "พบข้อสังเกตจากภาพ"
  );
}

/* =========================================================
   MAIN UI
========================================================= */

function updateInterface() {
  const total =
    state.items.length;

  const completedItems =
    state.items.filter(
      function (item) {
        return (
          item.status ===
          "completed"
        );
      }
    );

  const errorItems =
    state.items.filter(
      function (item) {
        return (
          item.status ===
          "error"
        );
      }
    );

  const processed =
    completedItems.length +
    errorItems.length;

  const normal =
    completedItems.filter(
      function (item) {
        return (
          item.category ===
          "normal"
        );
      }
    ).length;

  const abnormal =
    completedItems.filter(
      function (item) {
        return (
          item.category ===
          "abnormal"
        );
      }
    ).length;

  const queued =
    state.items.filter(
      function (item) {
        return (
          item.status === "queued" ||
          item.status === "processing"
        );
      }
    ).length;

  if (total === 0) {
    uploadEmptyState.classList.remove(
      "hidden"
    );

    uploadCompactState.classList.add(
      "hidden"
    );

    progressContainer.classList.add(
      "hidden"
    );

    toolbarContainer.classList.add(
      "hidden"
    );

    clearAllButton.classList.add(
      "hidden"
    );

    noResults.classList.add(
      "hidden"
    );

    return;
  }

  uploadEmptyState.classList.add(
    "hidden"
  );

  uploadCompactState.classList.remove(
    "hidden"
  );

  progressContainer.classList.remove(
    "hidden"
  );

  toolbarContainer.classList.remove(
    "hidden"
  );

  clearAllButton.classList.remove(
    "hidden"
  );

  selectedCount.textContent =
    String(total);

  remainingCount.textContent =
    String(MAX_FILES - total);

  processedCount.textContent =
    String(processed);

  totalAnalysisCount.textContent =
    String(total);

  normalCount.textContent =
    String(normal);

  abnormalCount.textContent =
    String(abnormal);

  queuedCount.textContent =
    String(queued);

  queueTotalCount.textContent =
    String(total);

  const percentage =
    Math.round(
      (processed / total) * 100
    );

  progressPercent.textContent =
    `${percentage}%`;

  progressBar.style.width =
    `${percentage}%`;

  if (queued > 0) {
    const currentNumber =
      Math.min(
        processed + 1,
        total
      );

    progressDescription.textContent =
      `กำลังวิเคราะห์ภาพเอกซเรย์ ` +
      `${currentNumber} จาก ${total} ภาพ`;
  } else if (
    errorItems.length > 0
  ) {
    progressDescription.textContent =
      `วิเคราะห์สำเร็จ ${completedItems.length} ภาพ ` +
      `และเกิดข้อผิดพลาด ${errorItems.length} ภาพ`;
  } else {
    progressDescription.textContent =
      "วิเคราะห์ภาพเอกซเรย์ครบแล้วทุกรายการ";
  }

  applyFiltersAndSorting();
}

/* =========================================================
   SEARCH, FILTER, SORT
========================================================= */

searchInput.addEventListener(
  "input",
  function (event) {
    state.searchKeyword =
      normalizeText(
        event.target.value
      );

    applyFiltersAndSorting();
  }
);

sortSelect.addEventListener(
  "change",
  function (event) {
    state.sortMode =
      event.target.value;

    applyFiltersAndSorting();
  }
);

filterButtons.forEach(
  function (button) {
    button.addEventListener(
      "click",
      function () {
        state.activeFilter =
          button.dataset.filter ||
          "all";

        updateFilterButtons();
        applyFiltersAndSorting();
      }
    );
  }
);

function applyFiltersAndSorting() {
  const sortedItems =
    [...state.items].sort(
      compareItems
    );

  let visibleCount = 0;

  sortedItems.forEach(
    function (item) {
      gridContainer.appendChild(
        item.card
      );

      const visible =
        matchesSearch(item) &&
        matchesFilter(item);

      item.card.classList.toggle(
        "hidden",
        !visible
      );

      if (visible) {
        visibleCount += 1;
      }
    }
  );

  noResults.classList.toggle(
    "hidden",
    state.items.length === 0 ||
    visibleCount > 0
  );
}

function matchesSearch(item) {
  if (!state.searchKeyword) {
    return true;
  }

  const searchableText =
    normalizeText(
      `${item.filename} ` +
      `${item.topClass} ` +
      `${item.diagnosis}`
    );

  return searchableText.includes(
    state.searchKeyword
  );
}

function matchesFilter(item) {
  switch (state.activeFilter) {
    case "normal":
      return (
        item.status === "completed" &&
        item.category === "normal"
      );

    case "abnormal":
      return (
        item.status === "completed" &&
        item.category === "abnormal"
      );

    case "high-risk":
      return (
        item.status === "completed" &&
        item.isHighRisk
      );

    case "all":
    default:
      return true;
  }
}

function compareItems(
  first,
  second
) {
  switch (state.sortMode) {
    case "confidence-desc":
      return (
        second.confidence -
        first.confidence
      );

    case "confidence-asc":
      return (
        first.confidence -
        second.confidence
      );

    case "filename":
      return first.filename.localeCompare(
        second.filename,
        "th"
      );

    case "upload-order":
    default:
      return (
        first.uploadOrder -
        second.uploadOrder
      );
  }
}

function updateFilterButtons() {
  filterButtons.forEach(
    function (button) {
      const active =
        button.dataset.filter ===
        state.activeFilter;

      button.classList.toggle(
        "bg-cyan-700",
        active
      );

      button.classList.toggle(
        "text-white",
        active
      );

      button.classList.toggle(
        "font-bold",
        active
      );

      button.classList.toggle(
        "text-slate-400",
        !active
      );

      button.classList.toggle(
        "font-semibold",
        !active
      );
    }
  );
}

/* =========================================================
   GRID SWITCHER
========================================================= */

gridButtons.forEach(
  function (button) {
    button.addEventListener(
      "click",
      function () {
        const columns =
          button.dataset.columns ||
          "4";

        gridContainer.dataset.columns =
          columns;

        gridButtons.forEach(
          function (currentButton) {
            const active =
              currentButton ===
              button;

            currentButton.classList.toggle(
              "bg-cyan-600",
              active
            );

            currentButton.classList.toggle(
              "text-white",
              active
            );

            currentButton.classList.toggle(
              "text-slate-400",
              !active
            );
          }
        );
      }
    );
  }
);

/* =========================================================
   DRAG AND DROP
========================================================= */

const dragCounters =
  new WeakMap();

[
  uploadEmptyState,
  uploadCompactState
].forEach(
  function (dropZone) {
    dragCounters.set(
      dropZone,
      0
    );

    dropZone.addEventListener(
      "dragenter",
      function (event) {
        preventDragDefaults(
          event
        );

        const count =
          (
            dragCounters.get(
              dropZone
            ) || 0
          ) + 1;

        dragCounters.set(
          dropZone,
          count
        );

        dropZone.classList.add(
          "border-cyan-400",
          "bg-cyan-950/30"
        );
      }
    );

    dropZone.addEventListener(
      "dragover",
      function (event) {
        preventDragDefaults(
          event
        );

        event.dataTransfer.dropEffect =
          "copy";
      }
    );

    dropZone.addEventListener(
      "dragleave",
      function (event) {
        preventDragDefaults(
          event
        );

        const count =
          Math.max(
            (
              dragCounters.get(
                dropZone
              ) || 1
            ) - 1,
            0
          );

        dragCounters.set(
          dropZone,
          count
        );

        if (count === 0) {
          removeDragHighlight(
            dropZone
          );
        }
      }
    );

    dropZone.addEventListener(
      "drop",
      function (event) {
        preventDragDefaults(
          event
        );

        dragCounters.set(
          dropZone,
          0
        );

        removeDragHighlight(
          dropZone
        );

        addFiles(
          Array.from(
            event.dataTransfer.files ||
            []
          )
        );
      }
    );
  }
);

window.addEventListener(
  "dragover",
  function (event) {
    event.preventDefault();
  }
);

window.addEventListener(
  "drop",
  function (event) {
    const isInsideUploadZone =
      uploadEmptyState.contains(
        event.target
      ) ||
      uploadCompactState.contains(
        event.target
      );

    if (!isInsideUploadZone) {
      event.preventDefault();
    }
  }
);

function preventDragDefaults(event) {
  event.preventDefault();
  event.stopPropagation();
}

function removeDragHighlight(element) {
  element.classList.remove(
    "border-cyan-400",
    "bg-cyan-950/30"
  );
}

/* =========================================================
   CLEAR ALL
========================================================= */

clearAllButton.addEventListener(
  "click",
  clearAll
);

function clearAll() {
  const confirmed =
    window.confirm(
      "ต้องการล้างภาพและผลการวิเคราะห์ทั้งหมดหรือไม่"
    );

  if (!confirmed) {
    return;
  }

  runVersion += 1;

  state.items.forEach(
    function (item) {
      window.URL.revokeObjectURL(
        item.objectURL
      );
    }
  );

  state.items = [];
  state.activeFilter = "all";
  state.searchKeyword = "";
  state.sortMode = "upload-order";

  gridContainer.innerHTML = "";
  searchInput.value = "";
  sortSelect.value =
    "upload-order";

  fileInput.value = "";

  progressBar.style.width =
    "0%";

  updateFilterButtons();
  updateInterface();
}

/* =========================================================
   HELPERS
========================================================= */

function waitForImage(image) {
  if (
    image.complete &&
    image.naturalWidth > 0
  ) {
    return Promise.resolve();
  }

  if (
    image.complete &&
    image.naturalWidth === 0
  ) {
    return Promise.reject(
      new Error(
        "ไม่สามารถเปิดไฟล์ภาพได้"
      )
    );
  }

  return new Promise(
    function (resolve, reject) {
      const handleLoad =
        function () {
          cleanup();
          resolve();
        };

      const handleError =
        function () {
          cleanup();

          reject(
            new Error(
              "ไม่สามารถเปิดไฟล์ภาพได้"
            )
          );
        };

      const cleanup =
        function () {
          image.removeEventListener(
            "load",
            handleLoad
          );

          image.removeEventListener(
            "error",
            handleError
          );
        };

      image.addEventListener(
        "load",
        handleLoad
      );

      image.addEventListener(
        "error",
        handleError
      );
    }
  );
}

function nextAnimationFrame() {
  return new Promise(
    function (resolve) {
      window.requestAnimationFrame(
        resolve
      );
    }
  );
}

function formatFileSize(bytes) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "0 KB";
  }

  if (
    bytes < 1024 * 1024
  ) {
    return (
      bytes / 1024
    ).toFixed(1) + " KB";
  }

  return (
    bytes /
    (1024 * 1024)
  ).toFixed(1) + " MB";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function showMessage(message) {
  window.alert(message);
}

/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
  "beforeunload",
  function () {
    state.items.forEach(
      function (item) {
        window.URL.revokeObjectURL(
          item.objectURL
        );
      }
    );
  }
);

/* =========================================================
   INITIALIZE
========================================================= */

updateFilterButtons();
updateInterface();
