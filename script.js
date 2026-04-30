
// --- Dynamic PWA Manifest for Google Apps Script ---
(function () {
  const manifestData = {
    "name": "CBT Online MGMP",
    "short_name": "CBT",
    "start_url": window.location.href, // Mengunci URL GAS yang panjang
    "display": "standalone",
    "background_color": "#F5F7FF",
    "theme_color": "#1D4ED8",
    "icons": [
      {
        "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFEMEVEOCI+PHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiLz48cGF0aCBkPSJNMkEgOVYxNEMyIDE0IDcuNSAxNy41IDEyIDE5LjVDMTYuNSAxNy41IDIyIDE0IDIyIDE0VjlMMTIgMTRMMiA5WiIgb3BhY2l0eT0iMC43NSIvPjwvc3ZnPg==",
        "sizes": "192x192",
        "type": "image/svg+xml",
        "purpose": "any maskable"
      },
      {
        "src": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFEMEVEOCI+PHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiLz48cGF0aCBkPSJNMkEgOVYxNEMyIDE0IDcuNSAxNy41IDEyIDE5LjVDMTYuNSAxNy41IDIyIDE0IDIyIDE0VjlMMTIgMTRMMiA5WiIgb3BhY2l0eT0iMC43NSIvPjwvc3ZnPg==",
        "sizes": "512x512",
        "type": "image/svg+xml",
        "purpose": "any maskable"
      }
    ]
  };
  const stringManifest = JSON.stringify(manifestData);
  const encodedManifest = encodeURIComponent(stringManifest);
  const manifestURL = 'data:application/manifest+json;charset=utf-8,' + encodedManifest;
  document.getElementById('pwa-manifest').setAttribute('href', manifestURL);
})();

// --- MODAL PANDUAN ---
window.openGuideModal = function () {
  const overlay = document.getElementById('guide-overlay');
  const modal = document.getElementById('guide-modal');
  if (!overlay || !modal) return;
  overlay.style.display = 'block';
  modal.style.display = 'flex';
  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closeGuideModal = function () {
  const overlay = document.getElementById('guide-overlay');
  const modal = document.getElementById('guide-modal');
  if (!overlay || !modal) return;
  overlay.style.opacity = '0';
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }, 300);
};

// --- Global State ---
const State = {
  user: null,
  config: null,
  questions: [],
  answers: {}, // { "qID": value }
  doubts: new Set(),
  currentIndex: 0,
  timerInterval: null,
  timeRemaining: 0, // In seconds
  examActive: false,
  violations: 0,
  security: {},
  tempLogoBase64: null,
  submissionFailed: false
};

// --- School Logo & Identity Support ---
function applySchoolIdentity(iden) {
  if (!iden) return;

  if (iden.name) {
    document.title = `CBT Online – ${iden.name}`;
    safeSetText('ph-sekolah-2', iden.name);
  }

  if (iden.sub) {
    safeSetText('portal-school-sub', iden.sub);
  }

  if (iden.logo) {
    const logoImg = document.getElementById('school-logo-img');
    const defaultLogo = document.getElementById('default-logo-svg');
    if (logoImg && defaultLogo) {
      logoImg.src = iden.logo;
      logoImg.style.display = 'block';
      defaultLogo.style.display = 'none';
    }
  }
}

// Global initialization for School Identity
async function initSchoolIdentity() {
  try {
    const idenSnap = await db.ref('/config/identity').once('value');
    const iden = idenSnap.val();
    if (iden) applySchoolIdentity(iden);
  } catch (e) {
    console.warn("Failed to load school identity:", e);
  }
}

// --- Utilities ---
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showAlert(msg, type = 'danger') {
  const alertEl = document.getElementById('login-alert');
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.style.display = 'block';
  setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
}

function showLoading(text) {
  document.getElementById('loading-text').textContent = text || 'Memuat...';
  showView('loading-view');
}

function hideLoading() {
  // If we were showing the loading view, we usually want to go back to the previous view.
  // We'll just remove the 'active' class from loading-view, and ensure the current view is visible.
  // Wait, CBT uses showView() which hides others. We need a way to restore the last view or just hide the loading overlay.
  // In CBT architecture, admin-dash-view is usually the fallback.
  if (document.getElementById('admin-dash-view').classList.contains('active') === false &&
    document.getElementById('loading-view').classList.contains('active')) {
    showView('admin-dash-view');
  } else {
    document.getElementById('loading-view').classList.remove('active');
  }
}

// --- Seeded Randomizer & Shuffler ---
function getSeededRandom(seedStr) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < seedStr.length; i++) {
    k = seedStr.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  let a = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
  let b = (h2 ^ h1) >>> 0;
  let c = (h3 ^ h1) >>> 0;
  let d = (h4 ^ h1) >>> 0;
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

function shuffleArray(array, randFn) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(randFn() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// --- Local Storage Cadangan ---
function saveStateLocal() {
  if (!State.examActive || !State.config) return;
  const lsKey = `CBT_${State.user.id}_${State.config.id_ujian}`;
  const data = {
    answers: State.answers,
    doubts: Array.from(State.doubts),
    currentIndex: State.currentIndex,
    timeRemaining: State.timeRemaining,
    violations: State.violations,
    lastSavedAt: new Date().getTime()
  };
  localStorage.setItem(lsKey, JSON.stringify(data));
}

function playSiren() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'square';
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
  oscillator.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.3);
  oscillator.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.6);
  oscillator.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.9);
  oscillator.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 1.2);

  gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 1.5);
}

function handleCheatDetection() {
  if (!State.examActive || !State.security.anticheat) return;
  State.violations++;
  saveStateLocal();

  const overlay = document.getElementById('cheat-alert-overlay');
  if (overlay) overlay.style.display = 'flex';

  try { playSiren(); } catch (e) { }

  let count = 5 * State.violations;
  const countEl = document.getElementById('cheat-countdown');
  if (countEl) countEl.textContent = count;

  const iv = setInterval(() => {
    count--;
    if (countEl) countEl.textContent = count;
    if (count <= 0) {
      clearInterval(iv);
      if (overlay) overlay.style.display = 'none';
      if (State.security.fullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => { });
      }
    }
  }, 1000);

  withDB(async () => {
    await db.ref('/pelanggaran').push({
      waktu: new Date().toLocaleString('id-ID'),
      nama: State.user.name,
      userId: State.user.id,
      ujian: State.config.nama_ujian,
      examId: State.config.id_ujian,
      tipe: 'Keluar Layar/Ganti Tab'
    });
  });
}

document.addEventListener('contextmenu', e => { if (State.examActive) e.preventDefault(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && State.examActive) handleCheatDetection();
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && State.examActive && State.security.fullscreen) {
    handleCheatDetection();
  }
});
document.addEventListener('copy', e => e.preventDefault());
document.addEventListener('paste', e => e.preventDefault());

// --- Google Apps Script Promise Wrappers ---
// --- Firebase SDK Dynamic Configuration ---
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCWy2ihzu3Gk9lgryD-T8cx2V3EYGpTWYk",
  authDomain: "cbt-spensada-9cdc2.firebaseapp.com",
  databaseURL: "https://cbt-spensada-9cdc2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cbt-spensada-9cdc2",
  storageBucket: "cbt-spensada-9cdc2.firebasestorage.app",
  messagingSenderId: "491339904212",
  appId: "1:491339904212:web:bac6087e3f0059a1547741"
};

let firebaseConfig = DEFAULT_FIREBASE_CONFIG;
const savedFbConfig = localStorage.getItem('CBT_FB_CONFIG');
if (savedFbConfig) {
  try {
    firebaseConfig = JSON.parse(savedFbConfig);
    console.log("Using custom Firebase configuration from localStorage.");
  } catch (e) {
    console.error("Failed to parse saved Firebase config, using default.", e);
  }
}

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

/* ================================
   🚀 PERFORMANCE CORE PATCH
================================ */

// Memory cache (ultra cepat)
const memoryCache = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cachedGet(path) {
  if (memoryCache[path]) return memoryCache[path];
  const snap = await db.ref(path).once('value');
  const val = snap.val();
  memoryCache[path] = val;
  return val;
}

// Database caching logic (Memory Cache)
let searchTimeout = null;

/* ================================
   📦 CACHE SOAL (SUPER CEPAT)
================================ */

async function getExamDataOptimized(examId, token, forceRefresh = false) {
  const CACHE_KEY = `SOAL_${examId}`;

  if (!forceRefresh) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { }
    }
  }

  const jSnap = await db.ref('/jadwal/' + examId).once('value');
  const sch = jSnap.val();
  if (!sch) throw new Error("Ujian tidak ditemukan");

  if (sch.token && String(sch.token).toUpperCase() !== String(token).toUpperCase()) {
    throw new Error("Token salah!");
  }

  const sData = await cachedGet('/soal/' + sch.nama_soal);

  const questions = [];
  let idx = 0;

  for (let qId in sData) {
    let q = sData[qId];
    q._index = idx++;
    if (!q.opsi) q.opsi = [];
    q.id = qId;
    questions.push(q);
  }

  const result = {
    success: true,
    config: {
      id_ujian: examId,
      nama_ujian: sch.nama,
      durasi: sch.durasi,
      end_ms: sch.selesai
    },
    questions
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(result));

  return result;
}

/* ================================
   💾 AUTO SAVE (ANTI DATA HILANG)
================================ */

setInterval(() => {
  if (State.examActive) {
    saveStateLocal();
  }
}, 5000);

// Question rendering optimizations

/* ================================
   ⚡ PRELOAD NEXT SOAL
================================ */

function preloadNext(index) {
  const next = State.questions[index + 1];
  if (!next) return;

  if (next.image) {
    const img = new Image();
    img.src = next.image;
  }
}

/* ================================
   🚀 SUBMIT SUPER AMAN
================================ */

// submitExamSafe integrated into submitExam below

/* ================================
   ⏱️ TIMER RINGAN
================================ */

let lastUpdate = 0;

function updateTimerOptimized() {
  const now = Date.now();

  if (now - lastUpdate < 1000) return;
  lastUpdate = now;

  // update timer UI di sini
}

/* ================================
   🚨 CHEAT LOG LOCAL ONLY
================================ */

let cheatLogs = [];

function handleCheatDetectionOptimized() {
  cheatLogs.push({
    time: Date.now(),
    type: 'TAB_SWITCH'
  });
}

/* ================================
   🚀 INIT
================================ */
// initAutocomplete removed here, using original logic




// Initialize School Identity
initSchoolIdentity();

// --- SMART DB CONNECTION MANAGER (HIT & RUN) ---
// Trik ini membuat Firebase berjalan secara stateless seperti REST API.
// Sangat vital untuk mem-bypass limit 100 concurrent connection di versi gratis (Spark).
db.goOffline(); // Matikan koneksi bawaan seketika!

let activeDbRequests = 0;
let dbDisconnectTimer = null;

// sleep is already declared above in the Performance Core Patch

window.dbConnect = async function () {
  activeDbRequests++;
  if (activeDbRequests === 1) {
    if (dbDisconnectTimer) clearTimeout(dbDisconnectTimer);
    // Jitter: Delay acak 0-500ms untuk memecah gelombang trafik simultan
    await sleep(Math.floor(Math.random() * 500));
    db.goOnline();
  }
};

window.dbDisconnect = function () {
  activeDbRequests--;
  if (activeDbRequests <= 0) {
    activeDbRequests = 0;
    if (dbDisconnectTimer) clearTimeout(dbDisconnectTimer);
    // Jeda 1.5 detik untuk mengamankan jika ada query susulan
    dbDisconnectTimer = setTimeout(() => {
      if (activeDbRequests === 0) {
        db.goOffline();
      }
    }, 1500);
  }
};

window.withDB = async function (promiseFunc) {
  await dbConnect();
  try {
    return await promiseFunc();
  } finally {
    dbDisconnect();
  }
};

// --- AUTOMATIC FIREBASE PROTOTYPE PATCHING ---
// Mengambil alih semua metode Firebase agar otomatis nyala-mati saat dipanggil
(function patchFirebase() {
  const Ref = firebase.database.Reference.prototype;
  const methods = ['once', 'set', 'update', 'remove'];
  methods.forEach(m => {
    const original = Ref[m];
    Ref[m] = function (...args) {
      return window.withDB(() => original.apply(this, args));
    };
  });

  const originalPush = Ref.push;
  Ref.push = function (...args) {
    if (args.length > 0) return window.withDB(() => originalPush.apply(this, args));
    return originalPush.apply(this, args);
  };
})();

let isAuthReady = false;
let authPromise = auth.signInAnonymously().then(() => { isAuthReady = true; }).catch(err => console.error(err));

async function gasRun(funcName, ...args) {
  if (!isAuthReady) await authPromise;

  dbConnect();
  try {
    if (funcName === 'getAllPeserta') {
      // Cek Cache Local Storage (Valid 30 Menit)
      const CACHE_KEY = 'CBT_CACHE_PESERTA';
      const CACHE_TIME_KEY = 'CBT_CACHE_PESERTA_TIME';
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      const now = Date.now();

      if (cachedData && cachedTime && (now - cachedTime < 30 * 60 * 1000)) {
        try {
          return JSON.parse(cachedData);
        } catch (e) { localStorage.removeItem(CACHE_KEY); }
      }

      const snap = await db.ref('/peserta').once('value');
      const data = snap.val() || {};
      const results = [];
      for (let id in data) {
        const p = data[id];
        results.push({ id, name: p.nama, kelas: p.kelas });
      }

      // Simpan ke Cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(results));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
      return results;
    }

    else if (funcName === 'getSchedules') {
      const [userId, kelas] = args;
      const snap = await db.ref('/jadwal').once('value');
      const data = snap.val() || {};
      const hSnap = await db.ref('/hasil').orderByChild('userId').equalTo(userId).once('value');
      const hData = hSnap.val() || {};
      const completedSet = new Set();
      for (let k in hData) completedSet.add(hData[k].examId);

      const schedules = [];
      const nowMs = Date.now();
      for (let id in data) {
        const sch = data[id];
        let targetKelasRaw = sch.target_kelas || '';
        let matched = true;
        if (targetKelasRaw && targetKelasRaw.toLowerCase() !== 'semua' && kelas) {
          const targets = String(targetKelasRaw).split(',').map(k => k.trim().toLowerCase()).filter(k => k);
          matched = targets.some(t => kelas.toLowerCase().includes(t) || t.includes(kelas.toLowerCase()));
        }
        if (!matched) continue;

        let status = 'BELUM_MULAI';
        if (completedSet.has(id)) status = 'SELESAI';
        else if (!sch.aktif) status = 'NONAKTIF';
        else if (nowMs < sch.mulai) status = 'BELUM_MULAI';
        else if (nowMs > sch.selesai) status = 'TUTUP';
        else status = 'AKTIF';

        schedules.push({ id, nama: sch.nama, mulai: sch.mulai, selesai: sch.selesai, durasi: sch.durasi, status });
      }
      return { success: true, schedules, serverTime: nowMs };
    }

    else if (funcName === 'getPortalInfo') {
      const snap = await db.ref('/jadwal').once('value');
      const data = snap.val() || {};
      const activeSchedules = [];
      const nowMs = Date.now();
      for (let id in data) {
        if (data[id].aktif && nowMs >= data[id].mulai && nowMs <= data[id].selesai) {
          activeSchedules.push({ nama: data[id].nama, durasi: data[id].durasi });
        }
      }
      return { success: true, activeSchedules };
    }

    else if (funcName === 'getExamData') {
      const [examId, token, forceRefresh] = args;
      const jSnap = await db.ref('/jadwal/' + examId).once('value');
      const sch = jSnap.val();
      if (!sch) throw new Error("Ujian tidak ditemukan.");
      if (sch.token && String(sch.token).toUpperCase() !== String(token).toUpperCase()) throw new Error("Token salah!");

      const sSnap = await db.ref('/soal/' + sch.nama_soal).once('value');
      const sData = sSnap.val() || {};
      const questions = [];
      let idx = 0;
      for (let qId in sData) {
        let q = sData[qId];
        q._index = idx++;
        if (!q.opsi) q.opsi = []; // ensure array
        questions.push(q);
      }
      return {
        success: true,
        config: { id_ujian: examId, nama_ujian: sch.nama, durasi: sch.durasi, min_selesai: sch.min_selesai || 0, end_ms: sch.selesai },
        questions
      };
    }

    else if (funcName === 'submitExam') {
      const [payload] = args;
      const jSnap = await db.ref('/jadwal/' + payload.examId).once('value');
      const sch = jSnap.val();
      const kSnap = await db.ref('/kunci/' + sch.nama_soal).once('value');
      const kData = kSnap.val() || {};
      const sSnap = await db.ref('/soal/' + sch.nama_soal).once('value');
      const sData = sSnap.val() || {};

      let totalScore = 0; let maxScore = 0; let detailEvals = {};

      for (let qId in sData) {
        let q = sData[qId];
        let bobot = parseFloat(q.bobot) || 1;
        let correctAns = kData[qId] || '';
        let userAns = payload.answers[qId];
        let isCorrect = false;
        maxScore += bobot;

        if (!userAns) { detailEvals[qId] = { answer: '-', correct: false }; continue; }

        if (q.tipe === 'PG' || q.tipe === 'BS') {
          isCorrect = String(userAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
        } else if (q.tipe === 'KOMPLEKS') {
          if (Array.isArray(userAns)) {
            let cArr = String(correctAns).split(',').map(s => s.trim().toUpperCase()).sort();
            let uArr = userAns.map(s => String(s).trim().toUpperCase()).sort();
            isCorrect = JSON.stringify(cArr) === JSON.stringify(uArr);
          }
        } else if (q.tipe === 'ISIAN') {
          isCorrect = String(userAns).trim().toLowerCase() === String(correctAns).trim().toLowerCase();
        } else if (q.tipe === 'JODOH') {
          let cPairs = {};
          String(correctAns).split(';').forEach(p => { let pt = p.split('='); if (pt.length == 2) cPairs[pt[0].trim()] = pt[1].trim(); });
          if (typeof userAns === 'object' && !Array.isArray(userAns)) {
            let allMatch = true; let keys = Object.keys(cPairs);
            if (keys.length === 0) allMatch = false;
            for (let k of keys) { if (userAns[k] !== cPairs[k]) { allMatch = false; break; } }
            isCorrect = allMatch;
          }
        }
        if (isCorrect) totalScore += bobot;
        detailEvals[qId] = { answer: userAns, correct: isCorrect };
      }

      let finalScore = (maxScore > 0) ? (totalScore / maxScore) * 100 : 0;
      finalScore = Math.round(finalScore * 100) / 100;

      await db.ref('/hasil').push({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userId: payload.user.id,
        nama: payload.user.name,
        kelas: payload.user.kelas || '-',
        examId: payload.examId,
        namaUjian: sch.nama,
        skor: finalScore,
        waktu: payload.usedTime || '',
        detail: JSON.stringify(detailEvals)
      });

      if (payload.violations && payload.violations > 0) {
        await db.ref('/pelanggaran').push({
          timestamp: firebase.database.ServerValue.TIMESTAMP,
          userId: payload.user.id,
          nama: payload.user.name,
          examId: payload.examId,
          tipe: `Melanggar ${payload.violations} kali`
        });
      }
      return { success: true, score: finalScore };
    }

    else if (funcName === 'setStudentOnline') {
      const [examId, userId] = args;
      await db.ref(`/online_status/${examId}/${userId}`).set(firebase.database.ServerValue.TIMESTAMP);
      const bSnap = await db.ref(`/broadcasts/${examId}`).once('value');
      if (bSnap.exists()) return { success: true, broadcast: bSnap.val() };
      return { success: true };
    }

    else if (funcName === 'validateAdmin') {
      const [pwd] = args;
      const snap = await db.ref('/config/admin_pass').once('value');
      return pwd === snap.val();
    }

    else if (funcName === 'getAdminMonitoringData') {
      const activeExams = [];
      const jSnap = await db.ref('/jadwal').once('value'); const jData = jSnap.val() || {};
      const nowMs = Date.now();
      for (let id in jData) {
        if (jData[id].aktif && nowMs >= jData[id].mulai && nowMs <= jData[id].selesai) {
          activeExams.push({ id, nama: jData[id].nama, token: jData[id].token });
        }
      }
      const pSnap = await db.ref('/peserta').once('value'); const pData = pSnap.val() || {};
      const expectedPeserta = []; for (let id in pData) expectedPeserta.push({ id, nama: pData[id].nama, kelas: pData[id].kelas });

      const hSnap = await db.ref('/hasil').once('value'); const hData = hSnap.val() || {};
      const completedMap = {};
      for (let k in hData) {
        let eid = hData[k].examId, uid = hData[k].userId;
        if (!completedMap[eid]) completedMap[eid] = [];
        if (!completedMap[eid].includes(uid)) completedMap[eid].push(uid);
      }

      const oSnap = await db.ref('/online_status').once('value'); const oData = oSnap.val() || {};
      const onlineMap = {};
      for (let eid in oData) {
        onlineMap[eid] = [];
        for (let uid in oData[eid]) {
          if (nowMs - oData[eid][uid] < 300000) onlineMap[eid].push(uid);
        }
      }
      return { success: true, activeExams, peserta: expectedPeserta, completions: completedMap, onlines: onlineMap };
    }

    else if (funcName === 'getAdminJadwalFull') {
      const snap = await db.ref('/jadwal').once('value'); const data = snap.val() || {};
      const result = [];
      for (let id in data) result.push({ id, nama: data[id].nama, aktif: data[id].aktif, token: data[id].token });
      return { success: true, data: result };
    }

    else if (funcName === 'updateJadwalSistem') {
      const [id, token, status] = args;
      await db.ref(`/jadwal/${id}`).update({ token, aktif: status === 'Aktif' });
      return { success: true };
    }

    else if (funcName === 'getAdminLaporanLengkap') {
      const hSnap = await db.ref('/hasil').limitToLast(150).once('value');
      const pSnap = await db.ref('/pelanggaran').limitToLast(100).once('value');
      const hData = hSnap.val() || {}; const pData = pSnap.val() || {};

      const hasilResult = Object.values(hData).sort((a, b) => b.timestamp - a.timestamp).map(h => {
        let d = new Date(h.timestamp || Date.now());
        return {
          waktu: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          nama: h.nama, kelas: h.kelas, ujian: h.namaUjian, skor: h.skor
        };
      });

      const pelResult = Object.values(pData).sort((a, b) => b.timestamp - a.timestamp).map(p => {
        let d = new Date(p.timestamp || Date.now());
        return {
          waktu: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          nama: p.nama, ujian: p.examId, tipe: p.tipe
        };
      });
      return { success: true, hasil: hasilResult, pelanggaran: pelResult };
    }

    else if (funcName === 'sendBroadcastAdmin') {
      const [examId, pesan] = args;
      await db.ref(`/broadcasts/${examId}`).set(pesan);
      setTimeout(() => { db.ref(`/broadcasts/${examId}`).remove(); }, 600000);
      return { success: true };
    }

    else if (funcName === 'getAdminPreviewSoal') {
      const [examId] = args;
      const jSnap = await db.ref(`/jadwal/${examId}`).once('value'); const sch = jSnap.val();
      if (!sch) throw new Error("Jadwal tidak ditemukan");

      const sSnap = await db.ref(`/soal/${sch.nama_soal}`).once('value'); const sData = sSnap.val() || {};
      const kSnap = await db.ref(`/kunci/${sch.nama_soal}`).once('value'); const kData = kSnap.val() || {};

      const questions = []; let idx = 0;
      for (let qId in sData) {
        let q = sData[qId];
        q._index = idx++;
        q.kunci = kData[qId] || '';
        if (!q.opsi) q.opsi = []; // ensure array
        questions.push(q);
      }
      return { success: true, examName: sch.nama, questions };
    }

  } catch (e) {
    console.error("Firebase Error in", funcName, e);
    return { success: false, message: e.toString() };
  } finally {
    dbDisconnect();
  }
}

// searchTimeout is already declared above in the Performance Core Patch
const userNameInput = document.getElementById('userName');
const autoList = document.getElementById('autocomplete-list');
let tempSelectedUser = null;
let cachedPeserta = null;
let fetchPesertaPromise = null;

if (userNameInput) {
  userNameInput.addEventListener('focus', () => {
    // Memastikan posisi form naik saat keyboard HP muncul
    setTimeout(() => {
      userNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);

    if (!cachedPeserta && !fetchPesertaPromise) {
      fetchPesertaPromise = gasRun('getAllPeserta').then(data => {
        cachedPeserta = data;
      }).catch(() => { fetchPesertaPromise = null; });
    }
  });

  userNameInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim().toLowerCase();
    autoList.innerHTML = '';
    autoList.classList.remove('show');

    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.length < 2) return;

    searchTimeout = setTimeout(async () => {
      if (!cachedPeserta) {
        autoList.innerHTML = '<div class="autocomplete-item text-muted">Mengunduh data siswa...</div>';
        autoList.classList.add('show');
        if (!fetchPesertaPromise) {
          fetchPesertaPromise = gasRun('getAllPeserta').then(data => {
            cachedPeserta = data;
          }).catch(() => { fetchPesertaPromise = null; });
        }
        await fetchPesertaPromise;
      }

      if (!cachedPeserta) {
        autoList.innerHTML = '<div class="autocomplete-item text-muted text-danger">Gagal memuat data. Periksa koneksi internet!</div>';
        autoList.classList.add('show');
        return;
      }

      autoList.innerHTML = '';
      const queryWords = val.split(/\s+/);
      const results = [];

      for (let i = 0; i < cachedPeserta.length; i++) {
        const row = cachedPeserta[i];
        // Support tuple array [id, name, kelas] untuk kompresi data
        const p = Array.isArray(row) ? { id: String(row[0]), name: String(row[1]), kelas: String(row[2]) } : row;

        const combined = (p.id + " " + p.name + " " + p.kelas).toLowerCase();
        const isMatch = queryWords.every(word => combined.includes(word));
        if (isMatch) results.push(p);
        if (results.length >= 15) break; // Limit 15 hasil
      }

      if (results.length > 0) {
        results.forEach(p => {
          const div = document.createElement('div');
          div.className = 'autocomplete-item';
          div.textContent = p.name + ' - ' + p.kelas;
          const selectHandler = (e) => {
            e.preventDefault(); // Mencegah input kehilangan fokus terlalu cepat
            tempSelectedUser = p;
            document.getElementById('confirm-name-text').textContent = p.name + ' (' + p.kelas + ')';
            showView('login-confirm-view');
            userNameInput.value = '';
            autoList.classList.remove('show');
          };
          div.addEventListener('pointerdown', selectHandler);
          div.addEventListener('click', selectHandler);
          autoList.appendChild(div);
        });
      } else {
        autoList.innerHTML = '<div class="autocomplete-item text-muted">Nama tidak ditemukan</div>';
      }
      autoList.classList.add('show');
    }, 100); // Sangat responsif (100ms) karena filtrasinya lokal
  });
}

// Tutup list jika klik di luar
document.addEventListener('click', (e) => {
  if (userNameInput && e.target !== userNameInput) {
    if (autoList) autoList.classList.remove('show');
  }
});

safeAddListener('btnCancelLogin', 'click', () => {
  tempSelectedUser = null;
  showView('login-view');
});

safeAddListener('btnConfirmLogin', 'click', () => {
  if (tempSelectedUser) {
    State.user = tempSelectedUser;
    loadSchedules();
  }
});

let scheduleTimer = null;

async function loadSchedules() {
  document.getElementById('schedule-user-name').textContent = State.user.name + ' - ' + State.user.kelas;
  showLoading('Memeriksa Jadwal...');
  try {
    const res = await gasRun('getSchedules', State.user.id, State.user.kelas);
    if (res.success) {
      State.serverTimeOffset = (res.serverTime || Date.now()) - Date.now();
      State.schedules = res.schedules;
      State.schedules.forEach(s => s._lastRenderedStatus = s.status);
      renderSchedules();
      showView('schedule-view');

      // Auto-update UI every 1 second locally without hitting server
      if (scheduleTimer) clearInterval(scheduleTimer);
      scheduleTimer = setInterval(() => {
        if (document.getElementById('schedule-view').classList.contains('active')) {
          updateSchedulesStatus();
        } else {
          clearInterval(scheduleTimer);
        }
      }, 1000);

    } else {
      alert('Gagal memuat jadwal: ' + res.message);
      showView('login-view');
    }
  } catch (err) {
    alert('Terjadi kesalahan sinkronisasi jaringan.');
    showView('login-view');
  }
}

function updateSchedulesStatus() {
  if (!State.schedules) return;
  let changed = false;
  const nowMs = Date.now() + (State.serverTimeOffset || 0);

  State.schedules.forEach(sch => {
    let dynStatus = sch.status;
    if (sch.status === 'BELUM_MULAI' || sch.status === 'AKTIF') {
      if (nowMs < sch.mulai) dynStatus = 'BELUM_MULAI';
      else if (nowMs >= sch.mulai && nowMs <= sch.selesai) dynStatus = 'AKTIF';
      else if (nowMs > sch.selesai) dynStatus = 'TUTUP';
    }

    if (sch._lastRenderedStatus !== dynStatus) {
      sch._lastRenderedStatus = dynStatus;
      changed = true;
    }
  });

  if (changed) renderSchedules();
}

function renderSchedules() {
  const schedules = State.schedules || [];
  const container = document.getElementById('schedule-list');
  container.innerHTML = '';

  if (schedules.length === 0) {
    container.innerHTML = '<div class="alert alert-info">Belum ada ujian yang dijadwalkan untuk saat ini.</div>';
    return;
  }

  schedules.forEach(sch => {
    let badge = `<span class="badge badge-wait">Belum Mulai</span>`;
    let btnDisabled = `disabled`;
    let btnText = `Belum Waktunya`;
    let curStatus = sch._lastRenderedStatus || sch.status;

    if (curStatus === 'SELESAI') {
      badge = `<span class="badge badge-done">Selesai</span>`;
      btnText = `Sudah Dikerjakan`;
    } else if (curStatus === 'TUTUP') {
      badge = `<span class="badge badge-closed">Ditutup</span>`;
      btnText = `Waktu Ujian Habis`;
    } else if (curStatus === 'AKTIF') {
      badge = `<span class="badge badge-active">Sedang Aktif</span>`;
      btnDisabled = ``;
      btnText = `Mulai Ujian`;
    } else if (curStatus === 'NONAKTIF') {
      badge = `<span class="badge badge-closed">Non-Aktif</span>`;
      btnText = `Belum Dibuka`;
    }

    const startObj = new Date(sch.mulai);
    const endObj = new Date(sch.selesai);
    const pad = (n) => n.toString().padStart(2, '0');
    const timeStr = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())} - ${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '16px';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <h3 style="font-size: 1.1rem; margin:0; line-height: 1.3;">${sch.nama}</h3>
        <div>${badge}</div>
      </div>
      <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 16px;">⏰ ${timeStr} | ⏳ ${sch.durasi} Menit</p>
      <button class="btn btn-primary" style="width: 100%;" ${btnDisabled}>${btnText}</button>
    `;

    const btn = card.querySelector('button');
    if (!btnDisabled) {
      btn.onclick = () => {
        // Show Token Modal
        document.getElementById('token-overlay').classList.add('active');
        const modal = document.getElementById('token-modal');
        modal.style.display = 'flex';
        // trigger reflow for transition
        void modal.offsetWidth;
        modal.style.opacity = '1';
        modal.style.transform = 'translate(-50%, -50%) scale(1)';
        document.getElementById('examTokenInput').value = '';
        document.getElementById('examTokenInput').focus();

        // Setup temp handlers
        document.getElementById('btnCancelToken').onclick = closeTokenModal;
        document.getElementById('btnSubmitToken').onclick = () => {
          const tk = document.getElementById('examTokenInput').value.trim();
          if (!tk) { alert('Harap berikan token ujian!'); return; }
          closeTokenModal();
          loadDashboard(sch.id, tk);
        };
      };
    }
    container.appendChild(card);
  });
}

// Token Modal helper
function closeTokenModal() {
  const modal = document.getElementById('token-modal');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    modal.style.display = 'none';
    document.getElementById('token-overlay').classList.remove('active');
  }, 300);
}

safeAddListener('btnScheduleLogout', 'click', () => {
  State.user = null;
  document.getElementById('userName').value = '';
  document.getElementById('autocomplete-list').innerHTML = '';
  if (scheduleTimer) clearInterval(scheduleTimer);
  tempSelectedUser = null;
  showView('login-view');
});

async function loadDashboard(examId, token) {
  State.examToken = token;
  showLoading('Verifikasi Token...');
  try {
    const res = await getExamDataOptimized(examId, token);
    if (res.success) {
      State.config = res.config;

      // SHUFFLE ALGORITHM (Seeded per User + Exam)
      const seedStr = State.user.id + "_" + State.config.id_ujian;
      const randFn = getSeededRandom(seedStr);
      let rQc = res.questions;
      shuffleArray(rQc, randFn);
      rQc.forEach(q => {
        if ((q.tipe === 'PG' || q.tipe === 'KOMPLEKS') && q.opsi.length > 0) {
          shuffleArray(q.opsi, randFn);
        }
      });
      State.questions = rQc;

      // Progressive Preloading: Gambar tidak lagi dipaksakan termuat di awal secara massal 
      // demi mencegah crash jaringan saat loading bersamaan 1000 siswa.

      document.getElementById('dash-name').textContent = State.user.name;
      document.getElementById('dash-kelas').textContent = State.user.kelas;
      document.getElementById('dash-exam').textContent = State.config.nama_ujian;
      document.getElementById('dash-time').textContent = State.config.durasi + ' Menit';
      document.getElementById('dash-count').textContent = State.questions.length + ' Soal';
      // Restore LocalStorage if any
      const lsKey = `CBT_${State.user.id}_${State.config.id_ujian}`;
      const savedData = localStorage.getItem(lsKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          State.answers = parsed.answers || {};
          State.doubts = new Set(parsed.doubts || []);
          State.currentIndex = parsed.currentIndex || 0;
          State.violations = parsed.violations || 0;
          let tr = parsed.timeRemaining || (State.config.durasi * 60);
          if (parsed.lastSavedAt) {
            const diffSec = Math.floor((new Date().getTime() - parsed.lastSavedAt) / 1000);
            if (diffSec > 0) tr -= diffSec;
          }
          State.timeRemaining = tr;
        } catch (e) { }
      } else {
        State.answers = {};
        State.doubts = new Set();
        State.currentIndex = 0;
        State.violations = 0;
        State.timeRemaining = State.config.durasi * 60;
      }

      if (scheduleTimer) clearInterval(scheduleTimer);
      showView('dashboard-view');
    } else {
      alert('Error mengambil data ujian: ' + res.message);
      showView('schedule-view');
    }
  } catch (err) {
    alert('Terjadi kesalahan sinkronisasi.');
    showView('schedule-view');
  }
}

// --- Exam Flow ---
safeAddListener('btnStartExam', 'click', () => {
  State.examActive = true;
  document.getElementById('exam-title').textContent = State.config.nama_ujian;

  // Request Fullscreen
  const root = document.documentElement;
  if (root.requestFullscreen) root.requestFullscreen().catch(() => { });
  else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen().catch(() => { });

  // Awal Mulai, kirim log ke server Cache bahwa siswa Online
  gasRun('setStudentOnline', State.config.id_ujian, State.user.id).catch(() => { });

  startTimer();
  initGrid();
  renderQuestion(State.currentIndex);
  showView('exam-view');

  saveStateLocal(); // trigger initial save
});

function startTimer() {
  State.timerInterval = setInterval(() => {
    State.timeRemaining--;

    // Cek jika sudah melampaui batas waktu tutup mutlak
    const nowMs = new Date().getTime();
    if (State.config && State.config.end_ms && nowMs >= State.config.end_ms) {
      State.timeRemaining = 0;
    }

    updateTimerDisplay();

    // Auto save periodic backup every 5 seconds
    if (State.timeRemaining % 5 === 0) saveStateLocal();

    // Ping online connection status every 180 seconds to reduce server load
    if (State.timeRemaining % 180 === 0) {
      gasRun('setStudentOnline', State.config.id_ujian, State.user.id).then(res => {
        if (res && res.success && res.broadcast) {
          showBroadcastMessage(res.broadcast);
        }
      }).catch(() => { });
    }

    if (State.timeRemaining <= 0) {
      clearInterval(State.timerInterval);
      alert('Waktu ujian telah habis! Jawaban Anda akan otomatis dikirim ke server.');
      submitExam(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const t = Math.max(0, State.timeRemaining);
  const h = Math.floor(t / 3600).toString().padStart(2, '0');
  const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
  const s = (t % 60).toString().padStart(2, '0');
  document.getElementById('exam-timer').textContent = `${h}:${m}:${s}`;
}

// --- Render Logic ---
let lastForceRefresh = 0;
const REFRESH_COOLDOWN_MS = 15 * 60 * 1000; // 15 menit

safeAddListener('btnRefreshExam', 'click', async () => {
  if (!State.examActive) return;
  const now = Date.now();

  if (now - lastForceRefresh < REFRESH_COOLDOWN_MS) {
    const sisa = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastForceRefresh)) / 60000);
    alert(`Anda baru saja melakukan refresh. Harap tunggu ${sisa} menit lagi untuk mencegah beban server berlebih.`);
    return;
  }

  if (confirm("Gunakan fitur ini JIKA ADA soal atau gambar yang tidak termuat secara sempurna. Koneksi internet wajib stabil!\n\nJangan khawatir, Murni-jawaban Anda akan tetap tersimpan.\n\nYakin ingin merefresh data soal?")) {
    lastForceRefresh = now;
    showLoading('Menyegarkan Soal...');
    try {
      const res = await gasRun('getExamData', State.config.id_ujian, State.examToken, true);
      if (res.success) {
        // Re-shuffle as per user+exam seed to match the exact same question order
        const seedStr = State.user.id + "_" + State.config.id_ujian;
        const randFn = getSeededRandom(seedStr);
        let rQc = res.questions;
        shuffleArray(rQc, randFn);
        rQc.forEach(q => {
          if ((q.tipe === 'PG' || q.tipe === 'KOMPLEKS') && q.opsi.length > 0) {
            shuffleArray(q.opsi, randFn);
          }
        });
        State.questions = rQc;

        renderQuestion(State.currentIndex);
        initGrid();
        updateGridUI();

        showView('exam-view');
        alert("Penyegaran data soal berhasil! Silakan lanjutkan ujian.");
      } else {
        alert("Gagal menyegarkan soal: " + res.message);
        showView('exam-view');
      }
    } catch (err) {
      alert("Terjadi kesalahan jaringan.");
      showView('exam-view');
    }
  }
});

function renderQuestion(index) {
  if (index < 0 || index >= State.questions.length) return;
  State.currentIndex = index;
  const q = State.questions[index];

  // Progressive Preload
  for (let i = 1; i <= 2; i++) {
    const nextQ = State.questions[index + i];
    if (nextQ && nextQ.gambar && nextQ.gambar.trim() !== '') {
      const img = new Image();
      img.src = nextQ.gambar;
    }
  }

  // Modern Progress Area
  const total = State.questions.length;
  const percent = Math.round(((index + 1) / total) * 100);
  safeSetText('q-progress-text', `SOAL ${index + 1} / ${total} (${q.tipe})`);
  safeSetText('q-percentage', `${percent}%`);
  const pb = document.getElementById('q-progress-bar');
  if (pb) pb.style.width = `${percent}%`;

  // Type Badge & Instruction
  const badge = document.getElementById('q-type-badge');
  const instruction = document.getElementById('q-instruction');

  let typeLabel = 'SOAL PILIHAN GANDA';
  let instrText = 'Pilih salah satu jawaban yang menurut Anda paling benar.';
  let typeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  if (q.tipe === 'ISIAN') {
    typeLabel = 'SOAL ISIAN';
    instrText = 'Ketik jawaban berupa angka tanpa spasi atau tanda baca.';
    typeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  } else if (q.tipe === 'KOMPLEKS') {
    typeLabel = 'PILIHAN GANDA KOMPLEKS';
    instrText = 'Pilih satu atau lebih jawaban yang menurut Anda benar.';
    typeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>';
  } else if (q.tipe === 'BS') {
    typeLabel = 'BENAR / SALAH';
    instrText = 'Tentukan apakah pernyataan berikut Benar atau Salah.';
  } else if (q.tipe === 'JODOH') {
    typeLabel = 'MENJODOHKAN';
    instrText = 'Pasangkan item di sebelah kiri dengan pilihan yang sesuai di sebelah kanan.';
  }

  if (badge) badge.innerHTML = `${typeIcon}<span>${typeLabel}</span>`;
  if (instruction) {
    instruction.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><p>${instrText}</p>`;
  }

  // Question Text
  safeSetText('q-text', q.pertanyaan);

  // Render Image
  const imgContainer = document.getElementById('q-image-container');
  if (q.gambar && q.gambar.trim() !== '') {
    imgContainer.innerHTML = `<img src="${q.gambar.trim()}" class="q-image" loading="lazy" onclick="openZoomModal('${q.gambar.trim()}')" alt="Gambar Soal" />`;
    imgContainer.style.display = 'block';
  } else {
    imgContainer.style.display = 'none';
    imgContainer.innerHTML = '';
  }

  renderOptions(q);
  updateNavButtons();
  updateGridUI();

  // Update Doubt Button State
  const btnDoubt = document.getElementById('btnDoubt');
  if (btnDoubt) {
    if (State.doubts.has(q.id)) {
      btnDoubt.classList.add('active');
    } else {
      btnDoubt.classList.remove('active');
    }
  }
}

function renderOptions(q) {
  const container = document.getElementById('q-options');
  container.innerHTML = '';

  const currentAnswer = State.answers[q.id];

  if (q.tipe === 'PG' || q.tipe === 'BS') {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.opsi.forEach((opt, idx) => {
      const isSelected = currentAnswer === opt.id || currentAnswer === opt.text;
      const displayLabel = labels[idx] || (idx + 1);

      const div = document.createElement('div');
      div.className = `modern-option ${isSelected ? 'selected' : ''}`;

      let imgHTML = '';
      if (opt.gambar) {
        imgHTML = `<img src="${opt.gambar}" class="q-image" loading="lazy" style="max-height:140px; margin-top:8px; display:block;" onclick="openZoomModal('${opt.gambar}'); event.stopPropagation();" />`;
      }

      div.innerHTML = `
        <div class="option-circle"></div>
        <div class="option-label">${displayLabel}.</div>
        <div class="option-text-container" style="flex:1;">
           <div class="option-text">${opt.text}</div>
           ${imgHTML}
        </div>
      `;
      div.onclick = () => {
        State.answers[q.id] = opt.id;
        renderOptions(q);
        saveStateLocal();
      };
      container.appendChild(div);
    });
  }
  else if (q.tipe === 'KOMPLEKS') {
    const selectedArr = currentAnswer || [];
    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.opsi.forEach((opt, idx) => {
      const isSelected = selectedArr.includes(opt.id) || selectedArr.includes(opt.text);
      const displayLabel = labels[idx] || (idx + 1);
      const div = document.createElement('div');
      div.className = `modern-option ${isSelected ? 'selected' : ''}`;

      let imgHTML = '';
      if (opt.gambar) {
        imgHTML = `<img src="${opt.gambar}" class="q-image" loading="lazy" style="max-height:140px; margin-top:8px; display:block;" onclick="openZoomModal('${opt.gambar}'); event.stopPropagation();" />`;
      }

      div.innerHTML = `
        <div class="option-circle" style="border-radius: 4px;"></div>
        <div class="option-label">${displayLabel}.</div>
        <div class="option-text-container" style="flex:1;">
           <div class="option-text">${opt.text}</div>
           ${imgHTML}
        </div>
      `;
      div.onclick = (e) => {
        e.preventDefault();
        let arr = State.answers[q.id] || [];
        if (arr.includes(opt.id) || arr.includes(opt.text)) {
          arr = arr.filter(x => x !== opt.id && x !== opt.text);
        } else {
          arr.push(opt.id);
        }
        if (arr.length === 0) delete State.answers[q.id];
        else State.answers[q.id] = arr;
        renderOptions(q);
        saveStateLocal();
      };
      container.appendChild(div);
    });
  }
  else if (q.tipe === 'ISIAN') {
    const div = document.createElement('div');
    div.innerHTML = `
      <textarea class="essay-textarea" placeholder="Ketik jawaban Anda...">${currentAnswer || ''}</textarea>
    `;
    const textarea = div.querySelector('textarea');
    textarea.oninput = (e) => {
      const val = e.target.value.trim();
      if (val) State.answers[q.id] = val;
      else delete State.answers[q.id];
      saveStateLocal();
    };
    container.appendChild(div);
  }
  else if (q.tipe === 'JODOH') {
    const selectedObj = currentAnswer || {}; // { "leftItem": "rightItem" }

    q.kiri.forEach(leftText => {
      const row = document.createElement('div');
      row.className = 'matching-row';

      const lbl = document.createElement('div');
      lbl.className = 'matching-left';
      lbl.textContent = leftText;

      const sel = document.createElement('select');
      sel.className = 'matching-right';
      sel.innerHTML = `<option value="">-- Pilih --</option>`;
      q.kanan.forEach(rightText => {
        sel.innerHTML += `<option value="${rightText}" ${selectedObj[leftText] === rightText ? 'selected' : ''}>${rightText}</option>`;
      });

      sel.onchange = (e) => {
        if (!State.answers[q.id]) State.answers[q.id] = {};
        const val = e.target.value;
        if (val) {
          State.answers[q.id][leftText] = val;
        } else {
          delete State.answers[q.id][leftText];
        }
        // cleanup empty objects to trigger answered state correctly
        if (Object.keys(State.answers[q.id]).length === 0) delete State.answers[q.id];
        saveStateLocal(); // Auto-save
      };

      row.appendChild(lbl);
      row.appendChild(sel);
      container.appendChild(row);
    });
  }
}

// --- Navigation ---
safeAddListener('btnNext', 'click', () => {
  if (State.currentIndex < State.questions.length - 1) {
    if (isAnswered(State.currentIndex)) removeFromDoubt(State.currentIndex);
    renderQuestion(State.currentIndex + 1);
  }
});

safeAddListener('btnPrev', 'click', () => {
  if (State.currentIndex > 0) {
    renderQuestion(State.currentIndex - 1);
  }
});

safeAddListener('btnDoubt', 'click', () => {
  const qId = State.questions[State.currentIndex].id;
  if (State.doubts.has(qId)) {
    State.doubts.delete(qId);
  } else {
    State.doubts.add(qId);
  }
  renderQuestion(State.currentIndex); // Re-render to update UI and grid
  saveStateLocal(); // Auto-save
});

function isAnswered(index) {
  const qId = State.questions[index].id;
  return State.answers[qId] !== undefined;
}

function removeFromDoubt(index) {
  const qId = State.questions[index].id;
  State.doubts.delete(qId);
}

function updateNavButtons() {
  document.getElementById('btnPrev').disabled = State.currentIndex === 0;

  const isLast = State.currentIndex === State.questions.length - 1;
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmit');

  if (isLast || State.submissionFailed) {
    btnNext.style.display = 'none';
    btnSubmit.style.display = 'flex'; // Uses flex to match bottom-actions layout
    if (State.submissionFailed) {
      btnSubmit.classList.add('btn-pulse'); // Tambahkan efek visual jika gagal
      btnSubmit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Kirim Ulang';
    }
  } else {
    btnNext.style.display = 'flex';
    btnSubmit.style.display = 'none';
  }
}

function closeGrid() {
  const overlay = document.getElementById('overlay');
  const qGridContainer = document.getElementById('qGridContainer');
  if (overlay) overlay.classList.remove('active');
  if (qGridContainer) qGridContainer.classList.remove('open');
}

// --- Grid UI ---
function initGrid() {
  const grid = document.getElementById('qGrid');
  if (!grid) return;
  grid.innerHTML = '';
  State.questions.forEach((q, idx) => {
    const b = document.createElement('div');
    b.className = 'q-bubble';
    b.textContent = idx + 1;
    b.id = `bubble-${idx}`;
    b.onclick = () => {
      renderQuestion(idx);
      closeGrid();
    };
    grid.appendChild(b);
  });
}

function updateGridUI() {
  State.questions.forEach((q, idx) => {
    const b = document.getElementById(`bubble-${idx}`);
    if (!b) return;

    b.className = 'q-bubble'; // reset
    if (State.currentIndex === idx) b.classList.add('active');

    if (State.doubts.has(q.id)) {
      b.classList.add('doubt');
    } else if (State.answers[q.id] !== undefined) {
      b.classList.add('answered');
    }
  });
}

const overlay = document.getElementById('overlay');
const qGridContainer = document.getElementById('qGridContainer');

safeAddListener('btnGrid', 'click', () => {
  const container = document.getElementById('qGridContainer');
  const ovl = document.getElementById('overlay');
  if (container && container.classList.contains('open')) {
    closeGrid();
  } else {
    updateGridUI();
    if (ovl) ovl.classList.add('active');
    if (container) container.classList.add('open');
  }
});

safeAddListener('btnCloseGrid', 'click', closeGrid);
if (overlay) overlay.addEventListener('click', closeGrid);

// --- Submit ---
safeAddListener('btnSubmit', 'click', () => {
  // Aturan Waktu Minimal Mengerjakan (Dinamis dari Sheet Jadwal)
  const elapsedSeconds = (State.config.durasi * 60) - State.timeRemaining;
  const minLockMinutes = (State.security && State.security.minTime) ? State.security.minTime : (State.config.min_selesai || 0);

  if (minLockMinutes > 0) {
    const MINIMUM_TIME_SECONDS = minLockMinutes * 60;
    if (elapsedSeconds < MINIMUM_TIME_SECONDS) {
      const sisaTunggu = MINIMUM_TIME_SECONDS - elapsedSeconds;
      const m = Math.floor(sisaTunggu / 60);
      const s = sisaTunggu % 60;
      showCustomAlert('Tombol Selesai Terkunci', `Anda baru bisa mengakhiri ujian setelah minimal ${minLockMinutes} menit mengerjakan. Mohon tunggu ${m} menit ${s} detik lagi.`, '🔒');
      return;
    }
  }

  const unanswered = State.questions.length - Object.keys(State.answers).length;
  let msg = "Anda yakin ingin mengakhiri ujian dan mengirimkan jawaban?";
  if (unanswered > 0) {
    msg = `Terdapat ${unanswered} soal yang belum dijawab!\n\n${msg}`;
  }
  if (State.doubts.size > 0) {
    msg = `Terdapat ${State.doubts.size} soal yang ragu-ragu!\n\n${msg}`;
  }

  if (confirm(msg)) {
    submitExam(false);
  }
});

// ══════════════════════════════════════════════════════
// SUBMIT ENGINE v2 — Jitter + Auto-Retry
// Dirancang untuk menangani 1.000 auto-submit serentak
// tanpa membuat server Google crash.
// ══════════════════════════════════════════════════════

/**
 * Fungsi pembantu: menunggu N milidetik secara async (non-blocking)
 */
// sleep function is defined above near dbConnect

/**
 * Fungsi pembantu: Wrapper gasRun dengan logika Auto-Retry senyap.
 * Jika server sedang overload (error jaringan), fungsi ini akan
 * menunggu beberapa saat dan mencoba lagi tanpa menampilkan alert.
 * @param {number} maxRetries - Jumlah percobaan ulang maksimal (default: 3)
 * @param {number} retryDelayMs - Jeda tunggu antar percobaan (default: 5 detik)
 */
async function gasRunWithRetry(funcName, args, maxRetries = 3, retryDelayMs = 5000) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await gasRun(funcName, args);
      return res; // Sukses, kembalikan hasilnya
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // Tampilkan pesan menunggu yang menenangkan di Spinner
        showLoading(`Server sibuk. Percobaan ke-${attempt + 1} dari ${maxRetries}...`);
        await sleep(retryDelayMs);
      }
    }
  }
  // Semua percobaan habis, lempar error terakhir
  throw lastError;
}

async function submitExam(isAutoSubmit) {
  State.examActive = false;
  clearInterval(State.timerInterval);

  // ─── FASE 1: JITTER (Pengacak Antrean) ───────────────────────────
  // Hanya aktif jika waktu habis secara otomatis (bukan klik manual).
  // Setiap HP akan mengacak jeda uniknya sendiri antara 0-55 detik.
  // Ini memecah "Tsunami 1000 Submit" menjadi gelombang ~18 /detik.
  if (isAutoSubmit) {
    const jitterMs = Math.floor(Math.random() * 55000); // 0 - 55.000 ms
    const jitterSec = Math.ceil(jitterMs / 1000);
    showLoading(`Waktu habis. Mengirim dalam ${jitterSec} detik...`);
    await sleep(jitterMs);
  } else {
    // Manual jitter (0-2s) to prevent exact simultaneous clicks
    await sleep(Math.floor(Math.random() * 2000));
  }

  saveStateLocal(); // Pastikan jawaban terbaru tersimpan di LocalStorage sebelum kirim
  showLoading('Menyimpan jawaban ke server...');

  // ─── FASE 2: BUILD PAYLOAD ────────────────────────────────────────
  const payload = {
    examId: State.config.id_ujian,
    user: State.user,
    answers: State.answers,
    usedTime: getUsedTimeStr(),
    violations: State.violations
  };

  // ─── FASE 3: SUBMIT DENGAN AUTO-RETRY ────────────────────────────
  try {
    const res = await gasRunWithRetry('submitExam', payload, 5, 3000);
    if (res.success) {
      // Bersihkan localStorage setelah berhasil
      const lsKey = `CBT_${State.user.id}_${State.config.id_ujian}`;
      localStorage.removeItem(lsKey);
      safeSetText('result-score', res.score);
      showView('result-view');
    } else {
      // Gagal logis dari server (misal: sudah pernah submit)
      const errMsg = res.message || 'Terjadi kesalahan pada server.';
      showView('result-view');
      // Jika sudah submit sebelumnya, tetap tampilkan halaman hasil
      if (errMsg.includes('sudah')) {
        safeSetText('result-score', '✓');
      } else {
        alert('Gagal mengirim jawaban: ' + errMsg);
        showView('exam-view');
      }
    }
  } catch (err) {
    // Gagal total setelah 3x retry — beri tahu siswa
    alert('Koneksi terputus setelah beberapa percobaan!\n\nJawaban Anda masih AMAN di perangkat ini.\nSilakan tekan tombol Kirim Ulang (tombol hijau di bawah).');
    State.examActive = true;
    State.submissionFailed = true;
    updateNavButtons();
    hideLoading();
    showView('exam-view');
  }
}

function getUsedTimeStr() {
  const totalSecs = (State.config.durasi * 60) - Math.max(0, State.timeRemaining);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  return `${minutes} Menit ${seconds} Detik`;
}

// --- Image Zoom Handlers ---
window.openZoomModal = function (src) {
  const overlay = document.getElementById('zoom-overlay');
  const img = document.getElementById('zoom-image');
  if (overlay && img) {
    img.src = src;
    overlay.style.display = 'flex';
  }
};

window.closeZoomModal = function () {
  const overlay = document.getElementById('zoom-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.getElementById('zoom-image').src = '';
  }
};

safeAddListener('btnLogout', 'click', () => {
  // Refresh SPA without GAS reload
  State.user = null;
  State.answers = {};
  State.doubts = new Set();
  State.currentIndex = 0;
  State.timeRemaining = 0;
  State.examActive = false;
  State.violations = 0;
  tempSelectedUser = null;
  if (scheduleTimer) clearInterval(scheduleTimer);

  // Clear UI
  const userInp = document.getElementById('userName');
  if (userInp) userInp.value = '';
  const autoList = document.getElementById('autocomplete-list');
  if (autoList) autoList.innerHTML = '';
  safeSetText('confirm-name-text', '-');

  // Switch to Login View
  showView('login-view');
  initPortal(); // Re-init portal whenever logout
});

// --- Portal Init ---
let portalClockInterval = null;

function initPortal() {
  updateClock();
  if (!portalClockInterval) {
    portalClockInterval = setInterval(updateClock, 1000);
  }
  fetchPortalExams();

  // Load Global Security Settings
  authPromise.then(async () => {
    try {
      const snap = await db.ref('/config/security').once('value');
      State.security = snap.val() || {};

      // Load Global Identity
      try {
        await withDB(async () => {
          const idenSnap = await db.ref('/config/identity').once('value');
          const iden = idenSnap.val() || {};
          if (iden.name) {
            document.title = "CBT Online – " + iden.name;
            const ph1 = document.getElementById('ph-sekolah');
            const ph2 = document.getElementById('ph-sekolah-2');
            if (ph1) ph1.textContent = iden.name;
            if (ph2) ph2.textContent = iden.name;
          }
          if (iden.sub) {
            const subEl = document.getElementById('portal-school-sub');
            if (subEl) subEl.textContent = iden.sub;
          }
        });
      } catch (e) { console.error(e); }

      // PWA Enforcer Check (Hanya untuk Mobile)
      if (State.security.pwa) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        const hasBypass = sessionStorage.getItem('pwa_bypass_granted') === '1';
        // Jika perangkat adalah Mobile dan bukan mode standalone, maka blokir. PC dibebaskan.
        if (isMobile && !isStandalone && !hasBypass &&
          !window.location.hostname.includes('localhost') &&
          !window.location.hostname.includes('127.0.0.1')) {
          document.getElementById('pwa-blocker-overlay').style.display = 'flex';
        }
      }
    } catch (e) { console.error("Gagal memuat config keamanan", e); }
  });

  // Touchscreen Hotkey: 5x taps on the portal logo (safe to re-bind here)
  const logo = document.querySelector('.portal-logo-icon');
  if (logo && !logo._tapBound) {
    logo._tapBound = true;
    logo.addEventListener('click', () => {
      adminTapCount++;
      if (adminTapTimer) clearTimeout(adminTapTimer);
      adminTapTimer = setTimeout(() => { adminTapCount = 0; }, 1000);
      if (adminTapCount >= 5) {
        adminTapCount = 0;
        showAdminAuthModal();
      }
    });
  }
}

function updateClock() {
  const clockEl = document.getElementById('portal-clock');
  if (!clockEl) return;
  const now = new Date();

  // Custom manual formatting to ensure compatibility in old android webviews
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = days[now.getDay()];
  const date = String(now.getDate()).padStart(2, '0');
  const m = months[now.getMonth()];
  const y = now.getFullYear();
  const hr = String(now.getHours()).padStart(2, '0');
  const mn = String(now.getMinutes()).padStart(2, '0');
  const sc = String(now.getSeconds()).padStart(2, '0');

  clockEl.textContent = `${d}, ${date} ${m} ${y} - ${hr}:${mn}:${sc}`;
}

async function fetchPortalExams() {
  const container = document.getElementById('portal-active-exams');
  if (!container) return;

  try {
    const res = await gasRun('getPortalInfo');
    if (res.success) {
      if (res.activeSchedules && res.activeSchedules.length > 0) {
        container.innerHTML = res.activeSchedules.map(ex => `
          <div class="portal-exam-item">
            <div class="exam-name">📘 ${ex.nama}</div>
            <div class="exam-meta">⏱️ Durasi: ${ex.durasi} Menit</div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<div class="portal-exam-empty">Tidak ada jadwal ujian yang aktif saat ini.</div>';
      }
    } else {
      container.innerHTML = '<p class="text-muted" style="color:var(--danger);">Gagal memuat jadwal.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="color:var(--danger);">Koneksi terputus.</p>';
  }
}

// Initial Call
initPortal();

// --- ADMIN STEALTH MODE ---
let adminTapCount = 0;
let adminTapTimer = null;

// Hotkey: Ctrl + Shift + A
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    showAdminAuthModal();
  }
});

// Logo tap handler is now registered inside initPortal() to ensure DOM is ready.

function showAdminAuthModal() {
  const overlay = document.getElementById('admin-overlay');
  if (overlay) overlay.style.display = 'block';
  const modal = document.getElementById('admin-login-modal');
  modal.style.display = 'flex';
  void modal.offsetWidth;
  modal.style.opacity = '1';
  modal.style.transform = 'translate(-50%, -50%) scale(1)';
  document.getElementById('adminTokenInput').value = '';
  document.getElementById('adminTokenInput').focus();
}

function hideAdminAuthModal() {
  const modal = document.getElementById('admin-login-modal');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    modal.style.display = 'none';
    const overlay = document.getElementById('admin-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 300);
}

safeAddListener('btnCancelAdmin', 'click', hideAdminAuthModal);

safeAddListener('btnSubmitAdmin', 'click', async () => {
  const pwd = document.getElementById('adminTokenInput').value.trim();
  if (!pwd) return;
  const btn = document.getElementById('btnSubmitAdmin');
  if (btn) btn.textContent = '...';
  try {
    const res = await gasRun('validateAdmin', pwd);
    if (res) {
      hideAdminAuthModal();
      loadAdminDashboard();
    } else {
      alert("Sandi Proktor Ditolak!");
    }
  } catch (e) { alert("Network Error"); }
  if (btn) btn.textContent = 'Verifikasi';
});

safeAddListener('btnAdminLogout', 'click', () => {
  showView('login-view');
  initPortal();
});

async function loadAdminDashboard() {
  showLoading('Memuat Intelijen Proktor...');
  try {
    const res = await gasRun('getAdminMonitoringData');
    if (res.success) {
      showView('admin-dash-view');
      renderAdminDashboard(res);
    } else {
      alert("Gagal memuat monitoring: " + res.message);
      showView('login-view');
    }
  } catch (e) {
    alert("Koneksi gagal.");
    showView('login-view');
  }
}

window.adminState = { hasil: [], radar: [], monitor: null, monitorPage: {} };

function renderPaginationControls(containerId, total, perPage, current, callbackName, idParam) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="${callbackName}(${current - 1}${idParam ? ',\'' + idParam + '\'' : ''})" ${current === 1 ? 'disabled' : ''}>&laquo;</button>`;
  let start = Math.max(1, current - 2);
  let end = Math.min(totalPages, current + 2);

  if (start > 1) html += `<button class="page-btn" onclick="${callbackName}(1${idParam ? ',\'' + idParam + '\'' : ''})">1</button>${start > 2 ? '<span style="color:var(--text-muted)">...</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="${callbackName}(${i}${idParam ? ',\'' + idParam + '\'' : ''})">${i}</button>`;
  }
  if (end < totalPages) html += `${end < totalPages - 1 ? '<span style="color:var(--text-muted)">...</span>' : ''}<button class="page-btn" onclick="${callbackName}(${totalPages}${idParam ? ',\'' + idParam + '\'' : ''})">${totalPages}</button>`;
  html += `<button class="page-btn" onclick="${callbackName}(${current + 1}${idParam ? ',\'' + idParam + '\'' : ''})" ${current === totalPages ? 'disabled' : ''}>&raquo;</button>`;

  container.innerHTML = html;
}

function renderAdminDashboard(data = window.adminState.monitor) {
  window.adminState.monitor = data;
  if (!data) return;

  // 1. Render Tokens
  const tl = document.getElementById('admin-token-list');
  if (data.activeExams.length > 0) {
    tl.innerHTML = data.activeExams.map(x => `
       <div style="border-bottom:1px solid var(--border); padding-bottom:8px;">
         <div style="font-weight:600;">${x.nama}</div>
         <div style="color:var(--danger); font-family:var(--mono); font-size:1.2rem; font-weight:700; letter-spacing:2px;">${x.token}</div>
       </div>
     `).join('');
  } else { tl.innerHTML = '<p class="text-muted">Tidak ada ujian aktif.</p>'; }

  // 2. Render Monitoring
  const ml = document.getElementById('admin-monitoring-list');
  if (data.activeExams.length === 0) {
    ml.innerHTML = '<p class="text-muted">Tidak ada evaluasi kepesertaan. Jadwal ujian sedang kosong.</p>';
    return;
  }

  ml.innerHTML = data.activeExams.map(ex => {
    let selesai = 0, mengerjakan = 0, blmSelesai = 0;
    const completedSet = new Set(data.completions[ex.id] || []);

    const rRaw = data.peserta.map(p => {
      let d = 'BELUM';
      let badgeClass = 'status-belum';
      if (completedSet.has(p.id)) { d = 'SELESAI'; badgeClass = 'status-selesai'; selesai++; }
      else if (data.onlines && data.onlines[ex.id] && data.onlines[ex.id].includes(p.id)) { d = 'MENGERJAKAN'; badgeClass = 'status-online'; mengerjakan++; }
      else { blmSelesai++; }
      return { html: `<tr><td>${p.nama}</td><td>${p.kelas}</td><td><span class="status-badge ${badgeClass}">${d}</span></td></tr>`, stat: d };
    });

    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const filterRows = rRaw.filter(x => !absenMode || x.stat === 'BELUM');

    const page = window.adminState.monitorPage[ex.id] || 1;
    const perPage = 20;
    const slicedRows = filterRows.slice((page - 1) * perPage, page * perPage).map(x => x.html).join('');

    return `
       <div class="admin-exam-card">
         <h4 style="align-items:center;">
           <span>${ex.nama}</span>
           <button class="btn btn-outline" style="border-color:#38BDF8; color:#0284C7; padding:4px 10px; font-size:0.75rem;" onclick="promptBroadcast('${ex.id}')">📢 Kirim Pesan</button>
         </h4>
         <div class="admin-table-wrap">
           <table class="admin-table">
             <thead><tr><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead>
             <tbody>${slicedRows || '<tr><td colspan="3" class="text-muted text-center" style="padding:16px;">(Semua siswa sudah masuk)</td></tr>'}</tbody>
           </table>
         </div>
         <div id="admin-monitor-pg-${ex.id}" class="pagination-controls"></div>
         <div class="admin-stats" style="margin-top:12px;">
           <span>Total: <b>${data.peserta.length}</b></span>
           <span class="stat-done">Selesai: <b>${selesai}</b></span>
           <span style="color:var(--primary);">Aktif: <b>${mengerjakan}</b></span>
           <span class="stat-pending">Kosong: <b>${blmSelesai}</b></span>
         </div>
       </div>
     `;
  }).join('');

  // Render Pagination Pijakan untuk Monitor
  data.activeExams.forEach(ex => {
    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const total = absenMode ? ex.blmSelesai : data.peserta.length;
    // Re-hitung total untuk filter 
    const completedSet = new Set(data.completions[ex.id] || []);
    let rawTotal = 0;
    data.peserta.forEach(p => {
      const hasSelesai = completedSet.has(p.id);
      const hasMengerjakan = (data.onlines && data.onlines[ex.id] && data.onlines[ex.id].includes(p.id));
      const stat = hasSelesai ? 'SELESAI' : (hasMengerjakan ? 'MENGERJAKAN' : 'BELUM');
      if (!absenMode || stat === 'BELUM') rawTotal++;
    });
    renderPaginationControls(`admin-monitor-pg-${ex.id}`, rawTotal, 20, window.adminState.monitorPage[ex.id] || 1, 'changeMonitorPage', ex.id);
  });
}

function changeMonitorPage(page, examId) {
  window.adminState.monitorPage[examId] = page;
  renderAdminDashboard(window.adminState.monitor);
}

// --- Admin Super Dashboard Logic ---
document.querySelectorAll('.admin-sidebar-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.tab) return;
    document.querySelectorAll('.admin-sidebar-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'flex';

    const title = document.getElementById('admin-page-title');
    if (title) title.innerText = btn.innerText;

    if (btn.dataset.tab === 'tab-jadwal') loadAdminJadwal();
    else if (btn.dataset.tab === 'tab-siswa') loadAdminSiswa();
    else if (btn.dataset.tab === 'tab-soal') loadAdminSoal();
  });
});

async function loadAdminSiswa() {
  const tbody = document.getElementById('admin-siswa-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat data dari Firebase...</td></tr>';
  const snap = await db.ref('/peserta').once('value');
  const data = snap.val() || {};
  const keys = Object.keys(data);
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada data siswa.</td></tr>';
    return;
  }
  let html = '';
  for (let id in data) {
    html += `<tr>
           <td><strong>${id}</strong></td>
           <td>${data[id].nama}</td>
           <td>${data[id].kelas}</td>
           <td>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="editSiswa('${id}')">✏️</button>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#EF4444; border-color:#EF4444;" onclick="deleteSiswa('${id}')">🗑️</button>
           </td>
       </tr>`;
  }
  tbody.innerHTML = html;
}

async function loadAdminSoal() {
  const tbody = document.getElementById('admin-soal-tbody');
  tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Memuat data dari Firebase...</td></tr>';
  const snap = await db.ref('/soal').once('value');
  const data = snap.val() || {};
  const keys = Object.keys(data);
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Belum ada bank soal.</td></tr>';
    return;
  }
  let html = '';
  for (let bankId in data) {
    html += `<tr>
           <td><strong>${bankId}</strong> <br><small class="text-muted">${Object.keys(data[bankId]).length} soal</small></td>
           <td>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="previewSoal('${bankId}')">👀 Preview</button>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#EF4444; border-color:#EF4444;" onclick="deleteBankSoal('${bankId}')">🗑️</button>
           </td>
       </tr>`;
  }
  tbody.innerHTML = html;
}

let currentEditSiswaId = null;

window.openSiswaModal = function () {
  currentEditSiswaId = null;
  document.getElementById('siswa-modal-title').innerText = 'Tambah Siswa Baru';
  document.getElementById('siswaIdInput').value = '';
  document.getElementById('siswaIdInput').disabled = false;
  document.getElementById('siswaNamaInput').value = '';
  document.getElementById('siswaKelasInput').value = '';

  document.getElementById('siswa-overlay').style.display = 'block';
  document.getElementById('siswa-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('siswa-overlay').style.opacity = '1';
    document.getElementById('siswa-modal').style.opacity = '1';
    document.getElementById('siswa-modal').style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
}

window.closeSiswaModal = function () {
  document.getElementById('siswa-overlay').style.opacity = '0';
  document.getElementById('siswa-modal').style.opacity = '0';
  document.getElementById('siswa-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('siswa-overlay').style.display = 'none';
    document.getElementById('siswa-modal').style.display = 'none';
  }, 300);
}

window.editSiswa = async function (id) {
  showLoading('Menarik data siswa...');
  try {
    const snap = await db.ref('/peserta/' + id).once('value');
    const data = snap.val();
    hideLoading();
    if (data) {
      currentEditSiswaId = id;
      document.getElementById('siswa-modal-title').innerText = 'Edit Siswa';
      document.getElementById('siswaIdInput').value = id;
      document.getElementById('siswaIdInput').disabled = true; // prevent changing ID on edit
      document.getElementById('siswaNamaInput').value = data.nama || '';
      document.getElementById('siswaKelasInput').value = data.kelas || '';

      document.getElementById('siswa-overlay').style.display = 'block';
      document.getElementById('siswa-modal').style.display = 'flex';
      setTimeout(() => {
        document.getElementById('siswa-overlay').style.opacity = '1';
        document.getElementById('siswa-modal').style.opacity = '1';
        document.getElementById('siswa-modal').style.transform = 'translate(-50%, -50%) scale(1)';
      }, 10);
    } else {
      alert('Siswa tidak ditemukan.');
    }
  } catch (e) {
    hideLoading();
    alert('Gagal mengambil data.');
  }
}

window.saveSiswa = async function () {
  const id = document.getElementById('siswaIdInput').value.trim();
  const nama = document.getElementById('siswaNamaInput').value.trim();
  const kelas = document.getElementById('siswaKelasInput').value.trim();

  if (!id || !nama || !kelas) return alert('Semua kolom wajib diisi!');

  showLoading('Menyimpan data...');
  try {
    await db.ref('/peserta/' + id).update({ nama, kelas });
    hideLoading();
    closeSiswaModal();
    loadAdminSiswa();
  } catch (e) {
    hideLoading();
    alert('Gagal menyimpan data.');
  }
}

function openBankSoalModal() { alert('Fitur Bank Soal Builder segera hadir. Gunakan Import CSV sementara.'); }

window.deleteSiswa = async function (id) {
  if (confirm('Hapus siswa ' + id + '?')) {
    await db.ref('/peserta/' + id).remove();
    loadAdminSiswa();
  }
}
window.deleteBankSoal = async function (id) {
  if (confirm('Hapus bank soal ' + id + '? Ini juga akan menghapus kunci jawaban.')) {
    await db.ref('/soal/' + id).remove();
    await db.ref('/kunci/' + id).remove();
    loadAdminSoal();
  }
}
window.previewSoal = async function (bankId) {
  showLoading('Menarik Bank Soal...');
  try {
    const sSnap = await db.ref(`/soal/${bankId}`).once('value');
    const kSnap = await db.ref(`/kunci/${bankId}`).once('value');
    const sData = sSnap.val() || {};
    const kData = kSnap.val() || {};
    hideLoading();

    const questions = [];
    let idx = 0;
    for (let qId in sData) {
      let q = sData[qId];
      q._index = idx++;
      q.kunci = kData[qId] || '';
      if (!q.opsi) q.opsi = [];
      questions.push(q);
    }

    document.getElementById('preview-title').textContent = 'Bank Soal: ' + bankId;
    const content = document.getElementById('preview-content-area');

    PreviewState.questions = questions;
    PreviewState.currentIndex = 0;
    PreviewState.examId = bankId;

    if (questions.length === 0) {
      document.getElementById('prev-q-number').innerHTML = 'SOAL Kosong';
      document.getElementById('prev-q-text').innerHTML = '<p class="text-muted text-center" style="margin-top:40px;">Soal belum diunggah.</p>';
      document.getElementById('prev-q-options').innerHTML = '';
      document.getElementById('prev-q-image-container').style.display = 'none';
      document.getElementById('btnPrevPreview').parentElement.style.display = 'none';
    } else {
      document.getElementById('btnPrevPreview').parentElement.style.display = 'flex';
      renderPreviewQuestion(0);
    }

    const overlay = document.getElementById('preview-overlay');
    const modal = document.getElementById('admin-preview-modal');
    overlay.style.display = 'flex';
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
  } catch (e) {
    hideLoading();
    alert('Gagal mengambil data Bank Soal.');
    console.error(e);
  }
}

async function loadAdminJadwal() {
  const container = document.getElementById('admin-jadwal-list');
  const tbody = document.getElementById('admin-jadwal-tbody');

  if (container) container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 20px;">Mengunduh jadwal dari server...</p>';
  if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat data dari Firebase...</td></tr>';

  try {
    const res = await gasRun('getAdminJadwalFull');
    if (res.success) {
      if (res.data.length === 0) {
        if (container) container.innerHTML = '<p class="text-muted">Jadwal masih kosong.</p>';
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada jadwal.</td></tr>';
      } else {
        // Render List (Live Control)
        if (container) {
          container.innerHTML = res.data.map(j => `
                 <div class="admin-exam-card" style="margin-bottom:12px;">
                     <h4 style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>${j.id} - ${j.nama}</span>
                        <div>
                            <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; margin-right:4px;" onclick="openPrintModal('${j.id}', '${j.nama}')">🖨️ Cetak Presensi</button>
                            <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem;" onclick="showAdminPreview('${j.id}')">🔍 Pratinjau</button>
                        </div>
                     </h4>
                     <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-top:14px;">
                        <div style="flex:1; min-width:90px;">
                          <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">Token</label>
                          <input type="text" id="j-token-${j.id}" class="form-control" value="${j.token}" style="padding:6px 12px; font-size:0.9rem;" />
                        </div>
                        <div style="flex:1; min-width:110px;">
                          <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:4px;">Status Aktif</label>
                          <select id="j-status-${j.id}" class="form-control" style="padding:6px 12px; font-size:0.9rem;">
                             <option value="Aktif" ${j.aktif ? 'selected' : ''}>Aktif</option>
                             <option value="Tidak" ${!j.aktif ? 'selected' : ''}>Tidak Aktif</option>
                          </select>
                        </div>
                        <div style="flex-shrink:0;">
                          <button class="btn btn-warning" style="padding:6px 16px; font-size:0.85rem;" onclick="saveAdminJadwal('${j.id}')">Simpan</button>
                        </div>
                     </div>
                 </div>
               `).join('');
        }

        // Render Table
        if (tbody) {
          tbody.innerHTML = res.data.map(j => `
                 <tr>
                    <td><strong>${j.id}</strong></td>
                    <td>${j.nama}</td>
                    <td>${j.nama_soal || '-'}</td>
                    <td>
                       <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#EF4444; border-color:#EF4444;" onclick="deleteJadwal('${j.id}')">🗑️ Hapus</button>
                    </td>
                 </tr>
               `).join('');
        }
      }
    } else {
      if (container) container.innerHTML = '<p class="text-muted text-danger">Gagal memuat jadwal.</p>';
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Gagal memuat.</td></tr>';
    }
  } catch (e) {
    if (container) container.innerHTML = '<p class="text-muted text-danger">Koneksi terputus.</p>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Koneksi terputus.</td></tr>';
  }
}

window.deleteJadwal = async function (id) {
  if (confirm('Hapus jadwal ujian ' + id + '?')) {
    await db.ref('/jadwal/' + id).remove();
    loadAdminJadwal();
  }
}

async function saveAdminJadwal(id) {
  const token = document.getElementById(`j-token-${id}`).value;
  const status = document.getElementById(`j-status-${id}`).value;
  showLoading('Menyimpan ke server...');
  try {
    const res = await gasRun('updateJadwalSistem', id, token, status);
    if (res.success) {
      alert("Pembaruan jadwal sukses disimpan!");
    } else {
      alert("Gagal menyimpan: " + res.message);
    }
  } catch (e) { alert("Terjadi kesalahan jaringan."); }
  showView('admin-dash-view');
}

async function loadAdminHasil(resetPage = false) {
  const tbHasil = document.getElementById('admin-hasil-tbody');
  const tbRadar = document.getElementById('admin-radar-tbody');

  if (resetPage) {
    tbHasil.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center; padding:20px;">Menarik rekap laporan terbaru...</td></tr>';
    tbRadar.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align:center; padding:20px;">Menganalisa log kecurangan...</td></tr>';
    try {
      const res = await gasRun('getAdminLaporanLengkap');
      if (res.success) {
        window.adminState.hasil = res.hasil;
        window.adminState.radar = res.pelanggaran;
      } else {
        tbHasil.innerHTML = '<tr><td colspan="4" class="text-danger" style="text-align:center; padding:20px;">Gagal menarik data Server.</td></tr>';
        tbRadar.innerHTML = '<tr><td colspan="4" class="text-danger" style="text-align:center; padding:20px;">Gagal memuat log The Radar.</td></tr>';
        return;
      }
    } catch (e) {
      tbHasil.innerHTML = '<tr><td colspan="4" class="text-danger" style="text-align:center; padding:20px;">Koneksi terputus.</td></tr>';
      return;
    }
  }

  renderAdminHasilPage(1);
  renderAdminRadarPage(1);
}

function renderAdminHasilPage(page) {
  const perPage = 20;
  const tbHasil = document.getElementById('admin-hasil-tbody');
  const data = window.adminState.hasil || [];
  if (data.length === 0) {
    tbHasil.innerHTML = '<tr><td colspan="4" class="text-muted text-center" style="padding:20px;">Belum ada jawaban masuk.</td></tr>';
    document.getElementById('admin-hasil-pagination').innerHTML = ''; return;
  }

  const sliced = data.slice((page - 1) * perPage, page * perPage);
  tbHasil.innerHTML = sliced.map(h => `
     <tr>
       <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${h.waktu}</td>
       <td style="font-weight:600;">${h.nama} <span style="font-size:0.75rem; color:var(--text-muted); display:block;">${h.kelas}</span></td>
       <td>${h.ujian}</td>
       <td style="font-weight:700; color:#059669; font-size:1.1rem;">${h.skor}</td>
     </tr>
   `).join('');
  renderPaginationControls('admin-hasil-pagination', data.length, perPage, page, 'renderAdminHasilPage');
}

function renderAdminRadarPage(page) {
  const perPage = 20;
  const tbRadar = document.getElementById('admin-radar-tbody');
  const data = window.adminState.radar || [];
  if (data.length === 0) {
    tbRadar.innerHTML = '<tr><td colspan="4" class="text-muted text-center" style="padding:20px;">Sistem bersih & aman (Tidak ada log).</td></tr>';
    document.getElementById('admin-radar-pagination').innerHTML = ''; return;
  }

  const sliced = data.slice((page - 1) * perPage, page * perPage);
  tbRadar.innerHTML = sliced.map(r => `
     <tr>
       <td style="white-space:nowrap; font-size:0.8rem; color:var(--text-muted);">${r.waktu}</td>
       <td style="font-weight:600; color:var(--text-main);">${r.nama}</td>
       <td>${r.ujian}</td>
       <td style="color:#DC2626; font-size:0.85rem; font-weight:500;">${r.tipe}</td>
     </tr>
   `).join('');
  renderPaginationControls('admin-radar-pagination', data.length, perPage, page, 'renderAdminRadarPage');
}

// --- PENGATURAN KEAMANAN ADMIN ---
window.loadAdminSettings = async function () {
  showLoading('Memuat Pengaturan...');
  try {
    await withDB(async () => {
      const snap = await db.ref('/config/security').once('value');
      const sec = snap.val() || {};
      document.getElementById('cfgPWA').checked = !!sec.pwa;
      document.getElementById('cfgFullscreen').checked = !!sec.fullscreen;
      document.getElementById('cfgAntiCheat').checked = !!sec.anticheat;
      document.getElementById('cfgMinTime').value = sec.minTime || 0;
      document.getElementById('cfgBypassCode').value = sec.bypassCode || '';

      const idenSnap = await db.ref('/config/identity').once('value');
      const iden = idenSnap.val() || {};
      if (iden.name) document.getElementById('cfgSchoolName').value = iden.name;
      if (iden.sub) document.getElementById('cfgSchoolSub').value = iden.sub;

      // Logo Preview
      const preview = document.getElementById('cfgLogoPreview');
      if (preview) {
        preview.innerHTML = iden.logo ? `<img src="${iden.logo}">` : '<span class="text-muted" style="font-size:0.8rem;">No Logo</span>';
        State.tempLogoBase64 = iden.logo || null;
      }

      // Load Firebase Config from UI local state
      document.getElementById('fbApiKey').value = firebaseConfig.apiKey || '';
      document.getElementById('fbAuthDomain').value = firebaseConfig.authDomain || '';
      document.getElementById('fbDbUrl').value = firebaseConfig.databaseURL || '';
      document.getElementById('fbProjectId').value = firebaseConfig.projectId || '';
      document.getElementById('fbStorageBucket').value = firebaseConfig.storageBucket || '';
      document.getElementById('fbMessagingId').value = firebaseConfig.messagingSenderId || '';
      document.getElementById('fbAppId').value = firebaseConfig.appId || '';
    });
  } catch (e) {
    console.error(e);
  }
  hideLoading();
};

// Handle Logo Input Change
safeAddListener('cfgLogoInput', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 1024 * 1024) { // 1MB Limit
    alert("Ukuran file terlalu besar! Maksimal 1MB.");
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    State.tempLogoBase64 = base64;
    const preview = document.getElementById('cfgLogoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${base64}">`;
    }
  };
  reader.readAsDataURL(file);
});

window.saveAdminSettings = async function () {
  showLoading('Menyimpan...');
  try {
    await withDB(async () => {
      const sec = {
        pwa: document.getElementById('cfgPWA').checked,
        fullscreen: document.getElementById('cfgFullscreen').checked,
        anticheat: document.getElementById('cfgAntiCheat').checked,
        minTime: parseInt(document.getElementById('cfgMinTime').value) || 0,
        bypassCode: document.getElementById('cfgBypassCode').value.trim().toUpperCase() || null
      };
      await db.ref('/config/security').set(sec);

      const iden = {
        name: document.getElementById('cfgSchoolName').value.trim(),
        sub: document.getElementById('cfgSchoolSub').value.trim(),
        logo: State.tempLogoBase64
      };
      await db.ref('/config/identity').set(iden);

      // Save Firebase Config to LocalStorage (Browser specific)
      const newFbConfig = {
        apiKey: document.getElementById('fbApiKey').value.trim(),
        authDomain: document.getElementById('fbAuthDomain').value.trim(),
        databaseURL: document.getElementById('fbDbUrl').value.trim(),
        projectId: document.getElementById('fbProjectId').value.trim(),
        storageBucket: document.getElementById('fbStorageBucket').value.trim(),
        messagingSenderId: document.getElementById('fbMessagingId').value.trim(),
        appId: document.getElementById('fbAppId').value.trim()
      };

      // Only save if apiKey is present as a basic validation
      if (newFbConfig.apiKey && newFbConfig.apiKey !== firebaseConfig.apiKey) {
        if (confirm("Anda mengubah konfigurasi Firebase. Aplikasi akan dimuat ulang untuk menerapkan perubahan database. Lanjutkan?")) {
          localStorage.setItem('CBT_FB_CONFIG', JSON.stringify(newFbConfig));
          window.location.reload();
          return;
        }
      } else if (newFbConfig.apiKey) {
        localStorage.setItem('CBT_FB_CONFIG', JSON.stringify(newFbConfig));
      }
    });

    alert('Pengaturan Berhasil Disimpan! Silakan muat ulang halaman agar perubahan identitas terlihat.');
  } catch (e) {
    console.error(e);
    alert('Gagal menyimpan pengaturan.');
  }
  hideLoading();
};

window.resetFirebaseConfig = function () {
  if (confirm("Reset konfigurasi Firebase ke bawaan sistem? Aplikasi akan dimuat ulang.")) {
    localStorage.removeItem('CBT_FB_CONFIG');
    window.location.reload();
  }
};

// Fitur Eksklusif UI Proktor Baru

function toggleAbsenMode() {
  // Hanya panggil ulang render UI untuk melompati reload dari server
  const prevData = document.getElementById('admin-monitoring-list').dataset.lastRender;
  // Kita bisa mengakalinya dengan load dashboard ulang tanpa loading spinner jika memori mahal,
  // Tapi untuk cara tercepat, cukup trigger loadAdminDashboard lagi. Cache memori aman.
  loadAdminDashboard();
}

async function promptBroadcast(examId) {
  const msg = prompt("Sistem Broadcast Massal\n\nTulis pesan peringatan singkat (misal: Waktu sebentar lagi habis!). Pesan ini akan otomatis memancar di layar HP siswa maksimal 3 menit dari sekarang.\n\nPesan Anda:");
  if (msg && msg.trim() !== '') {
    showLoading('Menyiarkan Pesan...');
    try {
      const res = await gasRun('sendBroadcastAdmin', examId, msg.trim());
      if (res.success) alert("Pesan berhasil diteruskan ke jalur orbit server!");
      else alert("Gagal menyiarkan pesan.");
    } catch (ex) { alert("Kegagalan jaringan."); }
    hideLoading();
  }
}

function showBroadcastMessage(msg) {
  const el = document.createElement('div');
  el.innerHTML = `
     <div style="position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:9999; background:linear-gradient(135deg, #F59E0B, #D97706); color:white; padding:14px 24px; border-radius:12px; box-shadow:0 10px 25px rgba(217,119,6,0.4); font-weight:700; display:flex; align-items:center; gap:12px; min-width:300px; animation:slideDownDrop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;">
       <span style="font-size:1.5rem;">📢</span>
       <span style="flex:1;">${msg}</span>
       <button onclick="this.parentElement.remove()" style="background:rgba(0,0,0,0.2); border:none; color:white; padding:6px 10px; border-radius:6px; cursor:pointer;">Tutup</button>
     </div>
     <style>@keyframes slideDownDrop { 0%{top:-50px; opacity:0;} 100%{top:20px; opacity:1;} }</style>
   `;
  document.body.appendChild(el);
}

// Zero-Bandwidth File Generator
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  let csv = [];
  const rows = table.querySelectorAll('tr');

  for (let i = 0; i < rows.length; i++) {
    let row = [], cols = rows[i].querySelectorAll('td, th');
    for (let j = 0; j < cols.length; j++) {
      let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""');
      row.push('"' + data + '"');
    }
    csv.push(row.join(','));
  }

  const csvData = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(csvData);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Fitur Admin Bank Soal Preview
function hideAdminPreview() {
  const modal = document.getElementById('admin-preview-modal');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    modal.style.display = 'none';
    const overlay = document.getElementById('preview-overlay');
    if (overlay) overlay.style.display = 'none';
  }, 300);
}

let PreviewState = {
  questions: [],
  currentIndex: 0,
  examId: ''
};

window.navigatePreview = function (dir) {
  const newIdx = PreviewState.currentIndex + dir;
  if (newIdx >= 0 && newIdx < PreviewState.questions.length) {
    PreviewState.currentIndex = newIdx;
    renderPreviewQuestion(PreviewState.currentIndex);
  }
};

function renderPreviewQuestion(index) {
  const q = PreviewState.questions[index];
  if (!q) return;

  document.getElementById('prev-q-indicator').textContent = `${index + 1} / ${PreviewState.questions.length}`;

  // Edit button attached to number
  document.getElementById('prev-q-number').innerHTML = `SOAL ${index + 1} <span style="font-size:0.75rem; font-weight:normal; margin-left:6px; color:var(--text-muted);">(Tipe: ${q.tipe})</span> <button class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem; margin-left:10px;" onclick="openSoalEditModal('${PreviewState.examId}', '${q.id}')">✏️ Edit</button>`;

  document.getElementById('prev-q-text').textContent = q.pertanyaan;

  const imgContainer = document.getElementById('prev-q-image-container');
  if (q.gambar && q.gambar.trim() !== '') {
    imgContainer.innerHTML = `<img src="${q.gambar.trim()}" class="q-image" loading="lazy" onclick="openZoomModal('${q.gambar.trim()}')" alt="Gambar Soal" />`;
    imgContainer.style.display = 'block';
  } else {
    imgContainer.style.display = 'none';
    imgContainer.innerHTML = '';
  }

  renderPreviewOptions(q);

  document.getElementById('btnPrevPreview').disabled = (index === 0);
  document.getElementById('btnNextPreview').disabled = (index === PreviewState.questions.length - 1);
}

function renderPreviewOptions(q) {
  const container = document.getElementById('prev-q-options');
  container.innerHTML = '';

  if (q.tipe === 'PG' || q.tipe === 'BS') {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.opsi.forEach((opt, idx) => {
      const isCorrect = q.kunci && (String(opt.id).trim().toUpperCase() === String(q.kunci).trim().toUpperCase() || (opt.text && String(opt.text).trim().toUpperCase() === String(q.kunci).trim().toUpperCase()));
      const displayLabel = labels[idx] || (idx + 1);

      const div = document.createElement('div');
      div.className = `option-item ${isCorrect ? 'answer-correct' : ''}`;

      let imgHTML = '';
      if (opt.gambar) {
        imgHTML = `<img src="${opt.gambar}" class="q-image" loading="lazy" style="max-height:140px; margin-top:8px; display:block;" onclick="openZoomModal('${opt.gambar}'); event.stopPropagation();" />`;
      }

      div.innerHTML = `
               <div style="display:flex; align-items:flex-start; width:100%;">
                   <input type="radio" ${isCorrect ? 'checked' : ''} disabled style="margin-top:4px;">
                   <div style="margin-left:10px; width:100%;">
                       <div class="option-text" style="font-weight:600; display:inline-block; margin-right:6px; color:${isCorrect ? '#065F46' : 'inherit'}">${displayLabel}.</div>
                       <div class="option-text" style="display:inline-block; color:${isCorrect ? '#065F46' : 'inherit'}">${opt.text}</div>
                       ${imgHTML}
                   </div>
                   ${isCorrect ? '<span style="margin-left:auto;">✅</span>' : ''}
               </div>
           `;
      container.appendChild(div);
    });
  } else if (q.tipe === 'KOMPLEKS') {
    const keysArr = q.kunci ? String(q.kunci).toUpperCase().split(',').map(s => s.trim()) : [];
    const labels = ['A', 'B', 'C', 'D', 'E'];
    q.opsi.forEach((opt, idx) => {
      const isCorrect = keysArr.includes(String(opt.id).toUpperCase()) || (opt.text && keysArr.includes(String(opt.text).toUpperCase()));
      const displayLabel = labels[idx] || (idx + 1);

      const div = document.createElement('div');
      div.className = `option-item ${isCorrect ? 'answer-correct' : ''}`;

      let imgHTML = '';
      imgHTML = `<img src="${opt.gambar}" class="q-image" loading="lazy" style="max-height:140px; margin-top:8px; display:block;" onclick="openZoomModal('${opt.gambar}'); event.stopPropagation();" />`;

      div.innerHTML = `
               <div style="display:flex; align-items:flex-start; width:100%;">
                   <input type="checkbox" ${isCorrect ? 'checked' : ''} disabled style="margin-top:4px;">
                   <div style="margin-left:10px; width:100%;">
                       <div class="option-text" style="font-weight:600; display:inline-block; margin-right:6px; color:${isCorrect ? '#065F46' : 'inherit'}">${displayLabel}.</div>
                       <div class="option-text" style="display:inline-block; color:${isCorrect ? '#065F46' : 'inherit'}">${opt.text}</div>
                       ${imgHTML}
                   </div>
                   ${isCorrect ? '<span style="margin-left:auto;">✅</span>' : ''}
               </div>
           `;
      container.appendChild(div);
    });
  } else {
    const div = document.createElement('div');
    div.innerHTML = `
           <div style="padding:15px; border-radius:8px; background:#D1FAE5; border:1px solid #10B981; color:#065F46; font-weight:600; text-align:center;">
               🔑 KUNCI JAWABAN:<br>
               <span style="font-size:1.1rem; display:block; margin-top:8px;">${q.kunci || '<i>Belum diatur</i>'}</span>
           </div>
       `;
    container.appendChild(div);
  }
}

async function showAdminPreview(examId) {
  showLoading('Menarik Bank Soal...');
  try {
    const res = await gasRun('getAdminPreviewSoal', examId);
    hideLoading();

    if (res.success) {
      document.getElementById('preview-title').textContent = res.examName || examId;

      PreviewState.questions = res.questions;
      PreviewState.currentIndex = 0;
      PreviewState.examId = examId;

      if (res.questions.length === 0) {
        document.getElementById('prev-q-number').innerHTML = 'SOAL Kosong';
        document.getElementById('prev-q-text').innerHTML = '<p class="text-muted text-center" style="margin-top:40px;">Soal belum diunggah.</p>';
        document.getElementById('prev-q-options').innerHTML = '';
        document.getElementById('prev-q-image-container').style.display = 'none';
        document.getElementById('btnPrevPreview').parentElement.style.display = 'none';
      } else {
        document.getElementById('btnPrevPreview').parentElement.style.display = 'flex';
        renderPreviewQuestion(0);
      }

      const overlay = document.getElementById('preview-overlay');
      const modal = document.getElementById('admin-preview-modal');
      overlay.style.display = 'flex';
      modal.style.display = 'flex';
      // trigger flow
      setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 10);
    } else {
      alert("Gagal membaca lembar soal: " + res.message);
    }
  } catch (e) {
    hideLoading();
    alert("Koneksi bermasalah.");
  }
}

// --- Soal Edit Logic ---
window.openSoalEditModal = async function (bankId, soalId) {
  showLoading('Memuat data soal...');
  try {
    const snapSoal = await db.ref('/soal/' + bankId + '/' + soalId).once('value');
    const snapKunci = await db.ref('/kunci/' + bankId + '/' + soalId).once('value');
    const q = snapSoal.val();
    const k = snapKunci.val();
    hideLoading();

    if (q && (q.tipe === 'PG' || q.tipe === 'KOMPLEKS' || q.tipe === 'BS')) {
      document.getElementById('soalEditBankId').value = bankId;
      document.getElementById('soalEditId').value = soalId;
      document.getElementById('soalEditPertanyaan').value = q.pertanyaan || '';
      document.getElementById('soalEditGambar').value = q.gambar || '';

      const opsiContainer = document.getElementById('soalEditOpsiContainer');
      opsiContainer.innerHTML = '';

      q.opsi.forEach(opt => {
        opsiContainer.innerHTML += `
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span style="font-weight:700; width:20px;">${opt.id}</span>
                        <input type="text" id="soalEditOpsiText_${opt.id}" class="form-control" placeholder="Teks opsi" value="${opt.text || ''}" style="flex:1;">
                        <input type="text" id="soalEditOpsiGambar_${opt.id}" class="form-control" placeholder="Tautan gbr" value="${opt.gambar || ''}" style="flex:1;">
                    </div>
                `;
      });

      // Set Kunci
      const kVal = String(k || '').trim().toUpperCase();
      const selectKunci = document.getElementById('soalEditKunci');
      selectKunci.value = kVal;

      document.getElementById('soal-edit-overlay').style.display = 'block';
      document.getElementById('soal-edit-modal').style.display = 'flex';
      setTimeout(() => {
        document.getElementById('soal-edit-overlay').style.opacity = '1';
        document.getElementById('soal-edit-modal').style.opacity = '1';
        document.getElementById('soal-edit-modal').style.transform = 'translate(-50%, -50%) scale(1)';
      }, 10);
    } else {
      alert('Maaf, fitur edit cepat saat ini baru mendukung tipe Pilihan Ganda (PG), Benar-Salah (BS), dan PG Kompleks (KOMPLEKS).');
    }
  } catch (e) {
    hideLoading();
    alert('Gagal mengambil data soal.');
  }
}

window.closeSoalEditModal = function () {
  document.getElementById('soal-edit-overlay').style.opacity = '0';
  document.getElementById('soal-edit-modal').style.opacity = '0';
  document.getElementById('soal-edit-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('soal-edit-overlay').style.display = 'none';
    document.getElementById('soal-edit-modal').style.display = 'none';
  }, 300);
}

window.saveSoalEdit = async function () {
  const bankId = document.getElementById('soalEditBankId').value;
  const soalId = document.getElementById('soalEditId').value;
  const pertanyaan = document.getElementById('soalEditPertanyaan').value.trim();
  const gambar = document.getElementById('soalEditGambar').value.trim();
  const rawKunci = document.getElementById('soalEditKunci').value;

  if (!pertanyaan) return alert('Teks soal tidak boleh kosong!');
  if (!rawKunci) return alert('Kunci Jawaban tidak boleh kosong!');

  // Format the key to uppercase and remove spaces
  const kunci = String(rawKunci).toUpperCase().replace(/\s+/g, '');

  const letters = ['A', 'B', 'C', 'D'];
  let newOpsi = [];
  letters.forEach(letter => {
    const textEl = document.getElementById('soalEditOpsiText_' + letter);
    const imgEl = document.getElementById('soalEditOpsiGambar_' + letter);
    if (textEl) {
      const t = textEl.value.trim();
      const g = imgEl.value.trim();
      if (t || g) newOpsi.push({ id: letter, text: t, gambar: g });
    }
  });

  showLoading('Menyimpan perubahan...');
  try {
    await db.ref('/soal/' + bankId + '/' + soalId).update({ pertanyaan, gambar, opsi: newOpsi });
    await db.ref('/kunci/' + bankId + '/' + soalId).set(kunci);
    hideLoading();
    closeSoalEditModal();
    alert('Perubahan berhasil disimpan!');

    // Refresh the preview
    previewSoal(bankId);
  } catch (e) {
    hideLoading();
    alert('Gagal menyimpan.');
  }
}

// --- Import Logic ---
let currentImportType = '';

window.downloadTemplateExcel = function () {
  if (typeof XLSX === 'undefined') return alert('Library Excel belum dimuat, pastikan koneksi internet stabil.');
  let data = [];
  if (currentImportType === 'siswa') {
    data = [
      ["ID_SISWA", "NAMA_LENGKAP", "KELAS"],
      ["12345", "Budi Santoso", "IX A"],
      ["67890", "Siti Aminah", "IX B"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    XLSX.writeFile(wb, "Template_Siswa.xlsx");
  } else {
    data = [
      ["Jenis (PG/BS/KOMPLEKS/ISIAN/JODOH)", "Teks Pertanyaan", "Tautan Gambar Soal", "Tautan Audio/Video", "Opsi A", "Gambar A", "Opsi B", "Gambar B", "Opsi C", "Gambar C", "Opsi D", "Gambar D", "Kunci Jawaban (1=A,2=B.. atau Teks)"],
      ["PG", "Apa ibukota Indonesia?", "", "", "Bandung", "", "Surabaya", "", "Jakarta", "", "Semarang", "", "3"],
      ["PG", "Perhatikan gambar berikut. Bangun apakah ini?", "https://link-gambar.com/kubus.jpg", "", "Kubus", "", "Balok", "", "Bola", "", "Tabung", "", "1"],
      ["KOMPLEKS", "Pilih kota yang ada di Jawa Tengah", "", "", "Semarang", "", "Solo", "", "Bandung", "", "Surabaya", "", "1, 2"],
      ["BS", "Matahari terbenam di timur", "", "", "Benar", "", "Salah", "", "", "", "", "", "2"],
      ["JODOH", "Pasangkan negara dengan benuanya", "", "", "Indonesia=Asia", "", "Mesir=Afrika", "", "Jerman=Eropa", "", "", "", "(Otomatis)"],
      ["ISIAN", "15 + 25 = ?", "", "", "", "", "", "", "", "", "", "", "40"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Soal");
    XLSX.writeFile(wb, "Template_Soal.xlsx");
  }
}

window.openImportModal = function (type) {
  currentImportType = type;
  document.getElementById('import-overlay').style.display = 'block';
  document.getElementById('import-modal').style.display = 'flex';
  document.getElementById('importFileInput').value = '';

  setTimeout(() => {
    document.getElementById('import-overlay').style.opacity = '1';
    document.getElementById('import-modal').style.opacity = '1';
    document.getElementById('import-modal').style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);

  if (type === 'siswa') {
    document.getElementById('import-title').innerText = 'Import Data Siswa';
    document.getElementById('import-desc').innerText = 'Format Excel (.xlsx): Kolom A(ID), B(Nama), C(Kelas)';
    document.getElementById('import-extra-inputs').style.display = 'none';
  } else if (type === 'soal') {
    document.getElementById('import-title').innerText = 'Import Bank Soal';
    document.getElementById('import-desc').innerText = 'Gunakan Template Excel (.xlsx) Standar.';
    document.getElementById('import-extra-inputs').style.display = 'flex';
    document.getElementById('importBankId').value = '';
  }
}

window.closeImportModal = function () {
  document.getElementById('import-overlay').style.opacity = '0';
  document.getElementById('import-modal').style.opacity = '0';
  document.getElementById('import-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('import-overlay').style.display = 'none';
    document.getElementById('import-modal').style.display = 'none';
  }, 300);
}

/**
 * Extract images from XLSX using JSZip and map them to cell coordinates.
 * Returns an object { "row:col": base64DataUrl }
 */
async function extractImagesFromXLSX(arrayBuffer) {
  const stats = { rawImages: 0, drawings: 0, mapped: 0, coords: [], folders: [], hasCellImages: false, xlFiles: [] };
  if (typeof JSZip === 'undefined') return { mapping: {}, stats };
  const zip = await JSZip.loadAsync(arrayBuffer);

  const allPaths = Object.keys(zip.files);
  stats.xlFiles = allPaths.filter(p => p.startsWith("xl/")).map(p => p.split('/').pop());

  const imageMap = {};
  const mediaFiles = allPaths.filter(path => {
    const p = path.toLowerCase();
    return p.includes("media/") || p.endsWith(".jpeg") || p.endsWith(".jpg") || p.endsWith(".png") || p.endsWith(".gif");
  });
  stats.rawImages = mediaFiles.length;

  for (const path of mediaFiles) {
    const file = zip.file(path);
    if (file) {
      const blob = await file.async("base64");
      const ext = path.split('.').pop().toLowerCase();
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'gif') mime = 'image/gif';
      imageMap[path] = `data:${mime};base64,${blob}`;
      imageMap[path.split('/').pop()] = imageMap[path];
    }
  }

  const cellImageMap = {};

  // --- STRATEGY: Relationship Discovery (Brute Force) ---
  try {
    const sheetRels = allPaths.filter(p => p.toLowerCase().includes("sheet1.xml.rels"));
    const sheetXmls = allPaths.filter(p => p.toLowerCase().includes("sheet1.xml") && !p.includes(".rels"));

    if (sheetRels.length > 0 && sheetXmls.length > 0) {
      const relsXml = await zip.file(sheetRels[0]).async("string");
      const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
      const rels = {};
      const relTags = relsDoc.getElementsByTagNameNS("*", "Relationship");
      for (let rel of relTags) {
        rels[rel.getAttribute("Id")] = rel.getAttribute("Target");
      }

      const sheetXml = await zip.file(sheetXmls[0]).async("string");
      const sheetDoc = new DOMParser().parseFromString(sheetXml, "text/xml");
      const cTags = sheetDoc.getElementsByTagNameNS("*", "c");

      for (let c of cTags) {
        const r = c.getAttribute("r");
        // Check for various attributes that might link to images in non-standard files
        const rId = c.getAttribute("r:id") || c.getAttribute("id");
        if (rId && rels[rId]) {
          const target = rels[rId];
          const imgData = imageMap[target] || imageMap[target.split('/').pop()];
          if (imgData && r) {
            const colMatch = r.match(/^[A-Z]+/);
            const rowMatch = r.match(/[0-9]+/);
            if (colMatch && rowMatch) {
              let colStr = colMatch[0], col = 0;
              for (let j = 0; j < colStr.length; j++) col = col * 26 + (colStr.charCodeAt(j) - 64);
              let row = parseInt(rowMatch[0]) - 1;
              cellImageMap[`${row}:${col - 1}`] = imgData;
              stats.coords.push(`${row}:${col - 1}`);
              stats.mapped++;
            }
          }
        }
      }
    }
  } catch (e) { console.warn("Brute force rels error:", e); }

  // --- STRATEGY 2: Legacy/Standard Drawings ---
  const drawingFiles = allPaths.filter(path => path.toLowerCase().includes("drawings/") && path.endsWith(".xml") && !path.includes("_rels"));
  for (const drawingPath of drawingFiles) {
    try {
      const relsPath = drawingPath.replace(/drawings\/([^\/]+)\.xml$/, "drawings/_rels/$1.xml.rels");
      const relsFile = zip.file(relsPath);
      const rels = {};
      if (relsFile) {
        const relsXml = await relsFile.async("string");
        const relsDoc = new DOMParser().parseFromString(relsXml, "text/xml");
        const relTags = relsDoc.getElementsByTagNameNS("*", "Relationship");
        for (let rel of relTags) rels[rel.getAttribute("Id")] = rel.getAttribute("Target").replace(/^..\/media\//, "xl/media/");
      }
      const xml = await zip.file(drawingPath).async("string");
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const anchors = [...Array.from(doc.getElementsByTagNameNS("*", "twoCellAnchor")), ...Array.from(doc.getElementsByTagNameNS("*", "oneCellAnchor"))];
      anchors.forEach(anchor => {
        const rowTags = anchor.getElementsByTagNameNS("*", "row"), colTags = anchor.getElementsByTagNameNS("*", "col");
        if (rowTags.length > 0 && colTags.length > 0) {
          const row = parseInt(rowTags[0].textContent), col = parseInt(colTags[0].textContent);
          const blips = anchor.getElementsByTagNameNS("*", "blip");
          for (let blip of blips) {
            const rId = blip.getAttribute("r:embed") || blip.getAttribute("embed");
            if (rId && rels[rId]) {
              const imgData = imageMap[rels[rId]] || imageMap[rels[rId].split('/').pop()];
              if (imgData) {
                cellImageMap[`${row}:${col}`] = imgData;
                stats.coords.push(`${row}:${col}`);
                stats.mapped++;
              }
            }
          }
        }
      });
    } catch (e) { }
  }

  // --- STRATEGY 3: Sequential Fallback (Non-standard files) ---
  // If no coordinates were mapped but images exist, assign them sequentially to rows.
  // Gambar di-sort berdasarkan nama file, lalu dipasangkan ke baris soal secara berurutan.
  // Kolom 2 (C) adalah kolom gambar soal utama.
  if (stats.mapped === 0 && Object.keys(imageMap).length > 0) {
    // Get unique image entries (by basename only, to avoid counting duplicates)
    const uniqueImages = mediaFiles
      .map(p => p.split('/').pop())
      .filter((name, idx, arr) => arr.indexOf(name) === idx) // deduplicate
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    uniqueImages.forEach((name, idx) => {
      const imgData = imageMap[name];
      if (imgData) {
        // Assign to row (idx+1, since row 0 is header), col 2 (Kolom C = gambar soal)
        const rowKey = `${idx + 1}:2`;
        cellImageMap[rowKey] = imgData;
        stats.coords.push(rowKey);
        stats.mapped++;
      }
    });
  }

  return { mapping: cellImageMap, stats };
}
async function importSoalExcel(jsonData, bankId, imageMapping = {}, stats = { rawImages: 0, drawings: 0, mapped: 0 }) {
  let soalUpdates = {};
  let kunciUpdates = {};
  let count = 0;
  let warnings = [];
  const letters = ['A', 'B', 'C', 'D', 'E'];

  let headerRow = jsonData[0] || [];
  let kunciIdx = -1;
  let opsiIndices = [];

  for (let c = 0; c < headerRow.length; c++) {
    const head = String(headerRow[c]).toLowerCase();
    if (head.includes('kunci')) kunciIdx = c;
    else if (head.startsWith('opsi ') || (head.includes('pilihan') && !head.includes('kompleks'))) {
      const label = head.replace(/opsi|pilihan|\s/g, '').toUpperCase();
      if (label.length === 1 && label >= 'A' && label <= 'E') {
        let imgIdx = -1;
        if (c + 1 < headerRow.length && String(headerRow[c + 1]).toLowerCase().includes('gambar')) imgIdx = c + 1;
        opsiIndices.push({ label, textIdx: c, imgIdx });
      }
    }
  }

  if (opsiIndices.length === 0) {
    for (let j = 0; j < 5; j++) {
      let tIdx = 4 + (j * 2);
      let iIdx = 5 + (j * 2);
      if (tIdx < (kunciIdx > 0 ? kunciIdx : headerRow.length)) opsiIndices.push({ label: letters[j], textIdx: tIdx, imgIdx: iIdx });
    }
  }
  if (kunciIdx === -1) kunciIdx = 12;

  for (let i = 1; i < jsonData.length; i++) {
    let row = jsonData[i];
    if (!row || row.length === 0 || !row[1]) continue;

    let id = 'S-' + (count + 1);
    let rawJenis = String(row[0]).trim().toUpperCase();
    let tipe = 'PG';
    if (rawJenis.includes('KOMPLEKS')) tipe = 'KOMPLEKS';
    else if (rawJenis.includes('BS') || rawJenis.includes('BENAR')) tipe = 'BS';
    else if (rawJenis.includes('JODOH')) tipe = 'JODOH';
    else if (rawJenis.includes('ISIAN')) tipe = 'ISIAN';

    let pertanyaan = String(row[1]).trim();
    let gambarSoal = String(row[2] || '').trim();
    if (!gambarSoal) gambarSoal = imageMapping[`${i}:2`] || imageMapping[`${i - 1}:2`] || "";

    let opsi = [];
    opsiIndices.forEach(idxMap => {
      let teks = row[idxMap.textIdx] !== undefined ? String(row[idxMap.textIdx]).trim() : '';
      let gmb = '';
      if (idxMap.imgIdx !== -1) {
        gmb = row[idxMap.imgIdx] !== undefined ? String(row[idxMap.imgIdx]).trim() : '';
        if (!gmb) gmb = imageMapping[`${i}:${idxMap.imgIdx}`] || imageMapping[`${i - 1}:${idxMap.imgIdx}`] || "";
      }
      if (teks || gmb) opsi.push({ id: idxMap.label, text: teks, gambar: gmb });
    });

    let rawKunci = String(row[kunciIdx] || '').trim();
    let kunci = rawKunci;
    if (tipe === 'PG' || tipe === 'BS') {
      if (rawKunci === '1') kunci = 'A';
      else if (rawKunci === '2') kunci = 'B';
      else if (rawKunci === '3') kunci = 'C';
      else if (rawKunci === '4') kunci = 'D';
      else if (rawKunci === '5') kunci = 'E';
      else kunci = rawKunci.toUpperCase();
    } else if (tipe === 'KOMPLEKS') {
      kunci = String(rawKunci).split(',').map(s => {
        s = s.trim().toUpperCase();
        if (s === '1') return 'A'; if (s === '2') return 'B'; if (s === '3') return 'C'; if (s === '4') return 'D'; if (s === '5') return 'E';
        return s;
      }).filter(s => s).join(',');
    }

    let updateData = { id, tipe, pertanyaan, opsi, bobot: 1, gambar: gambarSoal };
    if (tipe === 'JODOH') {
      let kiri = []; let kanan = []; let autoKunci = [];
      opsi.forEach(o => {
        if (o.text.includes('=')) {
          let parts = o.text.split('=');
          let k = parts[0].trim(); let v = parts[1].trim();
          if (k && v) { kiri.push(k); kanan.push(v); autoKunci.push(`${k}=${v}`); }
        }
      });
      updateData.kiri = kiri; updateData.kanan = [...kanan].sort();
      kunci = autoKunci.join(';');
    }

    soalUpdates[id] = updateData;
    kunciUpdates[id] = kunci;
    count++;
  }

  if (count > 0) {
    const cleanSoal = JSON.parse(JSON.stringify(soalUpdates, (k, v) => v === undefined ? "" : v));
    const cleanKunci = JSON.parse(JSON.stringify(kunciUpdates, (k, v) => v === undefined ? "" : v));
    await db.ref('/soal/' + bankId).set(cleanSoal);
    await db.ref('/kunci/' + bankId).set(cleanKunci);

    let imgTotal = 0;
    Object.values(soalUpdates).forEach(s => {
      if (s.gambar && String(s.gambar).startsWith('data:image')) imgTotal++;
      if (s.opsi) s.opsi.forEach(o => { if (o.gambar && String(o.gambar).startsWith('data:image')) imgTotal++; });
    });

    let msg = `Berhasil import ${count} soal ke bank ${bankId}.`;
    if (imgTotal > 0) msg = `Berhasil import ${count} soal (${imgTotal} gambar terdeteksi) ke bank ${bankId}.`;
    else if (stats && stats.rawImages > 0) {
      msg += `\n\n(Info: Ditemukan ${stats.rawImages} file gambar di Excel.`;
      if (stats.coords && stats.coords.length > 0) msg += `\nKoordinat ditemukan: ${stats.coords.join(', ')}`;
      if (stats.xlFiles && stats.xlFiles.length > 0) msg += `\nIsi folder XL: ${stats.xlFiles.slice(0, 10).join(', ')}`;
      msg += `\n\nSistem mencari gambar di Kolom C dan kolom Gambar Opsi.)`;
    } else msg += `\n\n(Info: Tidak ditemukan file gambar di dalam file Excel ini.)`;

    alert(msg);
    closeImportModal();
    loadAdminSoal();
  } else alert('Gagal: Tidak ada soal valid yang ditemukan.');
}

window.processImport = async function () {
  const fileInput = document.getElementById('importFileInput');
  if (fileInput.files.length === 0) return alert('Pilih file terlebih dahulu.');

  const file = fileInput.files[0];
  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  if (isCSV) {
    reader.onload = async function (e) {
      const text = e.target.result;
      if (currentImportType === 'siswa') await importSiswaCSV(text);
      else if (currentImportType === 'soal') {
        const bankId = document.getElementById('importBankId').value.trim();
        if (!bankId) return alert('Kode Bank Soal wajib diisi!');
        await importSoalCSV(text, bankId);
      }
    };
    reader.readAsText(file);
  } else {
    reader.onload = async function (e) {
      try {
        if (typeof XLSX === 'undefined') return alert("Library Excel belum termuat, periksa koneksi internet Anda.");
        const data = new Uint8Array(e.target.result);

        let extractData = { mapping: {}, stats: { rawImages: 0, drawings: 0, mapped: 0 } };
        try {
          extractData = await extractImagesFromXLSX(e.target.result);
        } catch (imgErr) {
          console.warn("Image extraction failed:", imgErr);
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (currentImportType === 'siswa') {
          await importSiswaExcel(jsonData);
        } else if (currentImportType === 'soal') {
          const bankId = document.getElementById('importBankId').value.trim();
          if (!bankId) return alert('Kode Bank Soal wajib diisi!');
          await importSoalExcel(jsonData, bankId, extractData.mapping, extractData.stats);
        }
      } catch (err) {
        alert("Gagal membaca file Excel. Pastikan file tidak rusak.");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

async function importSiswaExcel(jsonData) {
  let count = 0;
  let updates = {};
  let warnings = [];
  for (let i = 1; i < jsonData.length; i++) { // skip header
    let row = jsonData[i];
    if (!row || row.length === 0) continue;
    if (!row[0]) {
      warnings.push(`Baris ke-${i + 1} dilewati: ID kosong.`);
      continue;
    }
    let id = String(row[0]).trim();
    updates[id] = { nama: String(row[1] || '').trim(), kelas: String(row[2] || '').trim() };
    count++;
  }
  if (count > 0) {
    await db.ref('/peserta').update(updates);
    let msg = 'Berhasil import ' + count + ' siswa.';
    if (warnings.length > 0) {
      msg += '\n\nPeringatan:\n- ' + warnings.slice(0, 5).join('\n- ');
      if (warnings.length > 5) msg += `\n...dan ${warnings.length - 5} peringatan lainnya.`;
    }
    alert(msg);
    closeImportModal();
    loadAdminSiswa();
  } else {
    alert('Gagal: Tidak ada data valid ditemukan di Excel. Pastikan ID terisi di kolom A.');
  }
}

async function importSoalExcel(jsonData, bankId, imageMapping = {}, stats = { rawImages: 0, drawings: 0, mapped: 0 }) {
  let soalUpdates = {};
  let kunciUpdates = {};
  let count = 0;
  let warnings = [];
  const letters = ['A', 'B', 'C', 'D', 'E'];

  let headerRow = jsonData[0] || [];
  let kunciIdx = -1;
  let opsiIndices = []; // [{label: 'A', textIdx: 4, imgIdx: 5}, ...]

  // Dynamic Column Mapping
  for (let c = 0; c < headerRow.length; c++) {
    const head = String(headerRow[c]).toLowerCase();
    if (head.includes('kunci')) {
      kunciIdx = c;
    } else if (head.startsWith('opsi ') || (head.includes('pilihan') && !head.includes('kompleks'))) {
      const label = head.replace(/opsi|pilihan|\s/g, '').toUpperCase();
      if (label.length === 1 && label >= 'A' && label <= 'E') {
        // Find next column for image
        let imgIdx = -1;
        if (c + 1 < headerRow.length && String(headerRow[c + 1]).toLowerCase().includes('gambar')) {
          imgIdx = c + 1;
        }
        opsiIndices.push({ label, textIdx: c, imgIdx });
      }
    }
  }

  // Fallback if dynamic mapping failed (use standard layout)
  if (opsiIndices.length === 0) {
    for (let j = 0; j < 5; j++) {
      let tIdx = 4 + (j * 2);
      let iIdx = 5 + (j * 2);
      if (tIdx < (kunciIdx > 0 ? kunciIdx : headerRow.length)) {
        opsiIndices.push({ label: letters[j], textIdx: tIdx, imgIdx: iIdx });
      }
    }
  }
  if (kunciIdx === -1) kunciIdx = 12; // final fallback

  for (let i = 1; i < jsonData.length; i++) {
    let row = jsonData[i];
    if (!row || row.length === 0) continue;

    if (!row[1]) {
      warnings.push(`Baris ke-${i + 1} dilewati: Teks soal kosong.`);
      continue;
    }

    let id = 'S-' + (count + 1);
    let rawJenis = String(row[0]).trim().toUpperCase();
    let tipe = 'PG';
    if (rawJenis.includes('KOMPLEKS')) tipe = 'KOMPLEKS';
    else if (rawJenis.includes('BS') || rawJenis.includes('BENAR')) tipe = 'BS';
    else if (rawJenis.includes('JODOH')) tipe = 'JODOH';
    else if (rawJenis.includes('ISIAN')) tipe = 'ISIAN';

    let pertanyaan = String(row[1]).trim();
    let gambarSoal = String(row[2] || '').trim();
    if (!gambarSoal) {
      // Fuzzy match: check current row and row-1 (in case image is slightly high)
      gambarSoal = imageMapping[`${i}:2`] || imageMapping[`${i - 1}:2`] || "";
    }

    let opsi = [];
    opsiIndices.forEach(idxMap => {
      let teks = row[idxMap.textIdx] !== undefined ? String(row[idxMap.textIdx]).trim() : '';
      let gmb = '';
      if (idxMap.imgIdx !== -1) {
        gmb = row[idxMap.imgIdx] !== undefined ? String(row[idxMap.imgIdx]).trim() : '';
        if (!gmb) {
          gmb = imageMapping[`${i}:${idxMap.imgIdx}`] || imageMapping[`${i - 1}:${idxMap.imgIdx}`] || "";
        }
      }
      if (teks || gmb) {
        opsi.push({ id: idxMap.label, text: teks, gambar: gmb });
      }
    });

    if (opsi.length < 2 && (tipe === 'PG' || tipe === 'BS')) {
      // Warnings handled later
    }

    let rawKunci = String(row[kunciIdx] || '').trim();
    let kunci = rawKunci;

    if (tipe === 'PG' || tipe === 'BS') {
      if (rawKunci === '1') kunci = 'A';
      else if (rawKunci === '2') kunci = 'B';
      else if (rawKunci === '3') kunci = 'C';
      else if (rawKunci === '4') kunci = 'D';
      else if (rawKunci === '5') kunci = 'E';
      else kunci = rawKunci.toUpperCase();
    } else if (tipe === 'KOMPLEKS') {
      kunci = String(rawKunci).split(',').map(s => {
        s = s.trim().toUpperCase();
        if (s === '1') return 'A'; if (s === '2') return 'B'; if (s === '3') return 'C'; if (s === '4') return 'D'; if (s === '5') return 'E';
        return s;
      }).filter(s => s).join(',');
    }

    let updateData = { id, tipe, pertanyaan, opsi, bobot: 1, gambar: gambarSoal };

    if (tipe === 'JODOH') {
      let kiri = []; let kanan = []; let autoKunci = [];
      opsi.forEach(o => {
        if (o.text.includes('=')) {
          let parts = o.text.split('=');
          let k = parts[0].trim(); let v = parts[1].trim();
          if (k && v) { kiri.push(k); kanan.push(v); autoKunci.push(`${k}=${v}`); }
        }
      });
      updateData.kiri = kiri; updateData.kanan = [...kanan].sort();
      kunci = autoKunci.join(';');
    }

    soalUpdates[id] = updateData;
    kunciUpdates[id] = kunci;
    count++;
  }

  if (count > 0) {
    // Clean data for Firebase (No undefined allowed)
    const cleanSoal = JSON.parse(JSON.stringify(soalUpdates, (k, v) => v === undefined ? "" : v));
    const cleanKunci = JSON.parse(JSON.stringify(kunciUpdates, (k, v) => v === undefined ? "" : v));

    await db.ref('/soal/' + bankId).set(cleanSoal);
    await db.ref('/kunci/' + bankId).set(cleanKunci);

    // Count detected images for summary
    let imgTotal = 0;
    Object.values(soalUpdates).forEach(s => {
      if (s.gambar && String(s.gambar).startsWith('data:image')) imgTotal++;
      if (s.opsi) {
        s.opsi.forEach(o => { if (o.gambar && String(o.gambar).startsWith('data:image')) imgTotal++; });
      }
    });

    let msg = `Berhasil import ${count} soal ke bank ${bankId}.`;
    if (imgTotal > 0) {
      msg = `Berhasil import ${count} soal (${imgTotal} gambar terdeteksi) ke bank ${bankId}.`;
    } else if (stats && stats.rawImages > 0) {
      if (stats.hasCellImages) {
        msg += `\n\n[PENTING] Terdeteksi gambar format "Place in Cell".\nSistem sedang mencoba membacanya. Jika gagal, mohon ubah ke "Place over Cells".`;
      } else {
        msg += `\n\n(Info: Ditemukan ${stats.rawImages} file gambar di Excel.`;
        if (stats.coords && stats.coords.length > 0) {
          msg += `\nKoordinat ditemukan: ${stats.coords.join(', ')}`;
        }
        if (stats.xlFiles && stats.xlFiles.length > 0) {
          msg += `\nIsi folder XL: ${stats.xlFiles.slice(0, 10).join(', ')}`;
        }
        msg += `\n\nSistem mencari gambar di Kolom C (Index 2) dan kolom Gambar Opsi. Pastikan gambar diletakkan tepat di dalam sel tersebut.)`;
      }
    } else {
      msg += `\n\n(Info: Tidak ditemukan file gambar di dalam file Excel ini.)`;
    }

    alert(msg);
    closeImportModal();
    loadAdminSoal();
  } else {
    alert('Gagal: Tidak ada soal valid yang ditemukan.');
  }
}

async function importSiswaCSV(csvText) {
  const lines = csvText.split('\n');
  let count = 0;
  let updates = {};
  for (let i = 1; i < lines.length; i++) { // skip header
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      let id = cols[0];
      updates[id] = { nama: cols[1], kelas: cols[2] };
      count++;
    }
  }
  if (count > 0) {
    await db.ref('/peserta').update(updates);
    alert('Berhasil import ' + count + ' siswa.');
    closeImportModal();
    loadAdminSiswa();
  } else {
    alert('Tidak ada data valid ditemukan di CSV. Pastikan ada Header di baris 1.');
  }
}

async function importSoalCSV(csvText, bankId) {
  const lines = csvText.split('\n');
  let soalUpdates = {};
  let kunciUpdates = {};
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(';').map(c => c.trim());

    if (cols.length >= 8) {
      let id = cols[0] || ('S-' + (count + 1));
      let tipe = cols[1] || 'PG';
      let pertanyaan = cols[2];
      let opsi = [
        { id: 'A', text: cols[3] },
        { id: 'B', text: cols[4] },
        { id: 'C', text: cols[5] },
        { id: 'D', text: cols[6] }
      ].filter(o => o.text);

      let kunci = cols[7];
      let bobot = parseFloat(cols[8] || '1');

      soalUpdates[id] = { id, tipe, pertanyaan, opsi, bobot, gambar: "" };
      kunciUpdates[id] = kunci;
      count++;
    }
  }
  if (count > 0) {
    await db.ref('/soal/' + bankId).set(soalUpdates);
    await db.ref('/kunci/' + bankId).set(kunciUpdates);
    alert('Berhasil import ' + count + ' soal ke bank ' + bankId + '.');
    closeImportModal();
    loadAdminSoal();
  } else {
    alert('Data kosong atau salah format. Pastikan gunakan titik koma (;) sebagai pemisah.');
  }
}
// --- Jadwal Builder Logic ---
window.openJadwalModal = async function () {
  document.getElementById('jadwal-overlay').style.display = 'block';
  document.getElementById('jadwal-modal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('jadwal-overlay').style.opacity = '1';
    document.getElementById('jadwal-modal').style.opacity = '1';
    document.getElementById('jadwal-modal').style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);

  // Load Bank Soal into select
  const select = document.getElementById('jSoal');
  select.innerHTML = '<option value="">Memuat...</option>';
  const snap = await db.ref('/soal').once('value');
  const data = snap.val() || {};
  let options = '<option value="">-- Pilih Bank Soal --</option>';
  for (let id in data) {
    options += '<option value="' + id + '">' + id + ' (' + Object.keys(data[id]).length + ' soal)<\/option>';
  }
  select.innerHTML = options;

  // Clear inputs
  document.getElementById('jId').value = '';
  document.getElementById('jNama').value = '';
  document.getElementById('jDurasi').value = '60';
  document.getElementById('jKelas').value = '';
  document.getElementById('jMulai').value = '';
  document.getElementById('jSelesai').value = '';
}

window.closeJadwalModal = function () {
  document.getElementById('jadwal-overlay').style.opacity = '0';
  document.getElementById('jadwal-modal').style.opacity = '0';
  document.getElementById('jadwal-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('jadwal-overlay').style.display = 'none';
    document.getElementById('jadwal-modal').style.display = 'none';
  }, 300);
}

window.saveJadwal = async function () {
  const id = document.getElementById('jId').value.trim();
  const nama = document.getElementById('jNama').value.trim();
  const soal = document.getElementById('jSoal').value;
  const durasi = parseInt(document.getElementById('jDurasi').value);
  const kelas = document.getElementById('jKelas').value.trim();
  const mulaiStr = document.getElementById('jMulai').value;
  const selesaiStr = document.getElementById('jSelesai').value;

  if (!id || !nama || !soal || !mulaiStr || !selesaiStr) {
    return alert('Harap isi semua field yang wajib!');
  }

  const mulaiMs = new Date(mulaiStr).getTime();
  const selesaiMs = new Date(selesaiStr).getTime();

  if (mulaiMs >= selesaiMs) {
    return alert('Waktu selesai harus lebih besar dari waktu mulai.');
  }

  const token = Math.random().toString(36).substring(2, 8).toUpperCase();

  const payload = {
    nama: nama,
    nama_soal: soal,
    durasi: durasi,
    target_kelas: kelas,
    mulai: mulaiMs,
    selesai: selesaiMs,
    aktif: true,
    token: token,
    min_selesai: 0
  };

  await db.ref('/jadwal/' + id).set(payload);
  alert('Jadwal berhasil disimpan!');
  closeJadwalModal();
  loadAdminJadwal();
}

// --- FITUR CETAK BERITA ACARA & PRESENSI ---
window.openPrintModal = async function (examId, examName) {
  document.getElementById('printExamId').value = examId;
  document.getElementById('printExamName').value = examName || examId;

  // Reset inputs
  document.getElementById('printTanggal').value = '';
  document.getElementById('printRuang').value = '';
  document.getElementById('printPengawas').value = '';
  document.getElementById('printProktor').value = '';

  const selKelas = document.getElementById('printKelas');
  selKelas.innerHTML = '<option value="">-- Memuat Kelas... --</option>';

  const overlay = document.getElementById('print-overlay');
  const modal = document.getElementById('print-config-modal');
  overlay.style.display = 'block';
  modal.style.display = 'flex';
  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);

  // Fetch distinct classes
  try {
    const snap = await db.ref('/peserta').once('value');
    const data = snap.val() || {};
    const kelasSet = new Set();
    for (let key in data) {
      if (data[key].kelas) kelasSet.add(data[key].kelas);
    }

    let html = '<option value="ALL">-- Cetak Semua Kelas --</option>';
    Array.from(kelasSet).sort().forEach(k => {
      html += `<option value="${k}">${k}</option>`;
    });
    selKelas.innerHTML = html;
  } catch (e) {
    selKelas.innerHTML = '<option value="ALL">-- Cetak Semua Kelas --</option>';
  }
}

window.closePrintModal = function () {
  const overlay = document.getElementById('print-overlay');
  const modal = document.getElementById('print-config-modal');
  overlay.style.opacity = '0';
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }, 300);
}

window.executePrint = async function () {
  const examId = document.getElementById('printExamId').value;
  const examName = document.getElementById('printExamName').value;
  const selectedKelas = document.getElementById('printKelas').value;
  let rawTanggal = document.getElementById('printTanggal').value;
  let tanggal = '-';
  if (rawTanggal) {
    const d = new Date(rawTanggal);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    tanggal = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  const ruang = document.getElementById('printRuang').value || '-';
  const pengawas = document.getElementById('printPengawas').value || '-';
  const proktor = document.getElementById('printProktor').value || '-';

  showLoading('Menyiapkan dokumen...');
  try {
    // Fetch students
    const snap = await db.ref('/peserta').once('value');
    const data = snap.val() || {};

    let targetStudents = [];
    for (let key in data) {
      let s = data[key];
      if (selectedKelas === 'ALL' || s.kelas === selectedKelas) {
        targetStudents.push({ id: key, nama: s.nama, kelas: s.kelas });
      }
    }

    // Sort alphabetically
    targetStudents.sort((a, b) => a.nama.localeCompare(b.nama));

    // Fill Berita Acara
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = new Date();
    safeSetText('pb-hari', days[today.getDay()]);
    safeSetText('pb-tanggal', tanggal);
    safeSetText('pb-mapel', examName);
    safeSetText('pb-kelas', selectedKelas === 'ALL' ? 'Semua Kelas' : selectedKelas);
    safeSetText('pb-ruang', ruang);

    safeSetText('pb-jml-total', targetStudents.length);
    safeSetText('pb-jml-hadir', '...');
    safeSetText('pb-jml-absen', '...');

    safeSetText('pb-ttd-proktor', proktor);
    safeSetText('pb-ttd-pengawas', pengawas);

    // Fill Daftar Hadir
    safeSetText('pd-mapel', examName);
    safeSetText('pd-tanggal', tanggal);
    safeSetText('pd-kelas', selectedKelas === 'ALL' ? 'Semua Kelas' : selectedKelas);
    safeSetText('pd-ruang', ruang);

    safeSetText('pd-ttd-proktor', proktor);
    safeSetText('pd-ttd-pengawas', pengawas);

    let tbodyHTML = '';
    if (targetStudents.length === 0) {
      tbodyHTML = '<tr><td colspan="5" style="text-align:center;">Data siswa tidak ditemukan untuk kelas ini.</td></tr>';
    } else {
      targetStudents.forEach((s, i) => {
        let ttd1 = (i % 2 === 0) ? `${i + 1}. ` : '';
        let ttd2 = (i % 2 !== 0) ? `${i + 1}. ` : '';
        tbodyHTML += `
                    <tr>
                       <td style="text-align:center;">${i + 1}</td>
                       <td>${s.id}</td>
                       <td>${s.nama}</td>
                       <td style="width:17.5%; height:35px; vertical-align:top;">${ttd1}</td>
                       <td style="width:17.5%; height:35px; vertical-align:top;">${ttd2}</td>
                    </tr>
                `;
      });
    }
    document.getElementById('print-siswa-tbody').innerHTML = tbodyHTML;

    hideLoading();
    closePrintModal();

    // Trigger browser print
    setTimeout(() => {
      window.print();
    }, 500);

  } catch (e) {
    hideLoading();
    alert('Gagal menyiapkan dokumen cetak.');
    console.error(e);
  }
}

// --- PWA Installation Logic ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Tampilkan tombol install di PWA blocker overlay jika sedang tampil
  const btnInstall = document.getElementById('btnTriggerInstall');
  if (btnInstall) {
    btnInstall.style.display = 'block';
    // Pastikan listener tidak duplikat
    btnInstall.onclick = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        btnInstall.style.display = 'none';
      }
    };
  }
});

// Jika sudah installed, sembunyikan blocker (event appinstalled)
window.addEventListener('appinstalled', () => {
  const overlay = document.getElementById('pwa-blocker-overlay');
  if (overlay) overlay.style.display = 'none';
});

// --- Bypass PWA Blocker ---
window.verifyPwaBypass = async function () {
  const input = document.getElementById('pwaBypassInput');
  const errEl = document.getElementById('pwaBypassError');
  if (!input || !errEl) return;

  const code = input.value.trim().toUpperCase();
  if (!code) { errEl.textContent = 'Masukkan kode bypass terlebih dahulu.'; errEl.style.display = 'block'; return; }

  try {
    const snap = await db.ref('/config/security/bypassCode').once('value');
    const validCode = snap.val();

    if (validCode && code === String(validCode).toUpperCase()) {
      // Simpan bypass di sessionStorage agar tidak perlu ulang dalam sesi ini
      sessionStorage.setItem('pwa_bypass_granted', '1');
      errEl.style.display = 'none';
      const overlay = document.getElementById('pwa-blocker-overlay');
      if (overlay) overlay.style.display = 'none';
    } else {
      errEl.textContent = 'Kode bypass tidak valid. Hubungi pengawas.';
      errEl.style.display = 'block';
      input.value = '';
      input.focus();
    }
  } catch (e) {
    errEl.textContent = 'Gagal verifikasi, periksa koneksi internet.';
    errEl.style.display = 'block';
    console.error(e);
  }
};
function showCustomAlert(title, message, icon = '⚠️') {
  const modal = document.getElementById('custom-alert-modal');
  if (!modal) return;
  document.getElementById('custom-alert-title').textContent = title;
  document.getElementById('custom-alert-message').textContent = message;
  document.getElementById('custom-alert-icon').textContent = icon;
  modal.style.display = 'flex';
}

function closeCustomAlert() {
  const modal = document.getElementById('custom-alert-modal');
  if (modal) modal.style.display = 'none';
}
