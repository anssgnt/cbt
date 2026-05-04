// ============================================
// PATCH: Clear Firebase cache saat load admin
// ============================================
if ('serviceWorker' in navigator && 'caches' in window) {
  caches.open('cbt-cache-v1').then(cache => {
    cache.keys().then(keys => {
      keys.forEach(request => {
        if (request.url.includes('firebase') || request.url.includes('googleapis')) {
          cache.delete(request);
          console.log('🗑️ Cleared Firebase cache:', request.url);
        }
      });
    });
  });
}

// ============================================
// HELPER: Ensure Firebase Ready
// ============================================
async function ensureFirebaseReady(maxWait = 5000) {
  const startTime = Date.now();
  
  while (!window.db || typeof window.db.ref !== 'function') {
    if (Date.now() - startTime > maxWait) {
      throw new Error('Firebase tidak siap setelah ' + maxWait + 'ms');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return true;
}

// ============================================
// FUNGSI ASLI (TIDAK BERUBAH)
// ============================================

window.showAdminAuthModal = function() {
  const overlay = document.getElementById('admin-overlay');
  if (overlay) overlay.classList.add('active');
  const modal = document.getElementById('admin-login-modal');
  if (modal) {
    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }
  document.getElementById('adminTokenInput').value = '';
  document.getElementById('adminTokenInput').focus();
};

function hideAdminAuthModal() {
  const modal = document.getElementById('admin-login-modal');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    modal.style.display = 'none';
    const overlay = document.getElementById('admin-overlay');
    if (overlay) overlay.classList.remove('active');
  }, 300);
}

safeAddListener('btnCancelAdmin', 'click', hideAdminAuthModal);

safeAddListener('btnSubmitAdmin', 'click', async function () {
  const pwd = document.getElementById('adminTokenInput').value.trim();
  if (!pwd) return;
  const btn = document.getElementById('btnSubmitAdmin');
  if (btn) btn.textContent = '...';
  try {
    const res = await gasRun('validateAdmin', pwd);
    if (res.success && res.valid) {
      hideAdminAuthModal();
      loadAdminDashboard();
    } else if (res.success && !res.valid) {
      showCustomAlert('Akses Ditolak', 'Sandi Proktor tidak valid. Coba lagi.', '🔐');
    } else {
      showCustomAlert('Gagal', 'Gagal: ' + (res.message || 'Unknown error'), '❌');
    }
  } catch (e) {
    console.error("Admin Auth Error:", e);
    showCustomAlert('Network Error', 'Network Error: ' + e.message, '🌐');
  }
  if (btn) btn.textContent = 'Verifikasi';
});

safeAddListener('btnAdminLogout', 'click', () => {
  showView('login-view');
  initPortal();
});

async function loadAdminDashboard() {
  showLoading('Memuat Intelijen Proktor...');
  try {
    const skipPeserta = !!(window.adminState && window.adminState.peserta && window.adminState.peserta.length > 0);
    const res = await gasRun('getAdminMonitoringData', skipPeserta);
    if (!skipPeserta) window.adminState.peserta = res.peserta || [];
    else res.peserta = window.adminState.peserta;
    if (res.success) {
      showView('admin-dash-view');
      renderAdminDashboard(res);
      loadAdminSyncStatus();
    } else {
      showCustomAlert('Gagal Memuat', 'Gagal memuat monitoring: ' + res.message, '❌');
      showView('login-view');
    }
  } catch (e) {
    showCustomAlert('Koneksi Gagal', 'Koneksi ke server gagal.', '🌐');
    showView('login-view');
  }
}

window.loadAdminSyncStatus = async function () {
  const countEl = document.getElementById('admin-sync-count');
  if (!countEl) return;
  try {
    countEl.textContent = 'Memuat data...';
    const snap = await db.ref('/status_sync').once('value');
    const data = snap.val() || {};
    const uniqueStudents = new Set();
    for (let examId in data) {
      for (let studentId in data[examId]) { uniqueStudents.add(studentId); }
    }
    const syncCount = uniqueStudents.size;
    const totalSiswa = (window.adminState && window.adminState.peserta) ? window.adminState.peserta.length : 0;
    if (totalSiswa > 0) {
      const pct = Math.min(100, Math.round((syncCount / totalSiswa) * 100));
      countEl.textContent = `${syncCount} / ${totalSiswa} Siswa Siap (${pct}%)`;
    } else { countEl.textContent = `${syncCount} Siswa Siap`; }
  } catch (e) { 
    console.error("Sync Status Error:", e);
    countEl.textContent = 'Gagal memuat.'; 
  }
};

window.adminState = { hasil: [], radar: [], monitor: null, monitorPage: {}, peserta: [], tempLogoBase64: null };

// [FUNGSI renderPaginationControls, renderAdminDashboard, dll tetap sama...]
// Untuk singkatnya, saya hanya show fungsi yang diubah

// ============================================
// FUNGSI UTAMA YANG DIPERBAIKI
// ============================================

window.loadAdminSettings = async function () {
  showLoading('Memuat Pengaturan...');
  try {
    // ✅ 1. Pastikan Firebase ready dulu
    console.log("Admin: Memastikan Firebase siap...");
    await ensureFirebaseReady();
    console.log("Admin: Firebase ready ✅");
    
    // ✅ 2. Connect dengan timeout protection
    if (window.dbConnectFast) {
      console.log("Admin: Connecting to Firebase...");
      const connectPromise = window.dbConnectFast();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Koneksi Firebase timeout setelah 10 detik')), 10000)
      );
      
      try {
        await Promise.race([connectPromise, timeoutPromise]);
        console.log("Admin: Firebase connected ✅");
      } catch (timeoutErr) {
        console.error("Admin: Connection timeout:", timeoutErr);
        throw new Error('Koneksi Firebase timeout. Periksa internet Anda.');
      }
    }
    
    // ✅ 3. Query Security dengan retry mechanism
    console.log("Admin: Mengambil data security dari Firebase...");
    const maxRetries = 3;
    let securityData = null;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Admin: Attempt ${attempt}/${maxRetries} - Query /config/security`);
        
        // Query dengan timeout 8 detik
        const snap = await Promise.race([
          db.ref('/config/security').once('value'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 8000)
          )
        ]);
        
        securityData = snap.val() || {};
        console.log("Admin: ✅ Data Security diterima:", securityData);
        break; // Berhasil, keluar dari loop
        
      } catch (queryErr) {
        lastError = queryErr;
        console.error(`Admin: ❌ Attempt ${attempt} failed:`, queryErr.message);
        
        if (attempt < maxRetries) {
          console.log(`Admin: Retry dalam 1 detik...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Jika semua retry gagal
    if (!securityData) {
      throw lastError || new Error('Gagal mengambil data security setelah 3 percobaan');
    }

    // Fungsi pembantu untuk mengambil nilai tanpa peduli huruf besar/kecil
    const getVal = (obj, key, fallback) => {
      if (!obj) return fallback;
      if (obj[key] !== undefined) return obj[key];
      const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
      return foundKey ? obj[foundKey] : fallback;
    };

    const isTrue = (v) => v === true || v === "true" || v === 1 || v === "1";

    // Bind ke UI dengan proteksi case-insensitive
    safeSetChecked('cfgPWA', isTrue(getVal(securityData, 'pwa', false)));
    safeSetChecked('cfgFullscreen', isTrue(getVal(securityData, 'fullscreen', false)));
    safeSetChecked('cfgAntiCheat', isTrue(getVal(securityData, 'anticheat', false)));
    
    // Default TRUE jika tidak ada data (undefined)
    const showExam = getVal(securityData, 'showExamStatus', undefined);
    safeSetChecked('cfgShowExamStatus', showExam !== false && showExam !== "false" && showExam !== 0 && showExam !== "0");
    
    const showSys = getVal(securityData, 'showSystemInfo', undefined);
    safeSetChecked('cfgShowSystemInfo', showSys !== false && showSys !== "false" && showSys !== 0 && showSys !== "0");
    
    safeSetValue('cfgMinTime', getVal(securityData, 'minTime', 0));
    safeSetValue('cfgBypassCode', getVal(securityData, 'bypassCode', ''));

    // ✅ 4. Load Identity dengan retry
    console.log("Admin: Mengambil data identity...");
    let identityData = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const idenSnap = await Promise.race([
          db.ref('/config/identity').once('value'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 8000)
          )
        ]);
        
        identityData = idenSnap.val() || {};
        console.log("Admin: ✅ Data Identity diterima:", identityData);
        break;
        
      } catch (queryErr) {
        console.error(`Admin: ❌ Identity query attempt ${attempt} failed:`, queryErr.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Jika identity gagal, tidak critical - use default
          console.warn("Admin: ⚠️ Menggunakan data identity default");
          identityData = {};
        }
      }
    }
    
    safeSetValue('cfgSchoolName', getVal(identityData, 'name', 'SMP Negeri 1 Dander'));
    safeSetValue('cfgSchoolSub', getVal(identityData, 'sub', 'MGMP INF/KKA BJN'));

    const preview = document.getElementById('cfgLogoPreview');
    if (preview) {
      const logo = getVal(identityData, 'logo', null);
      preview.innerHTML = logo ? `<img src="${logo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span class="text-muted" style="font-size:0.7rem;">No Logo</span>';
      window.adminState.tempLogoBase64 = logo;
    }

    // ✅ 5. Firebase Config (dari global fbConfig di script.js)
    if (typeof fbConfig !== 'undefined') {
      safeSetValue('fbApiKey', fbConfig.apiKey || '');
      safeSetValue('fbAuthDomain', fbConfig.authDomain || '');
      safeSetValue('fbDbUrl', fbConfig.databaseURL || '');
      safeSetValue('fbProjectId', fbConfig.projectId || '');
      safeSetValue('fbStorageBucket', fbConfig.storageBucket || '');
      safeSetValue('fbMessagingId', fbConfig.messagingSenderId || '');
      safeSetValue('fbAppId', fbConfig.appId || '');
    }

    console.log("Admin: 🎉 Pengaturan berhasil dimuat dari Firebase!");
    hideLoading();
    
  } catch (dbErr) {
    console.error("❌ Admin Load Error:", dbErr);
    hideLoading();
    
    // Better error messages
    if (dbErr.message.toLowerCase().includes('permission_denied') || 
        dbErr.message.toLowerCase().includes('permission denied')) {
      showCustomAlert(
        'Akses Ditolak', 
        'Firebase menolak akses. Cek Firebase Rules di Console.\n\nDetail: ' + dbErr.message, 
        '🚫'
      );
    } else if (dbErr.message.toLowerCase().includes('timeout')) {
      showCustomAlert(
        'Koneksi Lambat', 
        'Firebase tidak merespons. Periksa koneksi internet Anda.\n\nCoba reload halaman.', 
        '⏱️'
      );
    } else if (dbErr.message.toLowerCase().includes('tidak siap')) {
      showCustomAlert(
        'Firebase Belum Siap', 
        'Firebase belum ter-inisialisasi. Reload halaman.\n\nJika masalah berlanjut, cek konfigurasi Firebase.', 
        '⚙️'
      );
    } else {
      showCustomAlert(
        'Gagal Memuat', 
        'Error: ' + dbErr.message + '\n\nCoba reload halaman atau hubungi administrator.', 
        '❌'
      );
    }
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
  }
};

// ============================================
// BONUS: Force Reload Settings Function
// ============================================
window.forceReloadSettings = async function() {
  console.log("🔄 Force reloading settings...");
  showLoading('Memuat ulang data...');
  
  try {
    // Clear Firebase cache
    if ('caches' in window) {
      const cache = await caches.open('cbt-cache-v1');
      const keys = await cache.keys();
      for (let request of keys) {
        const url = request.url;
        if (url.includes('firebase') || url.includes('googleapis') || url.includes('config')) {
          await cache.delete(request);
          console.log('🗑️ Cleared cache:', url);
        }
      }
    }
    
    // Force disconnect & reconnect
    if (window.dbDisconnect) {
      await window.dbDisconnect();
      console.log('📡 Disconnected from Firebase');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reload settings
    await loadAdminSettings();
    
    showCustomAlert('Berhasil', 'Data berhasil dimuat ulang dari Firebase!', '✅');
    
  } catch (err) {
    console.error('❌ Force reload error:', err);
    hideLoading();
    showCustomAlert('Gagal', 'Gagal memuat ulang: ' + err.message, '❌');
  }
};

// [Fungsi lainnya tetap sama seperti aslinya...]

safeAddListener('cfgLogoInput', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showCustomAlert('File Terlalu Besar', 'Ukuran file melebihi 1MB.', '📁');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64 = event.target.result;
    window.adminState.tempLogoBase64 = base64;
    const preview = document.getElementById('cfgLogoPreview');
    if (preview) preview.innerHTML = `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
  };
  reader.readAsDataURL(file);
});

window.saveAdminSettings = async function () {
  showLoading('Menyimpan...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();

    const sec = {
      pwa: document.getElementById('cfgPWA') ? document.getElementById('cfgPWA').checked : false,
      fullscreen: document.getElementById('cfgFullscreen') ? document.getElementById('cfgFullscreen').checked : false,
      anticheat: document.getElementById('cfgAntiCheat') ? document.getElementById('cfgAntiCheat').checked : false,
      showExamStatus: document.getElementById('cfgShowExamStatus') ? document.getElementById('cfgShowExamStatus').checked : true,
      showSystemInfo: document.getElementById('cfgShowSystemInfo') ? document.getElementById('cfgShowSystemInfo').checked : true,
      minTime: parseInt(safeGetValue('cfgMinTime')) || 0,
      bypassCode: safeGetValue('cfgBypassCode').trim().toUpperCase() || null
    };
    await db.ref('/config/security').set(sec);

    const iden = {
      name: safeGetValue('cfgSchoolName').trim(),
      sub: safeGetValue('cfgSchoolSub').trim(),
      logo: window.adminState.tempLogoBase64
    };
    await db.ref('/config/identity').set(iden);

    const newFbConfig = {
      apiKey: safeGetValue('fbApiKey').trim(),
      authDomain: safeGetValue('fbAuthDomain').trim(),
      databaseURL: safeGetValue('fbDbUrl').trim(),
      projectId: safeGetValue('fbProjectId').trim(),
      storageBucket: safeGetValue('fbStorageBucket').trim(),
      messagingSenderId: safeGetValue('fbMessagingId').trim(),
      appId: safeGetValue('fbAppId').trim()
    };

    if (newFbConfig.apiKey && newFbConfig.apiKey !== fbConfig.apiKey) {
      if (confirm("Perubahan database memerlukan muat ulang. Lanjutkan?")) {
        localStorage.setItem('CBT_FB_CONFIG', JSON.stringify(newFbConfig));
        window.location.reload();
        return;
      }
    } else if (newFbConfig.apiKey) {
      localStorage.setItem('CBT_FB_CONFIG', JSON.stringify(newFbConfig));
    }

    hideLoading();
    showCustomAlert('Berhasil Disimpan', 'Pengaturan berhasil disimpan!', '✅');
  } catch (e) {
    console.error(e);
    hideLoading();
    showCustomAlert('Gagal Menyimpan', 'Gagal: ' + e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
  }
};

window.resetFirebaseConfig = function () {
  if (confirm("Reset konfigurasi Firebase ke bawaan sistem?")) {
    localStorage.removeItem('CBT_FB_CONFIG');
    window.location.reload();
  }
};

window.toggleAbsenMode = function() {
  loadAdminDashboard();
};

window.promptBroadcast = async function(examId) {
  const msg = prompt("Ketik pesan broadcast untuk siswa:");
  if (msg && msg.trim() !== '') {
    showLoading('Menyiarkan...');
    try {
      const res = await gasRun('sendBroadcastAdmin', examId, msg.trim());
      if (res.success) showCustomAlert('Berhasil', 'Pesan disiarkan!', '📢');
      else showCustomAlert('Gagal', 'Gagal menyiarkan pesan.', '❌');
    } catch (ex) { showCustomAlert('Gagal', 'Koneksi bermasalah.', '🌐'); }
    hideLoading();
  }
};

window.previewSoal = function(examId) {
  showAdminPreview(examId);
};

window.openSoalEditorPage = function(bankId) {
  showCustomAlert('Info', 'Membuka Editor Soal untuk: ' + bankId, '📝');
};
