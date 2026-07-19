// static/script.js

let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');
let stream = null;
let isScanning = false;

function setScanButtonsEnabled(enabled) {
    const scanIn = document.getElementById('scanIn');
    const scanOut = document.getElementById('scanOut');
    if (scanIn) scanIn.disabled = !enabled;
    if (scanOut) scanOut.disabled = !enabled;
}

// ========== Camera Functions ==========

document.getElementById('startCamera').addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        
        video.srcObject = stream;
        video.style.display = 'block';
        
        document.getElementById('startCamera').style.display = 'none';
        document.getElementById('scanButtons').style.display = 'block';
        
        showStatus('เปิดกล้องสำเร็จ', 'success');
    } catch (error) {
        showStatus('ไม่สามารถเปิดกล้องได้: ' + error.message, 'error');
    }
});

function captureImage() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/jpeg', 0.95);
    });
}

// ========== Scan Functions ==========

document.getElementById('scanIn').addEventListener('click', () => scanFace('IN'));
document.getElementById('scanOut').addEventListener('click', () => scanFace('OUT'));

async function scanFace(action) {
    if (isScanning) {
        showStatus('กำลังสแกนอยู่ กรุณารอ...', 'info');
        return;
    }

    isScanning = true;
    setScanButtonsEnabled(false);

    try {
        showStatus('กำลังสแกนใบหน้า... กรุณารอ', 'info', 0);
        
        const imageBlob = await captureImage();
        const formData = new FormData();
        formData.append('image', imageBlob, 'scan.jpg');
        formData.append('action', action);
        
        const response = await fetch('/api/recognize', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            const actionText = action === 'IN' ? 'เข้า' : 'ออก';
            showStatus(
                `✅ ${result.student_name} ${actionText}ห้องเรียนเรียบร้อย (${result.confidence}%)`,
                'success'
            );
            loadData();
        } else {
            showStatus('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showStatus('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
        isScanning = false;
        setScanButtonsEnabled(true);
    }
}

// ========== Add Student ==========

document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const name = document.getElementById('studentName').value;
        const imageFile = document.getElementById('studentImage').files[0];
        
        if (!name || !imageFile) {
            showStatus('กรุณากรอกข้อมูลให้ครบ', 'error');
            return;
        }
        
        showStatus('กำลังเพิ่มนักเรียน...', 'info');
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('image', imageFile);
        
        const response = await fetch('/api/students/add', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus(result.message, 'success');
            document.getElementById('addStudentForm').reset();
            loadData();
        } else {
            showStatus(result.message, 'error');
        }
    } catch (error) {
        showStatus('เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
});

// ========== Load Data ==========

async function loadStudents() {
    try {
        const response = await fetch('/api/students');
        const data = await response.json();
        
        const list = document.getElementById('studentsList');
        
        if (data.students.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">ยังไม่มีนักเรียนในระบบ</p>';
            return;
        }
        
        list.innerHTML = data.students.map(s => `
            <div class="student-item">
                <img src="/${s.image_path}" class="student-avatar" alt="${s.name}">
                <div class="flex-grow-1">
                    <strong>${s.name}</strong>
                    <br>
                    <small class="text-muted">เพิ่มเมื่อ: ${formatDate(s.created_at)}</small>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function loadHistory() {
    try {
        const response = await fetch('/api/attendance/history?limit=20');
        const data = await response.json();
        
        const list = document.getElementById('historyList');
        
        if (data.records.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">ยังไม่มีประวัติ</p>';
            return;
        }
        
        list.innerHTML = data.records.map(r => {
            const badgeClass = r.action === 'IN' ? 'bg-success' : 'bg-warning';
            const actionText = r.action === 'IN' ? 'เข้า' : 'ออก';
            
            return `
                <div class="student-item">
                    <span class="badge ${badgeClass} attendance-badge">${actionText}</span>
                    <div class="flex-grow-1">
                        <strong>${r.name}</strong>
                        <br>
                        <small class="text-muted">${formatDate(r.timestamp)}</small>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

async function loadToday() {
    try {
        const response = await fetch('/api/attendance/today');
        const data = await response.json();
        
        const list = document.getElementById('todayList');
        
        if (data.records.length === 0) {
            list.innerHTML = '<p class="text-muted text-center">ยังไม่มีคนเข้าเรียนวันนี้</p>';
            return;
        }
        
        list.innerHTML = data.records.map(r => `
            <div class="student-item">
                <i class="bi bi-check-circle-fill text-success"></i>
                <div class="flex-grow-1">
                    <strong>${r.name}</strong>
                    <br>
                    <small class="text-muted">เข้าล่าสุด: ${formatDate(r.last_seen)}</small>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading today:', error);
    }
}

function loadData() {
    loadStudents();
    loadHistory();
    loadToday();
}

// ========== Utilities ==========

function showStatus(message, type, persistMs = 5000) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message status-' + type;
    statusEl.style.display = 'block';

    if (showStatus._timer) clearTimeout(showStatus._timer);
    if (persistMs > 0) {
        showStatus._timer = setTimeout(() => {
            statusEl.style.display = 'none';
        }, persistMs);
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    // DB เก็บเวลาไทยแบบ "YYYY-MM-DD HH:MM:SS" — แปลงให้ Date parse ได้
    const normalized = String(dateString).trim().replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========== Initialize ==========
window.addEventListener('load', () => {
    loadData();
    setInterval(loadData, 30000); // Refresh ทุก 30 วินาที
});
