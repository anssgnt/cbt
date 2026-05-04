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
    await dbConnectFast();
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
  } catch (e) { countEl.textContent = 'Gagal memuat.'; }
  finally { dbDisconnect(); }
};

window.adminState = { hasil: [], radar: [], monitor: null, monitorPage: {}, peserta: [], tempLogoBase64: null };

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
  const tl = document.getElementById('admin-token-list');
  if (data.activeExams.length > 0) {
    tl.innerHTML = data.activeExams.map(x => `
       <div style="border-bottom:1px solid var(--border); padding-bottom:8px;">
         <div style="font-weight:600;">\${x.nama}</div>
         <div style="color:var(--danger); font-family:var(--mono); font-size:1.2rem; font-weight:700; letter-spacing:2px;">\${x.token}</div>
       </div>
     `).join('');
  } else { tl.innerHTML = '<p class="text-muted">Tidak ada ujian aktif.</p>'; }
  const ml = document.getElementById('admin-monitoring-list');
  if (data.activeExams.length === 0) {
    ml.innerHTML = '<p class="text-muted">Tidak ada evaluasi kepesertaan.</p>';
    return;
  }
  ml.innerHTML = data.activeExams.map(ex => {
    let selesai = 0, mengerjakan = 0, blmSelesai = 0;
    const completedSet = new Set(data.completions[ex.id] || []);
    const rRaw = data.peserta.map(p => {
      let d = 'BELUM';
      let badgeClass = 'status-belum';
      const isOnline = (data.onlines && data.onlines[ex.id] && (p.id in data.onlines[ex.id]));
      if (completedSet.has(p.id)) { d = 'SELESAI'; badgeClass = 'status-selesai'; selesai++; }
      else if (isOnline) { d = 'MENGERJAKAN'; badgeClass = 'status-online'; mengerjakan++; }
      else { blmSelesai++; }
      return { html: \`<tr><td>\${p.nama}</td><td>\${p.kelas}</td><td><span class="status-badge \${badgeClass}">\${d}</span></td></tr>\`, stat: d };
    });
    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const filterRows = rRaw.filter(x => !absenMode || x.stat === 'BELUM');
    const page = window.adminState.monitorPage[ex.id] || 1;
    const perPage = 20;
    const slicedRows = filterRows.slice((page - 1) * perPage, page * perPage).map(x => x.html).join('');
    return `
       <div class="admin-exam-card">
         <h4 style="align-items:center;">
           <span>\${ex.nama}</span>
           <button class="btn btn-outline" style="border-color:#38BDF8; color:#0284C7; padding:4px 10px; font-size:0.75rem;" onclick="promptBroadcast('\${ex.id}')">📢 Kirim Pesan</button>
         </h4>
         <div class="admin-table-wrap">
           <table class="admin-table">
             <thead><tr><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead>
             <tbody>\${slicedRows || '<tr><td colspan="3" class="text-muted text-center" style="padding:16px;">(Semua siswa sudah masuk)</td></tr>'}</tbody>
           </table>
         </div>
         <div id="admin-monitor-pg-\${ex.id}" class="pagination-controls"></div>
         <div class="admin-stats" style="margin-top:12px;">
           <span>Total: <b>\${data.peserta.length}</b></span>
           <span class="stat-done">Selesai: <b>\${selesai}</b></span>
           <span style="color:var(--primary);">Aktif: <b>\${mengerjakan}</b></span>
           <span class="stat-pending">Kosong: <b>\${blmSelesai}</b></span>
         </div>
       </div>
     `;
  }).join('');
  data.activeExams.forEach(ex => {
    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const completedSet = new Set(data.completions[ex.id] || []);
    let rawTotal = 0;
    data.peserta.forEach(p => {
      const hasSelesai = completedSet.has(p.id);
      const hasMengerjakan = (data.onlines && data.onlines[ex.id] && (p.id in data.onlines[ex.id]));
      const stat = hasSelesai ? 'SELESAI' : (hasMengerjakan ? 'MENGERJAKAN' : 'BELUM');
      if (!absenMode || stat === 'BELUM') rawTotal++;
    });
    renderPaginationControls(`admin-monitor-pg-\${ex.id}`, rawTotal, 20, window.adminState.monitorPage[ex.id] || 1, 'changeMonitorPage', ex.id);
  });
}

function changeMonitorPage(page, examId) {
  window.adminState.monitorPage[examId] = page;
  renderAdminDashboard(window.adminState.monitor);
}

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
    else if (btn.dataset.tab === 'tab-settings') loadAdminSettings();
    else if (btn.dataset.tab === 'tab-laporan') loadAdminHasil(true);
  });
});

async function loadAdminSiswa() {
  const tbody = document.getElementById('admin-siswa-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat...</td></tr>';
  const snap = await db.ref('/peserta').once('value');
  const data = snap.val() || {};
  let html = '';
  for (let id in data) {
    html += `<tr><td><strong>\${id}</strong></td><td>\${data[id].nama}</td><td>\${data[id].kelas}</td><td><button class="btn btn-outline" onclick="editSiswa('\${id}')">📝</button> <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteSiswa('\${id}')">🗑️</button></td></tr>`;
  }
  tbody.innerHTML = html;
}

async function loadAdminSoal() {
  const tbody = document.getElementById('admin-soal-tbody');
  tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Memuat...</td></tr>';
  const snap = await db.ref('/soal').once('value');
  const data = snap.val() || {};
  let html = '';
  for (let bankId in data) {
    html += `<tr><td><strong>\${bankId}</strong> <br><small>\${Object.keys(data[bankId]).length} soal</small></td><td><button class="btn btn-outline" onclick="previewSoal('\${bankId}')">👁️</button> <button class="btn btn-primary" onclick="openSoalEditorPage('\${bankId}')">📝</button></td></tr>`;
  }
  tbody.innerHTML = html;
}

async function loadAdminJadwal() {
  const tbody = document.getElementById('admin-jadwal-tbody');
  try {
    const res = await gasRun('getAdminJadwalFull');
    if (res.success) {
      if (tbody) tbody.innerHTML = res.data.map(j => `<tr><td>\${j.id}</td><td>\${j.nama}</td><td>\${j.nama_soal}</td><td><button class="btn btn-outline" onclick="openJadwalModal('\${j.id}')">📝</button></td></tr>`).join('');
    }
  } catch (e) { console.error(e); }
}

async function loadAdminHasil(resetPage = false) {
  const tbHasil = document.getElementById('admin-hasil-tbody');
  if (resetPage) {
    tbHasil.innerHTML = '<tr><td colspan="4" class="text-center">Memuat...</td></tr>';
    const res = await gasRun('getAdminLaporanLengkap');
    if (res.success) {
      window.adminState.hasil = res.hasil;
      window.adminState.radar = res.pelanggaran;
    }
  }
  renderAdminHasilPage(1);
}

function renderAdminHasilPage(page) {
  const perPage = 20;
  const tbHasil = document.getElementById('admin-hasil-tbody');
  const data = window.adminState.hasil || [];
  const search = document.getElementById('admin-hasil-search')?.value?.toLowerCase() || '';
  const filtered = data.filter(h => h.nama.toLowerCase().includes(search) || h.ujian.toLowerCase().includes(search));
  const sliced = filtered.slice((page - 1) * perPage, page * perPage);
  tbHasil.innerHTML = sliced.map(h => `<tr><td>\${h.waktu}</td><td>\${h.nama}</td><td>\${h.ujian}</td><td>\${h.skor}</td></tr>`).join('');
  renderPaginationControls('admin-hasil-pagination', filtered.length, perPage, page, 'renderAdminHasilPage');
}

window.loadAdminSettings = async function () {
  const settingsTab = document.getElementById('tab-settings');
  if (!settingsTab) return;

  showLoading('Sinkronisasi Firebase...');
  try {
    // 1. Cek & Tunggu Auth (Hanya menunggu jika belum ready)
    if (window.authPromise) {
      console.log("Auth Status: Waiting for session...");
      await window.authPromise;
      console.log("Auth Status: Ready!");
    }

    // 2. Paksa Online
    if (window.dbConnectFast) await window.dbConnectFast();
    
    const dbUrl = (db && db.app && db.app.options) ? db.app.options.databaseURL : 'Unknown';
    console.log("Firebase Connected to:", dbUrl);
    
    // 3. Ambil data Security
    console.log("Requesting path: /config/security");
    const snap = await db.ref('/config/security').once('value');
    const sec = snap.val();
    
    if (sec === null) {
      console.warn("Data /config/security tidak ditemukan (null). Menggunakan default UI.");
    } else {
      console.log("Data Security Received:", sec);
    }

    const s = sec || {};
    safeSetChecked('cfgPWA', s.pwa === true || s.pwa === "true" || s.pwa === 1 || s.pwa === "1");
    safeSetChecked('cfgFullscreen', s.fullscreen === true || s.fullscreen === "true" || s.fullscreen === 1 || s.fullscreen === "1");
    safeSetChecked('cfgAntiCheat', s.anticheat === true || s.anticheat === "true" || s.anticheat === 1 || s.anticheat === "1");
    
    // Default TRUE jika data tidak ada
    safeSetChecked('cfgShowExamStatus', s.showExamStatus !== false && s.showExamStatus !== "false" && s.showExamStatus !== 0);
    safeSetChecked('cfgShowSystemInfo', s.showSystemInfo !== false && s.showSystemInfo !== "false" && s.showSystemInfo !== 0);
    
    safeSetValue('cfgMinTime', s.minTime || 0);
    safeSetValue('cfgBypassCode', s.bypassCode || '');

    // 4. Ambil data Identitas
    console.log("Requesting path: /config/identity");
    const idenSnap = await db.ref('/config/identity').once('value');
    const iden = idenSnap.val() || {};
    console.log("Data Identity Received:", iden);
    
    if (iden.name) safeSetValue('cfgSchoolName', iden.name);
    if (iden.sub) safeSetValue('cfgSchoolSub', iden.sub);

    const preview = document.getElementById('cfgLogoPreview');
    if (preview) {
      preview.innerHTML = iden.logo ? `<img src="${iden.logo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span class="text-muted" style="font-size:0.7rem;">No Logo</span>';
      window.adminState.tempLogoBase64 = iden.logo || null;
    }

    // 5. Update Firebase Config Fields (Untuk diedit)
    const cfg = window.firebaseConfig || {};
    safeSetValue('fbApiKey', cfg.apiKey || '');
    safeSetValue('fbAuthDomain', cfg.authDomain || '');
    safeSetValue('fbDbUrl', cfg.databaseURL || '');
    safeSetValue('fbProjectId', cfg.projectId || '');
    safeSetValue('fbStorageBucket', cfg.storageBucket || '');
    safeSetValue('fbMessagingId', cfg.messagingSenderId || '');
    safeSetValue('fbAppId', cfg.appId || '');

  } catch (e) {
    console.error("Firebase Sync Error:", e);
    if (e.message && e.message.toLowerCase().includes('permission_denied')) {
      showCustomAlert('Izin Ditolak', 'Database menolak akses. Cek Rules Firebase Anda.', '🔐');
    } else {
      showCustomAlert('Gagal Sinkron', 'Gagal: ' + e.message, '❌');
    }
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};

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

    if (newFbConfig.apiKey && newFbConfig.apiKey !== firebaseConfig.apiKey) {
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
