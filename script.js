// --- Dynamic PWA Manifest Logic ---
window.updatePWAManifest = function (schoolName = "CBT Online MGMP", logoUrl = null) {
  const defaultIcon = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzFEMEVEOCI+PHBhdGggZD0iTTEyIDJMMiA3TDEyIDEyTDIyIDdMMTIgMloiLz48cGF0aCBkPSJNMkEgOVYxNEMyIDE0IDcuNSAxNy41IDEyIDE5LjVDMTYuNSAxNy41IDIyIDE0IDIyIDE0VjlMMTIgMTRMMiA5WiIgb3BhY2l0eT0iMC43NSIvPjwvc3ZnPg==";
  const iconSrc = logoUrl || defaultIcon;

  const manifestData = {
    "name": schoolName,
    "short_name": "CBT",
    "start_url": window.location.href,
    "display": "standalone",
    "background_color": "#F5F7FF",
    "theme_color": "#1D4ED8",
    "icons": [
      {
        "src": iconSrc,
        "sizes": "192x192",
        "type": logoUrl ? "image/png" : "image/svg+xml",
        "purpose": "any maskable"
      },
      {
        "src": iconSrc,
        "sizes": "512x512",
        "type": logoUrl ? "image/png" : "image/svg+xml",
        "purpose": "any maskable"
      }
    ]
  };
  const stringManifest = JSON.stringify(manifestData);
  const encodedManifest = encodeURIComponent(stringManifest);
  const manifestURL = 'data:application/manifest+json;charset=utf-8,' + encodedManifest;
  document.getElementById('pwa-manifest').setAttribute('href', manifestURL);
};

// Initial call
window.updatePWAManifest();

// --- MODAL PANDUAN ---
window.openGuideModal = function () {
  const overlay = document.getElementById('guide-overlay');
  const modal = document.getElementById('guide-modal');
  if (!overlay || !modal) return;
  overlay.classList.add('active');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closeGuideModal = function () {
  const overlay = document.getElementById('guide-overlay');
  const modal = document.getElementById('guide-modal');
  if (!overlay || !modal) return;
  overlay.classList.remove('active');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
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
    safeSetText('ph-sekolah', iden.name);
    safeSetText('ph-sekolah-2', iden.name);
    safeSetText('ph-sekolah-print', iden.name);
    safeSetText('portal-school-sub', iden.name);
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

  // Update PWA Manifest dynamically (Armor 1000)
  updatePWAManifest(iden.name || "CBT Online", iden.logo);
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
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
  hideLoading(); // Pastikan loading tertutup saat ganti halaman
}

// Helper untuk mencegah error memori penuh (Storage Quota)
function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showCustomAlert('Memori HP Penuh', 'Penyimpanan browser Anda penuh. Harap hapus beberapa data browser untuk melanjutkan ujian.', '💾');
    } else {
      console.warn('Gagal menyimpan ke localStorage', e);
    }
    return false;
  }
}

function safeAddListener(id, event, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
}

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function safeSetValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function safeSetChecked(id, bool) {
  const el = document.getElementById(id);
  if (el) el.checked = !!bool;
}

function safeGetValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function showAlert(msg, type = 'danger') {
  const alertEl = document.getElementById('login-alert');
  alertEl.textContent = msg;
  alertEl.className = `alert alert-${type}`;
  alertEl.style.display = 'block';
  setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
}

function showLoading(text) {
  const overlay = document.getElementById('loading-overlay');
  const textEl = document.getElementById('loading-overlay-text');
  if (overlay && textEl) {
    textEl.textContent = text || 'Memuat...';
    overlay.classList.add('active');
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('active');
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
  if (overlay) overlay.classList.add('active');

  try { playSiren(); } catch (e) { }

  let count = 5 * State.violations;
  const countEl = document.getElementById('cheat-countdown');
  if (countEl) countEl.textContent = count;

  const iv = setInterval(() => {
    count--;
    if (countEl) countEl.textContent = count;
    if (count <= 0) {
      clearInterval(iv);
      if (overlay) overlay.classList.remove('active');
      if (State.security.fullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(e => { });
      }
    }
  }, 1000);

  withDB(async function () {
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
  const now = Date.now();
  const cached = memoryCache[path];
  if (cached && (now - cached.ts < 10 * 60 * 1000)) return cached.val;

  const snap = await db.ref(path).once('value');
  const val = snap.val();
  memoryCache[path] = { val, ts: now };
  return val;
}

// Database caching logic (Memory Cache)
let searchTimeout = null;

// Deklarasi di sini agar bisa dipakai oleh dbConnectFast dan dbConnect di bawah
// tanpa ReferenceError (let tidak di-hoist seperti var).
let activeDbRequests = 0;
let dbDisconnectTimer = null;
let connectionPromise = null;

// --- KONEKSI CEPAT TANPA JITTER (khusus operasi interaktif) ---
window.dbConnectFast = async function () {
  activeDbRequests++;
  if (activeDbRequests === 1) {
    connectionPromise = (async () => {
      if (dbDisconnectTimer) clearTimeout(dbDisconnectTimer);
      db.goOnline();
    })();
  }
  if (connectionPromise) await connectionPromise;
};

window.dbOffline = function () {
  // Hanya matikan koneksi jika TIDAK sedang di Admin Dashboard
  const isAdmin = document.getElementById('admin-dash-view') && document.getElementById('admin-dash-view').classList.contains('active');
  if (isAdmin) return;

  activeDbRequests = 0;
  db.goOffline();
};

// --- CACHE PESERTA PERSISTENT (localStorage, 30 menit) ---
const PESERTA_CACHE_KEY = 'CBT_CACHE_PESERTA';
const PESERTA_CACHE_TIME_KEY = 'CBT_CACHE_PESERTA_TIME';
const PESERTA_CACHE_TTL = 30 * 60 * 1000; // 30 menit

async function loadPesertaCache() {
  // Cek apakah cache masih valid
  try {
    const cachedTime = localStorage.getItem(PESERTA_CACHE_TIME_KEY);
    if (cachedTime && (Date.now() - parseInt(cachedTime)) < PESERTA_CACHE_TTL) {
      const cached = localStorage.getItem(PESERTA_CACHE_KEY);
      if (cached) {
        cachedPeserta = JSON.parse(cached);
        SystemStatus.peserta = 'success';
        updateInitStatusDisplay();
        return cachedPeserta;
      }
    }
  } catch (e) { /* cache rusak, lanjut fetch */ }

  // Fetch dari Firebase
  try {
    window.dbConnectFast();
    const snap = await db.ref('/peserta').once('value');
    const data = snap.val() || {};
    const results = [];
    for (let id in data) {
      const p = data[id];
      results.push({
        id,
        name: p.nama || '',
        kelas: p.kelas || '',
        _search: ((p.nama || '') + ' ' + (p.kelas || '') + ' ' + id).toLowerCase()
      });
    }
    // Simpan ke cache
    cachedPeserta = results;
    try {
      localStorage.setItem(PESERTA_CACHE_KEY, JSON.stringify(results));
      localStorage.setItem(PESERTA_CACHE_TIME_KEY, Date.now().toString());
    } catch (e) { /* storage penuh, skip */ }
    SystemStatus.peserta = 'success';
    updateInitStatusDisplay();
    return results;
  } catch (e) {
    console.error("Gagal memuat daftar peserta:", e);
    SystemStatus.peserta = 'error';
    updateInitStatusDisplay();
    return [];
  } finally {
    window.dbDisconnect();
  }
}

async function syncAllDataForPortal() {
  showLoading('Singkronisasi Data Ujian...');
  try {
    await dbConnectFast();
    // 1. Fetch Identity
    const idenSnap = await db.ref('/config/identity').once('value');
    const iden = idenSnap.val();
    if (iden) {
      applySchoolIdentity(iden);
      SystemStatus.portal = 'success';
    }

    // 2. Fetch Peserta
    await loadPesertaCache();

    // 3. Fetch Jadwal (Preview)
    const jSnap = await db.ref('/jadwal').once('value');
    const jadwals = jSnap.val() || {};
    localStorage.setItem('CBT_CACHE_JADWAL', JSON.stringify(jadwals));
    localStorage.setItem('CBT_CACHE_JADWAL_TIME', Date.now().toString());

    // 4. Force Offline to free up Firebase slots for students
    dbOffline();
    hideLoading();

    const badge = document.getElementById('sync-badge');
    if (badge) badge.style.display = 'block';

    SystemStatus.portal = 'success';
    updateInitStatusDisplay();
  } catch (e) {
    console.error("Armor 1000 Sync Error:", e);
    hideLoading();
    // Tetap lanjut, mungkin ada cache lama
  }
}

async function searchPeserta(keyword) {
  const key = keyword.trim().toLowerCase();
  if (key.length < 2) return [];

  // Pastikan cache terisi
  const list = cachedPeserta || await loadPesertaCache();
  if (!list || list.length === 0) return [];

  const queryWords = key.split(/\s+/).filter(w => w.length > 0);
  const results = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const haystack = p._search || ((p.name || '') + ' ' + (p.kelas || '') + ' ' + (p.id || '')).toLowerCase();
    if (queryWords.every(word => haystack.includes(word))) {
      results.push(p);
      if (results.length >= 15) break;
    }
  }
  return results;
}

/* ================================
   📦 CACHE SOAL (SUPER CEPAT)
================================ */

async function getExamDataOptimized(examId, token, forceRefresh = false, skipTokenCheck = false) {
  // Armor 1000: Coba ambil dari cache jadwal dulu untuk menghemat koneksi
  let sch = null;
  try {
    const cachedJadwal = localStorage.getItem('CBT_CACHE_JADWAL');
    if (cachedJadwal) {
      const jadwals = JSON.parse(cachedJadwal);
      sch = jadwals[examId];
    }
  } catch (e) { }

  // Jika tidak ada di cache, baru ambil dari Firebase
  if (!sch || forceRefresh) {
    await dbConnectFast();
    try {
      const jSnap = await db.ref('/jadwal/' + examId).once('value');
      sch = jSnap.val();
    } finally {
      dbDisconnect();
    }
  }

  if (!sch) throw new Error("Ujian tidak ditemukan");

  // Cache Versioning (Armor 1000)
  // Gunakan timestamp mulai sebagai versi untuk invalidasi otomatis jika jadwal diubah
  const ver = sch.mulai || 0;
  const CACHE_KEY = `SOAL_${examId}_v${ver}`;

  if (!forceRefresh) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsedData = JSON.parse(cached);
        // Validasi ekstra: pastikan object punya array questions
        if (parsedData && parsedData.questions && parsedData.questions.length > 0) {
          return parsedData;
        } else {
          throw new Error("Cache kosong atau rusak");
        }
      } catch (e) {
        console.warn("Cache rusak, melakukan auto re-download...", e);
        showLoading('Memperbaiki Data yang Rusak...');
      }
    }
  }

  // Token check hanya dilakukan saat mau MENGERJAKAN (skipTokenCheck = false)
  if (!skipTokenCheck && sch.token) {
    const inputToken = String(token).toUpperCase().trim();
    const serverToken = String(sch.token).toUpperCase().trim();

    // Cek apakah token server cocok
    if (serverToken !== inputToken) {
      // Coba fallback offline token hash (jika internet mati dan token server tidak bisa diperbarui)
      const offlineHash = localStorage.getItem(`CBT_TOKEN_HASH_${examId}`);
      if (offlineHash && simpleHash(inputToken) === offlineHash) {
        console.log("✅ Offline Token Verified");
      } else {
        throw new Error("Token salah!");
      }
    }
  }

  await dbConnect();
  try {
    const sDataPromise = cachedGet('/soal/' + sch.nama_soal);
    const kDataPromise = cachedGet('/kunci/' + sch.nama_soal);

    const [sData, kData] = await Promise.all([sDataPromise, kDataPromise]);

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
        end_ms: sch.selesai,
        min_selesai: sch.min_selesai || 0  // wajib ada agar batas waktu minimal mengerjakan berlaku dari cache
      },
      questions,
      keys: kData || {}, // Cache keys for client-side scoring
      rawToken: sch.token // Sertakan token mentah agar bisa di-hash saat sync H-1
    };

    safeSetLocalStorage(CACHE_KEY, JSON.stringify(result));
    return result;
  } finally {
    dbDisconnect();
  }
}

// --- STORAGE & SYNC UTILS ---
async function checkStorageQuota() {
  if (!navigator.storage || !navigator.storage.estimate) return true;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    const available = quota - usage;
    // Estimasi 1MB per paket soal (termasuk gambar base64)
    const required = State.schedules.length * 1024 * 1024;

    // Update UI jika ada
    const availEl = document.getElementById('sync-storage-avail');
    const reqEl = document.getElementById('sync-storage-req');
    if (availEl) availEl.textContent = (available / 1024 / 1024).toFixed(0) + ' MB';
    if (reqEl) reqEl.textContent = (required / 1024 / 1024).toFixed(1) + ' MB';

    if (available < required) {
      showCustomAlert(
        'Memori Penuh',
        `Butuh sekitar ${(required / 1024 / 1024).toFixed(1)}MB, namun sisa ruang hanya ${(available / 1024 / 1024).toFixed(1)}MB. Hapus beberapa foto atau aplikasi agar ujian lancar.`,
        '💾'
      );
      return false;
    }
  } catch (e) { console.warn("Gagal cek kuota storage", e); }
  return true;
}

function cleanupOldCache() {
  if (!State.schedules || State.schedules.length === 0) return;
  const activeIds = new Set(State.schedules.map(s => s.id));
  let count = 0;

  // Cari item di localStorage dengan prefix CBT_SOAL_ atau CBT_KUNCI_
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('CBT_SOAL_') || key.startsWith('CBT_KUNCI_')) {
      const id = key.replace('CBT_SOAL_', '').replace('CBT_KUNCI_', '');
      if (!activeIds.has(id)) {
        localStorage.removeItem(key);
        count++;
        // Karena item dihapus, index bergeser
        i--;
      }
    }
  }
  if (count > 0) console.log(`🧹 Cache cleanup: ${count} item lama dihapus.`);
}

function getMyStaggerDelay() {
  if (!State.user || !State.user.id) return 0;
  const userId = String(State.user.id);
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const group = hash % 10; // Bagi menjadi 10 grup
  return group * 20000; // Jeda 20 detik per grup (Total rentang 3 menit)
}

// --- BULLETPROOF UTILS ---
let wakeLock = null;
async function toggleWakeLock(on) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log("🔒 Screen Wake Lock Aktif");
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      console.log("🔓 Screen Wake Lock Dilepas");
    }
  } catch (e) { }
}

function validateDataIntegrity(data) {
  if (!data || typeof data !== 'object') return false;
  // Pastikan ada array soal dan minimal ada satu soal (jika bukan bank kosong)
  if (!data.questions || !Array.isArray(data.questions)) return false;
  // Cek integritas struktur soal pertama
  if (data.questions.length > 0) {
    const q = data.questions[0];
    if (!q.id || !q.pertanyaan || !q.tipe) return false;
  }
  return true;
}

// Simple hash untuk offline token (mencegah token terlihat telanjang di localStorage)
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'OFF_' + Math.abs(hash).toString(36);
}

// --- H-1 PRE-SYNC LOGIC ---
/**
 * Memindai semua soal dan menyimpan gambar eksternal ke CacheStorage (PWA)
 * agar bisa diakses 100% offline tanpa internet.
 */
async function cacheAllImages(questions) {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('cbt-cache-v5');
    const imageUrls = [];

    questions.forEach(q => {
      if (q.image) imageUrls.push(q.image);
      if (q.opsi) {
        q.opsi.forEach(o => {
          if (o.image) imageUrls.push(o.image);
        });
      }
      // Scan for img tags in text (jika ada)
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      let match;
      if (q.soal) {
        while ((match = imgRegex.exec(q.soal)) !== null) imageUrls.push(match[1]);
      }
    });

    const uniqueUrls = [...new Set(imageUrls)].filter(u => u && u.startsWith('http'));
    for (const url of uniqueUrls) {
      try {
        const cachedResponse = await cache.match(url);
        if (!cachedResponse) {
          await cache.add(new Request(url, { mode: 'no-cors' }));
        }
      } catch (e) { console.warn("Skip cache gambar:", url); }
    }
  } catch (e) { console.warn("PWA Cache error", e); }
}

async function syncAllQuestions() {
  if (!State.schedules || State.schedules.length === 0) {
    showCustomAlert('Informasi', 'Tidak ada jadwal ujian yang ditemukan untuk disinkronkan.', 'ℹ️');
    return;
  }

  const btn = document.getElementById('btnSyncAllSoal');
  const progressDiv = document.getElementById('sync-all-progress');
  const bar = document.getElementById('sync-all-bar');
  const text = document.getElementById('sync-all-text');

  if (!btn || !progressDiv) return;

  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.textContent = 'Sedang Sinkron...';
  progressDiv.style.display = 'block';

  // Adaptive Delay (Kecepatan Internet)
  let baseDelay = 800;
  if (navigator.connection && navigator.connection.downlink) {
    if (navigator.connection.downlink < 1.5) baseDelay = 2000; // Sinyal lemah (3G/E)
    else if (navigator.connection.downlink < 3) baseDelay = 1200; // Sinyal sedang
  }

  // Aktifkan Wake Lock
  await toggleWakeLock(true);

  if (!(await checkStorageQuota())) {
    await toggleWakeLock(false);
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Sinkron Semua Soal';
    return;
  }

  // Bersihkan cache lama sebelum sync baru
  cleanupOldCache();

  // Resume Mechanism
  const progressData = JSON.parse(localStorage.getItem('SYNC_PROGRESS') || '{}');
  const completed = new Set(progressData.completed || []);

  let count = completed.size;
  const total = State.schedules.length;

  for (let i = 0; i < total; i++) {
    const sch = State.schedules[i];
    if (completed.has(sch.id)) continue;

    count++;
    const percent = Math.round((count / total) * 100);
    bar.style.width = percent + '%';
    text.textContent = `Mengunduh (${count}/${total}): ${sch.nama}...`;

    try {
      // SkipTokenCheck = true agar bisa download H-1 tanpa tahu token
      const examData = await getExamDataOptimized(sch.id, null, true, true);

      // Pre-cache images if any
      if (examData && examData.questions) {
        await cacheAllImages(examData.questions);
      }

      // Hash token for offline verification
      if (examData && examData.rawToken) {
        localStorage.setItem(`CBT_TOKEN_HASH_${sch.id}`, simpleHash(String(examData.rawToken).toUpperCase().trim()));
      }

      completed.add(sch.id);
      localStorage.setItem('SYNC_PROGRESS', JSON.stringify({ completed: [...completed] }));
      await new Promise(r => setTimeout(r, baseDelay));
    } catch (e) {
      console.warn("Gagal sync:", sch.id, e);
    }
  }

  // Aktifkan Wake Lock
  await toggleWakeLock(false);

  // Cek apakah semua benar-benar selesai
  const isFullySynced = (completed.size >= total);

  // Laporkan ke Firebase bahwa siswa ini sudah sync
  try {
    await dbConnectFast();
    if (State.schedules[0]) {
      await db.ref(`/status_sync/${State.schedules[0].id}/${State.user.id}`).set({
        nama: State.user.name,
        kelas: State.user.kelas,
        time: new Date().getTime(),
        status: isFullySynced ? 'FULL' : 'PARTIAL'
      });
    }
  } catch (e) { console.warn("Gagal lapor status sync", e); }
  finally { dbDisconnect(); }

  if (isFullySynced) {
    bar.style.width = '100%';
    text.textContent = 'Semua Soal Berhasil Disimpan Offline!';
    btn.textContent = '✅ Selesai Sinkron';
    btn.style.background = '#059669';
    btn.disabled = true;
    showCustomAlert('Sinkronisasi Berhasil', 'Semua materi ujian telah disimpan di HP Anda.', '✅');
    renderSchedules(); // Update tombol ujian di daftar jadwal
  } else {
    // Ada yang gagal
    text.textContent = `Sinkron terhenti (${completed.size}/${total} berhasil).`;
    btn.textContent = '🔄 Ulangi Bagian Gagal';
    btn.style.background = '#DC2626'; // Merah danger
    btn.disabled = false;
    btn.style.opacity = '1';
    showCustomAlert('Sinkron Gagal Sebagian', 'Beberapa soal gagal diunduh. Pastikan internet stabil dan klik tombol "Ulangi" kembali.', '⚠️');
  }
}

/* ================================
   💾 AUTO SAVE (ANTI DATA HILANG)
================================ */

// Periodic backup (every 5s)
setInterval(() => {
  if (State.examActive) {
    saveStateLocal();
  }
}, 5000);

// Debounced save for interactions (anti-lag on low-end devices)
let saveTimeout = null;
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStateLocal();
  }, 1000);
}

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
   📡 SYSTEM INITIALIZATION TRACKER
================================ */
const SystemStatus = {
  auth: 'pending',
  peserta: 'pending',
  portal: 'pending'
};

function updateInitStatusDisplay() {
  const dot = document.getElementById('init-dot');
  const text = document.getElementById('init-text');
  if (!dot || !text) return;

  const statuses = [SystemStatus.auth, SystemStatus.peserta, SystemStatus.portal];
  dot.classList.remove('init-success', 'init-warning', 'init-error');

  const topSyncDot = document.getElementById('top-sync-dot');
  const topSyncText = document.getElementById('top-sync-text');

  if (statuses.every(s => s === 'success')) {
    dot.classList.add('init-success');
    dot.style.animation = 'none';
    text.textContent = 'Sistem Siap. Ujian dapat dimulai!';
    text.style.color = '#10b981';

    if (topSyncDot) topSyncDot.style.background = '#10B981';
    if (topSyncText) topSyncText.textContent = 'Sudah Sinkron';
  } else if (statuses.some(s => s === 'error')) {
    dot.classList.add('init-error');
    text.textContent = 'Gagal memuat data. Mohon muat ulang halaman.';
    text.style.color = '#ef4444';

    if (topSyncDot) topSyncDot.style.background = '#EF4444';
    if (topSyncText) topSyncText.textContent = 'Gagal Sinkron';
  } else if (statuses.some(s => s === 'success')) {
    dot.classList.add('init-warning');
    text.textContent = 'Sedang menyiapkan data...';
    text.style.color = 'var(--text-muted)';

    if (topSyncDot) topSyncDot.style.background = '#F59E0B';
    if (topSyncText) topSyncText.textContent = 'Menyinkronkan...';
  } else {
    if (topSyncDot) topSyncDot.style.background = '#EF4444';
    if (topSyncText) topSyncText.textContent = 'Belum Sinkron';
    text.textContent = 'Menyiapkan sistem...';
    text.style.color = 'var(--text-muted)';
  }
}

/* ================================
   🚀 INIT
================================ */
// initAutocomplete removed here, using original logic




// Initialize School Identity
// initSchoolIdentity call removed from here, moved to initPortal for safety

// --- SMART DB CONNECTION MANAGER (HIT & RUN) ---
// Trik ini membuat Firebase berjalan secara stateless seperti REST API.
// Sangat vital untuk mem-bypass limit 100 concurrent connection di versi gratis (Spark).
db.goOffline(); // Matikan koneksi bawaan seketika!

// activeDbRequests dan dbDisconnectTimer sudah dideklarasikan di atas (dekat dbConnectFast)
// agar tidak ReferenceError saat loadPesertaCache() dipanggil sebelum blok ini.

// sleep is already declared above in the Performance Core Patch

window.dbConnect = async function () {
  activeDbRequests++;
  if (activeDbRequests === 1) {
    connectionPromise = (async () => {
      if (dbDisconnectTimer) clearTimeout(dbDisconnectTimer);
      // Jitter: Delay acak 0-1500ms untuk memecah gelombang trafik simultan (Skala 1000)
      await sleep(Math.floor(Math.random() * 1500));
      db.goOnline();
    })();
  }
  if (connectionPromise) await connectionPromise;
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
    // Timeout 15 detik untuk mencegah request menggantung selamanya (Armor 1000)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Firebase Timeout")), 15000)
    );
    return await Promise.race([promiseFunc(), timeoutPromise]);
  } catch (err) {
    console.warn("DB Operation Error:", err.message);
    throw err;
  } finally {
    dbDisconnect();
  }
};

// --- AUTOMATIC FIREBASE PROTOTYPE PATCHING ---
// Mengambil alih semua metode Firebase agar otomatis nyala-mati saat dipanggil
let isAuthReady = false;
let authPromise = null;

let _firebasePatched = false;
function patchFirebase() {
  if (_firebasePatched) return; // Cegah double-patching saat initPortal() dipanggil ulang
  if (typeof firebase === 'undefined' || !firebase.database) return;
  _firebasePatched = true;
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
}

function initAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    SystemStatus.auth = 'error';
    updateInitStatusDisplay();
    return;
  }
  const auth = firebase.auth();
  authPromise = auth.signInAnonymously()
    .then(() => {
      isAuthReady = true;
      SystemStatus.auth = 'success';
      updateInitStatusDisplay();
    })
    .catch(err => {
      console.error(err);
      SystemStatus.auth = 'error';
      updateInitStatusDisplay();
    });
  window.authPromise = authPromise; // Expose ke window agar admin-core.js bisa menunggu auth
}

async function gasRun(funcName, ...args) {
  if (!isAuthReady && authPromise) await authPromise;

  // Gunakan dbConnectFast untuk aksi interaktif (Siswa & Admin) agar tidak kena jitter 1.5 detik
  const interactiveFuncs = [
    'getAllPeserta', 'getSchedules', 'getPortalInfo', 'getExamData',
    'validateAdmin', 'getAdminMonitoringData', 'getAdminJadwalFull',
    'getAdminLaporanLengkap', 'getAdminPreviewSoal'
  ];
  const isFast = interactiveFuncs.includes(funcName);

  if (isFast) await dbConnectFast();

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
      // Jalankan kedua query secara paralel (bukan serial) untuk memotong waktu tunggu ~50%
      const [snap, hSnap] = await Promise.all([
        db.ref('/jadwal').once('value'),
        db.ref('/hasil').orderByChild('userId').equalTo(userId).once('value')
      ]);
      const data = snap.val() || {};
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
        else if (sch.force_aktif) status = 'AKTIF';   // Admin override – ignores time window
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
      // Gunakan path deterministik untuk mencegah duplikasi dan mempercepat proses
      const resultPath = `/hasil/${payload.examId}_${payload.user.id}`;

      // Trust client score to avoid massive DB reads (Armor 1000)
      const finalScore = payload.score || 0;

      await db.ref(resultPath).set({
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        uid: firebase.auth().currentUser.uid, // Simpan UID untuk proteksi Firebase Rules
        userId: payload.user.id,
        nama: payload.user.name,
        kelas: payload.user.kelas || '-',
        examId: payload.examId,
        namaUjian: payload.namaUjian || payload.examId,
        skor: finalScore,
        waktu: payload.usedTime || '',
        detail: payload.detail || "{}"
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
      await db.ref(`/online_status/${examId}/${userId}`).set({
        last_seen: firebase.database.ServerValue.TIMESTAMP,
        uid: firebase.auth().currentUser.uid
      });
      const bSnap = await db.ref(`/broadcasts/${examId}`).once('value');
      if (bSnap.exists()) return { success: true, broadcast: bSnap.val() };
      return { success: true };
    }

    else if (funcName === 'validateAdmin') {
      const [pwd] = args;
      const snap = await db.ref('/config/admin_pass').once('value');
      return { success: true, valid: pwd === snap.val() };
    }

    else if (funcName === 'getAdminMonitoringData') {
      const [skipPeserta] = args;
      const nowMs = Date.now();

      const jSnap = await db.ref('/jadwal').once('value');
      const jData = jSnap.val() || {};
      const activeExams = [];
      const onlineQueries = [];

      for (let id in jData) {
        if (jData[id].aktif && nowMs >= jData[id].mulai && nowMs <= jData[id].selesai) {
          activeExams.push({ id, nama: jData[id].nama, token: jData[id].token });
          onlineQueries.push(db.ref(`/online_status/${id}`).once('value'));
        }
      }

      const queries = [
        db.ref('/hasil').limitToLast(500).once('value')
      ];
      if (!skipPeserta) queries.push(db.ref('/peserta').once('value'));

      const snaps = await Promise.all([...queries, ...onlineQueries]);
      const hSnap = snaps[0];
      const pSnap = skipPeserta ? null : snaps[1];

      const onlinesMap = {};
      const onlineSnaps = snaps.slice(skipPeserta ? 1 : 2);
      activeExams.forEach((ex, idx) => {
        const raw = onlineSnaps[idx] ? onlineSnaps[idx].val() || {} : {};
        // Normalisasi data karena sekarang berbentuk object {last_seen, uid}
        const normalized = {};
        for (let uid in raw) {
          normalized[uid] = (raw[uid] && typeof raw[uid] === 'object') ? raw[uid].last_seen : raw[uid];
        }
        onlinesMap[ex.id] = normalized;
      });

      const pData = pSnap ? pSnap.val() || {} : null;
      const expectedPeserta = [];
      if (pData) {
        for (let id in pData) expectedPeserta.push({ id, nama: pData[id].nama, kelas: pData[id].kelas });
      }

      const hData = hSnap.val() || {};
      const completedMap = {};
      for (let k in hData) {
        let eid = hData[k].examId, uid = hData[k].userId;
        if (!completedMap[eid]) completedMap[eid] = [];
        if (!completedMap[eid].includes(uid)) completedMap[eid].push(uid);
      }

      return { success: true, activeExams, peserta: expectedPeserta, completions: completedMap, onlines: onlinesMap };
    }

    else if (funcName === 'getAdminJadwalFull') {
      const snap = await db.ref('/jadwal').once('value'); const data = snap.val() || {};
      const result = [];
      for (let id in data) result.push({
        id,
        nama: data[id].nama,
        nama_soal: data[id].nama_soal,
        aktif: data[id].aktif,
        force_aktif: data[id].force_aktif || false,
        token: data[id].token,
        mulai: data[id].mulai,
        selesai: data[id].selesai,
        durasi: data[id].durasi,
        target_kelas: data[id].target_kelas || '',
        min_selesai: data[id].min_selesai || 0
      });
      return { success: true, data: result };
    }

    else if (funcName === 'updateJadwalSistem') {
      const [id, token, status, force_aktif] = args;
      await db.ref(`/jadwal/${id}`).update({
        token,
        aktif: status === 'Aktif',
        force_aktif: force_aktif === true
      });
      return { success: true };
    }

    else if (funcName === 'updateJadwalFull') {
      const [id, payload] = args;
      await db.ref(`/jadwal/${id}`).update(payload);
      return { success: true };
    }

    else if (funcName === 'getAdminLaporanLengkap') {
      const [examId] = args;
      let hasilRef = db.ref('/hasil');
      if (examId) hasilRef = hasilRef.orderByChild('examId').equalTo(examId).limitToLast(1000);
      else hasilRef = hasilRef.limitToLast(1000);

      const [hSnap, pSnap] = await Promise.all([
        hasilRef.once('value'),
        db.ref('/pelanggaran').limitToLast(200).once('value')
      ]);
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
    if (isFast) dbDisconnect();
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
    // Scroll agar form tidak tertutup keyboard HP
    setTimeout(() => {
      userNameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    // Prefetch cache peserta di background saat user fokus ke input,
    // sehingga ketika mulai mengetik, data sudah siap di memori.
    if (!cachedPeserta) {
      loadPesertaCache().catch(() => { });
    }
  });

  userNameInput.addEventListener('input', async function (e) {
    const val = e.target.value.trim().toLowerCase();
    autoList.innerHTML = '';
    autoList.classList.remove('show');

    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.length < 2) return;

    // Tunjukkan loading segera agar user tahu sistem merespons
    autoList.innerHTML = '<div class="autocomplete-item text-muted">Mencari...</div>';
    autoList.classList.add('show');

    searchTimeout = setTimeout(async function () {
      // searchPeserta sudah menangani cache + fallback ke Firebase secara otomatis
      const results = await searchPeserta(val);

      autoList.innerHTML = '';
      if (results.length > 0) {
        results.forEach(p => {
          const div = document.createElement('div');
          div.className = 'autocomplete-item';
          div.textContent = (p.name || p.id) + ' - ' + (p.kelas || '');
          div.addEventListener('click', (evt) => {
            evt.preventDefault();
            tempSelectedUser = p;
            document.getElementById('confirm-name-text').textContent = (p.name || p.id) + ' (' + (p.kelas || '') + ')';
            showView('login-confirm-view');
            userNameInput.value = '';
            autoList.classList.remove('show');
          });
          autoList.appendChild(div);
        });
      } else {
        autoList.innerHTML = '<div class="autocomplete-item text-muted" style="padding:12px; font-size:0.8rem;">Nama tidak ditemukan.</div>';
      }
      autoList.classList.add('show');
    }, 350); // Sedikit lebih lama agar prefetch sempat selesai
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

// Helper untuk mengecek status cache semua jadwal dan update UI
function updatePreSyncUI(list) {
  const preSyncContainer = document.getElementById('pre-sync-container');
  if (preSyncContainer && list.length > 0) {
    preSyncContainer.style.display = 'block';

    let allCached = true;
    for (let sch of list) {
      const ver = sch.mulai || 0;
      const CACHE_KEY = `SOAL_${sch.id}_v${ver}`;
      if (!localStorage.getItem(CACHE_KEY)) {
        allCached = false;
        break;
      }
    }

    const notSyncedDiv = document.getElementById('pre-sync-content-not-synced');
    const syncedDiv = document.getElementById('pre-sync-content-synced');
    const nameSpan = document.getElementById('sync-synced-name');

    if (notSyncedDiv && syncedDiv) {
      if (allCached) {
        notSyncedDiv.style.display = 'none';
        syncedDiv.style.display = 'block';
        if (nameSpan) nameSpan.textContent = State.user.name;

        // Tampilan minimalis hemat space
        preSyncContainer.style.background = 'rgba(16, 185, 129, 0.05)';
        preSyncContainer.style.border = '1px dashed #10B981';
        preSyncContainer.style.padding = '10px 16px';
      } else {
        notSyncedDiv.style.display = 'block';
        syncedDiv.style.display = 'none';

        // Kembalikan ke tampilan default
        preSyncContainer.style.background = '#EEF2FF';
        preSyncContainer.style.border = '1px dashed #6366F1';
        preSyncContainer.style.padding = '16px';

        const btnSync = document.getElementById('btnSyncAllSoal');
        if (btnSync) {
          btnSync.textContent = 'Mulai Sinkronisasi';
          btnSync.style.background = '#4F46E5';
          btnSync.disabled = false;
          btnSync.style.opacity = '1';
          // remove listener to avoid duplicates, then add
          btnSync.removeEventListener('click', syncAllQuestions);
          btnSync.addEventListener('click', syncAllQuestions);
        }
      }
    }
  }
}

async function loadSchedules() {
  document.getElementById('schedule-user-name').textContent = State.user.name + ' - ' + State.user.kelas;
  showLoading('Memeriksa Jadwal...');

  // Armor 1000: Mencoba ambil dari cache lokal dulu agar responsif
  try {
    const cachedJadwal = localStorage.getItem('CBT_CACHE_JADWAL');
    if (cachedJadwal) {
      const jadwals = JSON.parse(cachedJadwal);
      const list = [];
      for (let id in jadwals) {
        let s = jadwals[id];
        s.id = id;
        // Filter jadwal yang relevan untuk kelas siswa (atau ALL)
        if (!s.kelas || s.kelas === 'ALL' || s.kelas === State.user.kelas) {
          list.push(s);
        }
      }
      State.schedules = list;
      State.schedules.forEach(s => s._lastRenderedStatus = s.status);
      renderSchedules();
      updatePreSyncUI(list);

      showView('schedule-view');
      hideLoading(); // Sembunyikan loading jika data cache sudah tampil
    }
  } catch (e) { }

  try {
    // Tetap fetch dari server untuk status terbaru (misal: apakah sudah SELESAI di server)
    const res = await gasRun('getSchedules', State.user.id, State.user.kelas);
    if (res.success) {
      State.serverTimeOffset = (res.serverTime || Date.now()) - Date.now();
      State.schedules = res.schedules;
      State.schedules.forEach(s => s._lastRenderedStatus = s.status);
      renderSchedules();
      updatePreSyncUI(State.schedules);
      showView('schedule-view');

      if (scheduleTimer) clearInterval(scheduleTimer);
      scheduleTimer = setInterval(() => {
        if (document.getElementById('schedule-view').classList.contains('active')) {
          updateSchedulesStatus();
        } else {
          clearInterval(scheduleTimer);
        }
      }, 1000);

    } else {
      // Jika gagal fetch tapi sudah ada data dari cache, tidak perlu mental ke login
      if (!State.schedules || State.schedules.length === 0) {
        showCustomAlert('Gagal Memuat Jadwal', 'Gagal memuat jadwal: ' + res.message, '❌');
        showView('login-view');
      }
    }
  } catch (err) {
    if (!State.schedules || State.schedules.length === 0) {
      showCustomAlert('Kesalahan Jaringan', 'Terjadi kesalahan sinkronisasi jaringan.', '🌐');
      showView('login-view');
    }
  } finally {
    hideLoading();

    // --- AUTO BACKGROUND SYNC (Distributed) ---
    const TODAY = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('LAST_SYNC_DATE') !== TODAY) {
      const delay = getMyStaggerDelay();
      console.log(`Auto-sync dijadwalkan dalam ${(delay / 1000).toFixed(0)} detik...`);
      setTimeout(async () => {
        // Cek lagi apakah sudah sync di tab lain
        if (localStorage.getItem('LAST_SYNC_DATE') !== TODAY) {
          await syncAllQuestions();
          localStorage.setItem('LAST_SYNC_DATE', TODAY);
        }
      }, delay);
    }
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
      // Cek apakah soal sudah tersinkronisasi
      const ver = sch.mulai || 0;
      const CACHE_KEY = `SOAL_${sch.id}_v${ver}`;
      const isSynced = localStorage.getItem(CACHE_KEY) !== null;

      if (!isSynced) {
        badge = `<span class="badge badge-wait" style="background:#FDE68A;color:#92400E">Belum Sinkron</span>`;
        btnDisabled = `disabled`;
        btnText = `Sinkronisasi Dulu`;
      } else {
        badge = `<span class="badge badge-active">Sedang Aktif</span>`;
        btnDisabled = ``;
        btnText = `Mulai Ujian`;
      }
    } else if (curStatus === 'NONAKTIF') {
      badge = `<span class="badge badge-closed">Non-Aktif</span>`;
      btnText = `Belum Dibuka`;
    }

    const startObj = new Date(sch.mulai);
    const endObj = new Date(sch.selesai);
    const pad = (n) => n.toString().padStart(2, '0');
    const timeStr = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())} - ${pad(endObj.getHours())}:${pad(endObj.getMinutes())}`;

    // Format Tanggal (untuk ujian 6 hari)
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dateStr = `${days[startObj.getDay()]}, ${startObj.getDate()} ${months[startObj.getMonth()]}`;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '16px';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <h3 style="font-size: 1.1rem; margin:0; line-height: 1.3;">${sch.nama}</h3>
        <div>${badge}</div>
      </div>
      <div style="font-size: 0.85rem; font-weight: 600; color: var(--primary); margin-bottom: 8px;">📅 ${dateStr}</div>
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
          if (!tk) { showCustomAlert('Token Diperlukan', 'Harap masukkan token ujian dari pengawas.', '🔑'); return; }
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
      showCustomAlert('Gagal Mengambil Data', 'Error: ' + res.message, '❌');
      showView('schedule-view');
    }
  } catch (err) {
    showCustomAlert('Kesalahan Sinkronisasi', 'Terjadi kesalahan sinkronisasi. Coba muat ulang.', '🔄');
    showView('schedule-view');
  }
}

// --- Exam Flow ---
safeAddListener('btnStartExam', 'click', () => {
  State.examActive = true;
  State.pingOffset = Math.floor(Math.random() * 600); // Random offset for pings (0-10 min)
  document.getElementById('exam-title').textContent = State.config.nama_ujian;
  document.getElementById('exam-user-info').textContent = State.user.name + " (" + State.user.kelas + ")";

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

    // Ping online status every 3 minutes (180s) to keep proctor dashboard updated.
    // Randomized offset ensures 1000 students don't hit the server at once.
    if (State.timeRemaining > 0 && (State.timeRemaining + State.pingOffset) % 180 === 0) {
      gasRun('setStudentOnline', State.config.id_ujian, State.user.id).then(res => {
        if (res && res.success && res.broadcast) {
          showBroadcastMessage(res.broadcast);
        }
      }).catch(() => { });
    }

    if (State.timeRemaining <= 0) {
      clearInterval(State.timerInterval);
      showCustomAlert('Waktu Habis', 'Waktu ujian telah habis! Jawaban Anda otomatis dikirim.', '⏰');
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

safeAddListener('btnRefreshExam', 'click', async function () {
  if (!State.examActive) return;
  const now = Date.now();

  if (now - lastForceRefresh < REFRESH_COOLDOWN_MS) {
    const sisa = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastForceRefresh)) / 60000);
    showCustomAlert('Cooldown Refresh', `Harap tunggu ${sisa} menit lagi sebelum refresh ulang.`, '⏳');
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
        showCustomAlert('Berhasil', 'Penyegaran data soal berhasil! Silakan lanjutkan ujian.', '✅');
      } else {
        showCustomAlert('Gagal Refresh', 'Gagal menyegarkan soal: ' + res.message, '❌');
        showView('exam-view');
      }
    } catch (err) {
      showCustomAlert('Kesalahan Jaringan', 'Terjadi kesalahan jaringan. Periksa koneksi.', '🌐');
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
        // Optimization: Update classes instead of rebuilding DOM for snappy performance
        container.querySelectorAll('.modern-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        debouncedSave();
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
          div.classList.remove('selected');
        } else {
          arr.push(opt.id);
          div.classList.add('selected');
        }
        if (arr.length === 0) delete State.answers[q.id];
        else State.answers[q.id] = arr;
        debouncedSave();
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
      debouncedSave();
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
        debouncedSave(); // Auto-save
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
  const btnDoubt = document.getElementById('btnDoubt');
  if (State.doubts.has(qId)) {
    State.doubts.delete(qId);
    if (btnDoubt) btnDoubt.classList.remove('active');
  } else {
    State.doubts.add(qId);
    if (btnDoubt) btnDoubt.classList.add('active');
  }
  updateGridUI(); // Hanya update grid, jangan render ulang soal
  debouncedSave(); // Auto-save
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

const bubbleCache = {};

function updateGridUI() {
  State.questions.forEach((q, idx) => {
    let b = bubbleCache[idx];
    if (!b) {
      b = document.getElementById(`bubble-${idx}`);
      if (b) bubbleCache[idx] = b;
    }
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
 * @param {number} maxRetries - Jumlah percobaan ulang maksimal (default: 10)
 * @param {number} retryDelayMs - Jeda dasar antar percobaan (default: 5 detik)
 */
async function gasRunWithRetry(funcName, args, maxRetries = 10, retryDelayMs = 5000) {
  const argsArray = Array.isArray(args) ? args : [args];
  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await gasRun(funcName, ...argsArray);
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const waitTime = Math.ceil((retryDelayMs * attempt) / 1000);
        showLoading(`Antrean Penuh. Mengantri di server... (Mencoba lagi dalam ${waitTime} detik)`);
        await sleep(retryDelayMs * attempt);
      }
    }
  }
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
    const jitterMs = Math.floor(Math.random() * 60000); // 0 - 60.000 ms: cukup untuk 1000 siswa (~17/detik), tidak membuat siswa panik
    const jitterSec = Math.ceil(jitterMs / 1000);
    showLoading(`Waktu habis. Jawaban dikirim dalam ${jitterSec} detik...`);
    await sleep(jitterMs);
  } else {
    // Manual jitter (0-2s) to prevent exact simultaneous clicks
    await sleep(Math.floor(Math.random() * 2000));
  }

  saveStateLocal(); // Pastikan jawaban terbaru tersimpan di LocalStorage sebelum kirim
  showLoading('Menyimpan jawaban ke server...');

  // ─── FASE 2: FULL CLIENT-SIDE GRADING ───────────────────────────
  const keys = State.config.keys || {};
  let totalPoints = 0;
  let maxPoints = 0;
  let detailEvals = {};

  State.questions.forEach(q => {
    const bobot = parseFloat(q.bobot) || 1;
    const correctAns = keys[q.id] || '';
    const userAns = State.answers[q.id];
    let isCorrect = false;
    maxPoints += bobot;

    if (userAns !== undefined) {
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
        String(correctAns).split(';').forEach(p => {
          let pt = p.split('=');
          if (pt.length == 2) cPairs[pt[0].trim()] = pt[1].trim();
        });
        if (typeof userAns === 'object' && !Array.isArray(userAns)) {
          let allMatch = true;
          let kList = Object.keys(cPairs);
          if (kList.length === 0) allMatch = false;
          for (let k of kList) { if (userAns[k] !== cPairs[k]) { allMatch = false; break; } }
          isCorrect = allMatch;
        }
      }
    }

    if (isCorrect) totalPoints += bobot;
    detailEvals[q.id] = { answer: userAns || '-', correct: isCorrect };
  });

  const score = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  const payload = {
    examId: State.config.id_ujian,
    namaUjian: State.config.nama_ujian,
    user: {
      id: State.user.id,
      name: State.user.name,
      kelas: State.user.kelas
    },
    usedTime: getUsedTimeStr(),
    violations: State.violations,
    score: score
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
        showCustomAlert('Gagal Mengirim', 'Gagal mengirim jawaban: ' + errMsg, '❌');
        showView('exam-view');
      }
    }
  } catch (err) {
    // Gagal total setelah 3x retry — beri tahu siswa
    showCustomAlert('Koneksi Terputus', 'Jawaban Anda AMAN di perangkat. Tekan tombol Kirim Ulang.', '📡');
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
  const img = document.getElementById('zoom-image'); // Fix ID mismatch from HTML
  if (overlay && img) {
    img.src = src;
    overlay.classList.add('active');
  }
};

window.closeZoomModal = function () {
  const overlay = document.getElementById('zoom-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    const img = document.getElementById('zoom-image');
    if (img) img.src = '';
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
  patchFirebase();
  initAuth();
  updateClock();
  if (!portalClockInterval) {
    portalClockInterval = setInterval(updateClock, 1000);
  }
  fetchPortalExams();

  // Prefetch daftar peserta di background
  authPromise.then(() => {
    if (!cachedPeserta) {
      loadPesertaCache().catch(() => { });
    } else {
      SystemStatus.peserta = 'success';
      updateInitStatusDisplay();
    }
  });

  // ─── ARMOR 1000: Initial Sync & Offline First ───────────────────
  authPromise.then(async () => {
    await syncAllDataForPortal();

    // Load Security Settings
    try {
      const snap = await db.ref('/config/security').once('value');
      State.security = snap.val() || {};

      // Toggle Landing Page Features
      const examCard = document.getElementById('landing-exam-status-card');
      const sysCard = document.getElementById('landing-system-info-card');
      if (examCard) examCard.style.display = (State.security.showExamStatus !== false) ? 'block' : 'none';
      if (sysCard) sysCard.style.display = (State.security.showSystemInfo !== false) ? 'block' : 'none';

      // PWA Enforcer Check
      if (State.security.pwa) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        const hasBypass = sessionStorage.getItem('pwa_bypass_granted') === '1';
        if (isMobile && !isStandalone && !hasBypass && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
          const pwaOverlay = document.getElementById('pwa-blocker-overlay');
          if (pwaOverlay) pwaOverlay.classList.add('active');
        }
      }
    } catch (e) { console.error("Armor 1000: Security Load Error", e); }
  });

  // Touchscreen Hotkey: 5x taps on the portal logo
  const logo = document.querySelector('.centric-logo');
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

  clockEl.textContent = `${date} ${m} ${y}`;
}

async function fetchPortalExams() {
  const container = document.getElementById('portal-active-exams');
  if (!container) return;

  try {
    const res = await gasRun('getPortalInfo');
    if (res.success) {
      if (res.activeSchedules && res.activeSchedules.length > 0) {
        container.innerHTML = res.activeSchedules.map((ex, index) => {
          // Determine status based on time (mock logic, ideally from server)
          // For display purposes based on mockup:
          let statusText = "Aktif";
          let badgeClass = "live";
          let iconClass = "blue";
          let iconSvg = `<path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />`;

          if (index % 3 === 0) {
            statusText = "Belum Mulai"; badgeClass = "wait"; iconClass = "yellow";
            iconSvg = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />`;
          } else if (index % 3 === 2) {
            statusText = "Selesai"; badgeClass = "done"; iconClass = "green";
            iconSvg = `<path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />`;
          }

          return `
          <div class="landing-exam-item">
            <div class="landing-exam-icon ${iconClass}">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:24px;height:24px;">
                ${iconSvg}
              </svg>
            </div>
            <div class="landing-exam-info">
              <h4>${ex.nama}</h4>
              <p>Durasi: ${ex.durasi} Menit</p>
            </div>
            <div class="landing-exam-badge ${badgeClass}">
              ${badgeClass === 'done' ? '✓' : badgeClass === 'wait' ? '⏳' : '▶'} ${statusText}
            </div>
          </div>
        `}).join('');
      } else {
        container.innerHTML = '<div class="text-muted" style="text-align:center; padding: 20px;">Tidak ada jadwal ujian yang aktif saat ini.</div>';
      }
    } else {
      container.innerHTML = '<p class="text-muted" style="color:var(--danger); text-align:center; padding: 20px;">Gagal memuat jadwal.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="text-muted" style="color:var(--danger); text-align:center; padding: 20px;">Koneksi terputus.</p>';
  }
}

// --- ADMIN CORE LAZY LOADING (Optimization) ---
async function ensureAdminLoaded() {
  if (window.loadAdminDashboard) return true;
  showLoading('Menginisialisasi modul Proktor...');
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'admin-core.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    hideLoading();
    return true;
  } catch (e) {
    hideLoading();
    showCustomAlert('Gagal Memuat', 'Gagal memuat modul Admin. Periksa koneksi internet.', '❌');
    return false;
  }
}

// Stub function to trigger lazy loading
window.showAdminAuthModal = async function () {
  if (await ensureAdminLoaded()) {
    if (typeof _showAdminAuthModal === 'function') _showAdminAuthModal();
    else if (typeof window.showAdminAuthModal === 'function' && !window.showAdminAuthModal.toString().includes('ensureAdminLoaded')) {
      window.showAdminAuthModal();
    }
  }
};

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

// masukUjianHandler removed as per user request

// --- PENGATURAN KEAMANAN ADMIN ---


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
    if (overlay) overlay.classList.remove('active');
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
      if (overlay) overlay.classList.add('active');
      if (modal) {
        modal.style.display = 'flex';
        // trigger flow
        setTimeout(() => {
          modal.style.opacity = '1';
          modal.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
      }
    } else {
      showCustomAlert('Gagal Membaca Soal', 'Gagal membaca lembar soal: ' + res.message, '❌');
    }
  } catch (e) {
    hideLoading();
    showCustomAlert('Koneksi Bermasalah', 'Koneksi ke server bermasalah. Coba lagi.', '🌐');
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

      document.getElementById('soal-edit-overlay').classList.add('active');
      document.getElementById('soal-edit-modal').style.display = 'flex';
      setTimeout(() => {
        document.getElementById('soal-edit-modal').style.opacity = '1';
        document.getElementById('soal-edit-modal').style.transform = 'translate(-50%, -50%) scale(1)';
      }, 10);
    } else {
      showCustomAlert('Tipe Tidak Didukung', 'Edit cepat hanya mendukung tipe PG, Benar-Salah, dan PG Kompleks.', 'ℹ️');
    }
  } catch (e) {
    hideLoading();
    showCustomAlert('Gagal', 'Gagal mengambil data soal dari server.', '❌');
  }
}

window.closeSoalEditModal = function () {
  document.getElementById('soal-edit-overlay').classList.remove('active');
  document.getElementById('soal-edit-modal').style.opacity = '0';
  document.getElementById('soal-edit-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('soal-edit-modal').style.display = 'none';
  }, 300);
}

window.saveSoalEdit = async function () {
  const bankId = document.getElementById('soalEditBankId').value;
  const soalId = document.getElementById('soalEditId').value;
  const pertanyaan = document.getElementById('soalEditPertanyaan').value.trim();
  const gambar = document.getElementById('soalEditGambar').value.trim();
  const rawKunci = document.getElementById('soalEditKunci').value;

  if (!pertanyaan) return showCustomAlert('Data Tidak Lengkap', 'Teks soal tidak boleh kosong.', '📝');
  if (!rawKunci) return showCustomAlert('Data Tidak Lengkap', 'Kunci jawaban tidak boleh kosong.', '📝');

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
    showCustomAlert('Berhasil', 'Perubahan berhasil disimpan!', '✅');

    // Refresh the preview
    previewSoal(bankId);
  } catch (e) {
    hideLoading();
    showCustomAlert('Gagal Menyimpan', 'Gagal menyimpan perubahan. Coba lagi.', '❌');
  }
}

// --- Import Logic ---
let currentImportType = '';

window.downloadTemplateExcel = function () {
  if (typeof XLSX === 'undefined') return showCustomAlert('Library Belum Siap', 'Library Excel belum dimuat. Pastikan koneksi stabil.', '⚠️');
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
  document.getElementById('import-overlay').classList.add('active');
  document.getElementById('import-modal').style.display = 'flex';
  document.getElementById('importFileInput').value = '';

  setTimeout(() => {
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
  document.getElementById('import-overlay').classList.remove('active');
  document.getElementById('import-modal').style.opacity = '0';
  document.getElementById('import-modal').style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    document.getElementById('import-modal').style.display = 'none';
  }, 300);
}

// --- XLSX Import Logic ---
async function importSoalExcel(jsonData, bankId) {
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
    if (gambarSoal.startsWith('data:image')) {
      gambarSoal = ""; // Block base64 in question image
      warnings.push(`Baris ke-${i + 1}: Gambar Base64 diblokir. Gunakan link external.`);
    }

    let opsi = [];
    opsiIndices.forEach(idxMap => {
      let teks = row[idxMap.textIdx] !== undefined ? String(row[idxMap.textIdx]).trim() : '';
      let gmb = '';
      if (idxMap.imgIdx !== -1) {
        gmb = row[idxMap.imgIdx] !== undefined ? String(row[idxMap.imgIdx]).trim() : '';
        if (gmb.startsWith('data:image')) gmb = ""; // Block base64 in options
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
    showCustomAlert('Import Berhasil', msg, '✅');
    closeImportModal();
    loadAdminSoal();
  } else showCustomAlert('Import Gagal', 'Tidak ada soal valid ditemukan. Periksa format file.', '❌');
}

window.processImport = async function () {
  const fileInput = document.getElementById('importFileInput');
  if (fileInput.files.length === 0) return showCustomAlert('File Diperlukan', 'Pilih file terlebih dahulu.', '📂');

  const file = fileInput.files[0];
  const reader = new FileReader();
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  if (isCSV) {
    reader.onload = async function (e) {
      const text = e.target.result;
      showLoading('Mengimpor Data...');
      try {
        if (currentImportType === 'siswa') await importSiswaCSV(text);
        else if (currentImportType === 'soal') {
          const bankId = document.getElementById('importBankId').value.trim();
          if (!bankId) return showCustomAlert('Kode Wajib Diisi', 'Kode Bank Soal wajib diisi.', '📝');
          await importSoalCSV(text, bankId);
        }
      } finally {
        hideLoading();
      }
    };
    reader.readAsText(file);
  } else {
    reader.onload = async function (e) {
      showLoading('Memproses File Excel...');
      try {
        if (typeof XLSX === 'undefined') return showCustomAlert('Library Belum Siap', 'Library Excel belum termuat. Periksa koneksi internet.', '⚠️');
        const data = new Uint8Array(e.target.result);

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (currentImportType === 'siswa') {
          await importSiswaExcel(jsonData);
        } else if (currentImportType === 'soal') {
          const bankId = document.getElementById('importBankId').value.trim();
          if (!bankId) return showCustomAlert('Kode Wajib Diisi', 'Kode Bank Soal wajib diisi.', '📝');
          await importSoalExcel(jsonData, bankId);
        }
      } catch (err) {
        showCustomAlert('Gagal Membaca File', 'Gagal membaca file Excel. Pastikan file tidak rusak.', '❌');
        console.error(err);
      } finally {
        hideLoading();
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
    updates[id] = {
      nama: String(row[1] || '').trim(),
      nama_lower: String(row[1] || '').trim().toLowerCase(),
      kelas: String(row[2] || '').trim()
    };
    count++;
  }
  if (count > 0) {
    await db.ref('/peserta').update(updates);
    let msg = 'Berhasil import ' + count + ' siswa.';
    if (warnings.length > 0) {
      msg += '\n\nPeringatan:\n- ' + warnings.slice(0, 5).join('\n- ');
      if (warnings.length > 5) msg += `\n...dan ${warnings.length - 5} peringatan lainnya.`;
    }
    showCustomAlert('Import Berhasil', msg, '✅');
    closeImportModal();
    loadAdminSiswa();
  } else {
    showCustomAlert('Import Gagal', 'Tidak ada data valid di Excel. Pastikan ID ada di kolom A.', '❌');
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
      updates[id] = {
        nama: cols[1],
        nama_lower: cols[1].toLowerCase(),
        kelas: cols[2]
      };
      count++;
    }
  }
  if (count > 0) {
    await db.ref('/peserta').update(updates);
    showCustomAlert('Import Berhasil', 'Berhasil mengimpor ' + count + ' siswa.', '✅');
    closeImportModal();
    loadAdminSiswa();
  } else {
    showCustomAlert('Import Gagal', 'Tidak ada data valid di CSV. Pastikan ada header di baris 1.', '❌');
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
    showCustomAlert('Import Berhasil', 'Berhasil mengimpor ' + count + ' soal ke bank ' + bankId + '.', '✅');
    closeImportModal();
    loadAdminSoal();
  } else {
    showCustomAlert('Format Salah', 'Data kosong/salah format. Gunakan titik koma (;) sebagai pemisah.', '⚠️');
  }
}
// --- Jadwal Builder Logic ---
// editJadwalId tracks whether we're in Create or Edit mode
let _editJadwalId = null;

window.openJadwalModal = async function (editId = null) {
  _editJadwalId = editId;

  document.getElementById('jadwal-overlay').classList.add('active');
  document.getElementById('jadwal-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('jadwal-overlay').style.opacity = '1';
    document.getElementById('jadwal-modal').style.opacity = '1';
    document.getElementById('jadwal-modal').style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);

  // Update modal title
  document.querySelector('#jadwal-modal h3').textContent = editId ? `Edit Jadwal: ${editId}` : 'Buat Jadwal Ujian Baru';

  // Load Bank Soal
  const select = document.getElementById('jSoal');
  select.innerHTML = '<option value="">Memuat...</option>';
  const snap = await db.ref('/soal').once('value');
  const soalData = snap.val() || {};
  let options = '<option value="">-- Pilih Bank Soal --</option>';
  for (let sid in soalData) {
    options += `<option value="${sid}">${sid} (${Object.keys(soalData[sid]).length} soal)</option>`;
  }
  select.innerHTML = options;

  if (editId) {
    // EDIT MODE: Load existing data
    showLoading('Memuat data jadwal...');
    try {
      const jSnap = await db.ref('/jadwal/' + editId).once('value');
      const jData = jSnap.val();
      if (jData) {
        document.getElementById('jId').value = editId;
        document.getElementById('jId').readOnly = true; // Kode tidak boleh diubah
        document.getElementById('jNama').value = jData.nama || '';
        document.getElementById('jDurasi').value = jData.durasi || 60;
        document.getElementById('jKelas').value = jData.target_kelas || '';
        document.getElementById('jMinSelesai').value = jData.min_selesai || 0;
        // Format timestamp to datetime-local string
        const toLocal = (ms) => {
          if (!ms) return '';
          const d = new Date(ms);
          const pad = n => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        document.getElementById('jMulai').value = toLocal(jData.mulai);
        document.getElementById('jSelesai').value = toLocal(jData.selesai);
        // Set soal select
        if (jData.nama_soal) select.value = jData.nama_soal;
      }
    } catch (e) { showCustomAlert('Gagal', 'Gagal memuat data jadwal.', '❌'); }
    hideLoading();
  } else {
    // CREATE MODE: Clear inputs
    document.getElementById('jId').value = '';
    document.getElementById('jId').readOnly = false;
    document.getElementById('jNama').value = '';
    document.getElementById('jDurasi').value = '60';
    document.getElementById('jKelas').value = '';
    document.getElementById('jMinSelesai').value = '0';
    document.getElementById('jMulai').value = '';
    document.getElementById('jSelesai').value = '';
  }
}

window.closeJadwalModal = function () {
  document.getElementById('jadwal-overlay').classList.remove('active'); // Fix: was missing!
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
  const isEdit = _editJadwalId !== null;

  if (!id || !nama || !soal || !mulaiStr || !selesaiStr) {
    return showCustomAlert('Data Tidak Lengkap', 'Harap isi semua field yang wajib.', '📝');
  }

  const mulaiMs = new Date(mulaiStr).getTime();
  const selesaiMs = new Date(selesaiStr).getTime();

  if (mulaiMs >= selesaiMs) {
    return showCustomAlert('Waktu Tidak Valid', 'Waktu selesai harus lebih besar dari waktu mulai.', '⏰');
  }

  showLoading(isEdit ? 'Memperbarui Jadwal...' : 'Menyimpan Jadwal...');
  try {
    if (isEdit) {
      // UPDATE: preserve token & force_aktif, only update editable fields
      const updates = {
        nama, nama_soal: soal, durasi,
        target_kelas: kelas,
        mulai: mulaiMs, selesai: selesaiMs,
        min_selesai: parseInt(document.getElementById('jMinSelesai').value) || 0
      };
      await db.ref('/jadwal/' + id).update(updates);
      showCustomAlert('Berhasil', 'Jadwal berhasil diperbarui! ✅', '✅');
    } else {
      // CREATE: generate token baru
      const token = Math.random().toString(36).substring(2, 8).toUpperCase();
      const payload = {
        nama, nama_soal: soal, durasi,
        target_kelas: kelas,
        mulai: mulaiMs, selesai: selesaiMs,
        aktif: true, token,
        force_aktif: false,
        min_selesai: parseInt(document.getElementById('jMinSelesai').value) || 0
      };
      await db.ref('/jadwal/' + id).set(payload);
      showCustomAlert('Berhasil', 'Jadwal baru berhasil dibuat! ✅', '✅');
    }
    closeJadwalModal();
    loadAdminJadwal();
  } catch (e) {
    showCustomAlert('Gagal Menyimpan', 'Gagal menyimpan jadwal: ' + e.message, '❌');
  } finally {
    hideLoading();
  }
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
  if (overlay) overlay.classList.add('active');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
  }

  // Fetch distinct classes
  try {
    const data = await gasRun('getAllPeserta');
    const kelasSet = new Set();
    data.forEach(p => {
      if (p.kelas) kelasSet.add(p.kelas);
    });

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
  if (overlay) overlay.classList.remove('active');
  if (modal) {
    modal.style.opacity = '0';
    modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
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

    const judulCustom = document.getElementById('printJudul').value.trim().toUpperCase();
    if (judulCustom) {
      safeSetText('pb-judul', `BERITA ACARA ${judulCustom}`);
      safeSetText('pd-judul', `DAFTAR HADIR ${judulCustom}`);
    } else {
      safeSetText('pb-judul', `BERITA ACARA PELAKSANAAN UJIAN`);
      safeSetText('pd-judul', `DAFTAR HADIR PESERTA UJIAN`);
    }

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
    showCustomAlert('Gagal', 'Gagal menyiapkan dokumen cetak. Coba lagi.', '❌');
    console.error(e);
  }
}

// --- PWA Installation Logic ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Tampilkan banner install
  const banner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');
  const btnTrigger = document.getElementById('btnTriggerInstall');

  if (banner) banner.style.display = 'flex';

  const handleInstall = async (btn) => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      if (banner) banner.style.display = 'none';
      if (btnTrigger) btnTrigger.style.display = 'none';
    }
  };

  if (btnInstall) btnInstall.onclick = () => handleInstall(btnInstall);
  if (btnTrigger) {
    btnTrigger.style.display = 'block';
    btnTrigger.onclick = () => handleInstall(btnTrigger);
  }
});

// Jika sudah installed, sembunyikan banner & blocker
window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('pwa-install-banner');
  const overlay = document.getElementById('pwa-blocker-overlay');
  if (banner) banner.style.display = 'none';
  if (overlay) overlay.classList.remove('active');
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
      if (overlay) overlay.classList.remove('active');
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
  // Pastikan loading overlay tertutup dulu sebelum modal tampil
  hideLoading();
  const titleEl = document.getElementById('custom-alert-title');
  const msgEl = document.getElementById('custom-alert-message');
  const iconEl = document.getElementById('custom-alert-icon');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = (message !== undefined && message !== null) ? message : '';
  if (iconEl) iconEl.textContent = icon;
  // Tampilkan modal dengan class active (mengikuti sistem CSS overlay baru)
  modal.classList.add('active');
}

function closeCustomAlert() {
  const modal = document.getElementById('custom-alert-modal');
  if (!modal) return;
  modal.classList.remove('active');
}
