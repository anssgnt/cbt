window.showAdminAuthModal = function () {
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
    // Gunakan db.ref directly karena sudah dipatch secara otomatis
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
         <div style="font-weight:600;">${x.nama}</div>
         <div style="color:var(--danger); font-family:var(--mono); font-size:1.2rem; font-weight:700; letter-spacing:2px;">${x.token || '---'}</div>
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
      return { html: `<tr><td>${p.nama}</td><td>${p.kelas}</td><td><span class="status-badge ${badgeClass}">${d}</span></td></tr>`, stat: d };
    });
    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const filterRows = rRaw.filter(x => !absenMode || x.stat === 'BELUM');
    const page = window.adminState.monitorPage[ex.id] || 1;
    const perPage = 20;
    const slicedRows = filterRows.slice((page - 1) * perPage, page * perPage).map(x => x.html).join('');
    return `
       <div class="admin-exam-card">
         <h4 style="display:flex; justify-content:space-between; align-items:center;">
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
    else if (btn.dataset.tab === 'tab-hasil') loadAdminHasil(true);
  });
});

window.forceRefreshAdminTab = function () {
  const activeTabBtn = document.querySelector('.admin-sidebar-btn.active');
  if (!activeTabBtn || !activeTabBtn.dataset.tab) {
    loadAdminDashboard();
    return;
  }
  const tab = activeTabBtn.dataset.tab;
  if (tab === 'tab-jadwal') loadAdminJadwal();
  else if (tab === 'tab-siswa') loadAdminSiswa();
  else if (tab === 'tab-soal') loadAdminSoal();
  else if (tab === 'tab-settings') loadAdminSettings();
  else if (tab === 'tab-hasil') loadAdminHasil(true);
  else loadAdminDashboard();
};

async function loadAdminSiswa() {
  const tbody = document.getElementById('admin-siswa-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat...</td></tr>';
  
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    const snap = await db.ref('/peserta').once('value');
    const data = snap.val() || {};
    let html = '';
    for (let id in data) {
      html += `<tr><td><strong>${id}</strong></td><td>${data[id].nama}</td><td>${data[id].kelas}</td><td><button class="btn btn-outline" onclick="editSiswa('${id}')">📝</button> <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteSiswa('${id}')">🗑️</button></td></tr>`;
    }
    tbody.innerHTML = html || '<tr><td colspan="4" class="text-center">Belum ada data siswa.</td></tr>';
  } catch (e) {
    console.error(e);
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
  }
}

async function loadAdminSoal() {
  const tbody = document.getElementById('admin-soal-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">Memuat...</td></tr>';
  
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    const snap = await db.ref('/soal').once('value');
    const data = snap.val() || {};
    let html = '';
    for (let bankId in data) {
      html += `<tr><td><strong>${bankId}</strong> <br><small>${Object.keys(data[bankId]).length} soal</small></td><td><button class="btn btn-outline" onclick="previewSoal('${bankId}')">👁️</button> <button class="btn btn-primary" onclick="openSoalEditorPage('${bankId}')">📝</button> <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteBankSoal('${bankId}')">🗑️</button></td></tr>`;
    }
    tbody.innerHTML = html || '<tr><td colspan="2" class="text-center">Belum ada bank soal.</td></tr>';
  } catch (e) {
    console.error(e);
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
  }
}

async function loadAdminJadwal() {
  const tbody = document.getElementById('admin-jadwal-tbody');
  if (!tbody) return;
  
  showLoading('Memuat Jadwal...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    const snap = await db.ref('/jadwal').once('value');
    const data = snap.val() || {};
    
    let html = '';
    for (let id in data) {
      const j = data[id];
      const badgeClass = j.aktif ? 'badge-live' : 'badge-wait';
      const statusText = j.aktif ? 'AKTIF' : 'NONAKTIF';
      html += `
          <tr>
            <td><strong>${id}</strong></td>
            <td>${j.nama}</td>
            <td>${j.nama_soal}</td>
            <td>
              <span class="badge ${badgeClass}">${statusText}</span>
              <code style="display:block; margin-top:4px; font-weight:bold; color:var(--danger);">${j.token || '-'}</code>
            </td>
            <td>
              <button class="btn btn-outline" style="color:#2563EB" onclick="openPrintModal('${id}', '${j.nama}')">🖨️ Cetak</button>
              <button class="btn btn-outline" onclick="openJadwalModal('${id}')">📝 Edit</button>
              <button class="btn btn-outline" style="color:var(--danger)" onclick="deleteJadwal('${id}')">🗑️</button>
            </td>
          </tr>`;
    }
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center">Belum ada jadwal.</td></tr>';
  } catch (e) { 
    console.error(e); 
    showCustomAlert('Gagal', 'Gagal memuat jadwal dari Firebase.', '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
}

async function loadAdminHasil(resetPage = false) {
  const tbHasil = document.getElementById('admin-hasil-tbody');
  const tbRadar = document.getElementById('admin-radar-tbody');

  if (resetPage) {
    if (tbHasil) tbHasil.innerHTML = '<tr><td colspan="4" class="text-center">Memuat...</td></tr>';
    if (tbRadar) tbRadar.innerHTML = '<tr><td colspan="4" class="text-center">Memuat...</td></tr>';

    const res = await gasRun('getAdminLaporanLengkap');
    if (res.success) {
      window.adminState.hasil = res.hasil || [];
      window.adminState.radar = res.pelanggaran || [];
    }
  }
  renderAdminHasilPage(1);
  renderAdminRadarPage(1);
}

function renderAdminRadarPage(page) {
  const perPage = 20;
  const tbRadar = document.getElementById('admin-radar-tbody');
  if (!tbRadar) return;

  const data = window.adminState.radar || [];
  const sliced = data.slice((page - 1) * perPage, page * perPage);

  if (sliced.length === 0) {
    tbRadar.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada log pelanggaran.</td></tr>';
  } else {
    tbRadar.innerHTML = sliced.map(p => `
      <tr>
        <td>${p.waktu}</td>
        <td><strong>${p.nama}</strong></td>
        <td>${p.ujian}</td>
        <td><span class="badge" style="background:#FEE2E2; color:#B91C1C; border:1px solid #FECACA;">${p.tipe}</span></td>
      </tr>
    `).join('');
  }
  renderPaginationControls('admin-radar-pagination', data.length, perPage, page, 'renderAdminRadarPage');
}

function renderAdminHasilPage(page) {
  const perPage = 20;
  const tbHasil = document.getElementById('admin-hasil-tbody');
  const data = window.adminState.hasil || [];
  const search = document.getElementById('admin-hasil-search')?.value?.toLowerCase() || '';
  const filtered = data.filter(h => h.nama.toLowerCase().includes(search) || h.ujian.toLowerCase().includes(search));
  const sliced = filtered.slice((page - 1) * perPage, page * perPage);
  tbHasil.innerHTML = sliced.map(h => `<tr><td>${h.waktu}</td><td>${h.nama}</td><td>${h.ujian}</td><td>${h.skor}</td></tr>`).join('');
  renderPaginationControls('admin-hasil-pagination', filtered.length, perPage, page, 'renderAdminHasilPage');
}

window.loadAdminSettings = async function () {
  showLoading('Memuat Pengaturan...');
  try {
    // 1. Pastikan Auth Siap sebelum query Firebase
    if (window.authPromise) {
      console.log("Admin: Menunggu Auth...");
      await window.authPromise;
    }

    // Cek status auth secara eksplisit
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.error("Admin: User belum terautentikasi! Pastikan 'Anonymous Auth' aktif di Firebase Console.");
      showCustomAlert('Auth Gagal', 'Sesi Firebase belum siap. Silakan refresh halaman.', '🔐');
      return;
    }
    console.log("Admin: Auth OK (UID:", currentUser.uid, ")");

    // 2. Diagnosa Koneksi (Gunakan dbConnectFast agar admin tidak kena jitter 1.5 detik)
    console.log("Admin: Memulai koneksi database...");
    if (window.dbConnectFast) await window.dbConnectFast();

    try {
      console.log("Admin: Mengambil data security...");
      const snap = await db.ref('/config/security').once('value');

      const sec = snap.val() || {};
      console.log("Admin: Data Security diterima:", sec);

      // Fungsi pembantu untuk mengambil nilai tanpa peduli huruf besar/kecil
      const getVal = (obj, key, fallback) => {
        if (!obj) return fallback;
        if (obj[key] !== undefined) return obj[key];
        const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
        return foundKey ? obj[foundKey] : fallback;
      };

      const isTrue = (v) => v === true || v === "true" || v === 1 || v === "1";

      // Bind ke UI dengan proteksi case-insensitive
      safeSetChecked('cfgPWA', isTrue(getVal(sec, 'pwa', false)));
      safeSetChecked('cfgFullscreen', isTrue(getVal(sec, 'fullscreen', false)));
      safeSetChecked('cfgAntiCheat', isTrue(getVal(sec, 'anticheat', false)));

      // Default TRUE jika tidak ada data (undefined)
      const showExam = getVal(sec, 'showExamStatus', undefined);
      safeSetChecked('cfgShowExamStatus', showExam !== false && showExam !== "false" && showExam !== 0 && showExam !== "0");

      const showSys = getVal(sec, 'showSystemInfo', undefined);
      safeSetChecked('cfgShowSystemInfo', showSys !== false && showSys !== "false" && showSys !== 0 && showSys !== "0");

      safeSetValue('cfgMinTime', getVal(sec, 'minTime', 0));
      safeSetValue('cfgBypassCode', getVal(sec, 'bypassCode', ''));

      // 3. Load Identity
      console.log("Admin: Mengambil data identity...");
      const idenSnap = await db.ref('/config/identity').once('value');
      const iden = idenSnap.val() || {};
      console.log("Admin: Data Identity diterima:", iden);

      safeSetValue('cfgSchoolName', getVal(iden, 'name', 'SMP Negeri 1 Dander'));
      safeSetValue('cfgSchoolSub', getVal(iden, 'sub', 'MGMP INF/KKA BJN'));

      const preview = document.getElementById('cfgLogoPreview');
      if (preview) {
        const logo = getVal(iden, 'logo', null);
        preview.innerHTML = logo ? `<img src="${logo}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span class="text-muted" style="font-size:0.7rem;">No Logo</span>';
        window.adminState.tempLogoBase64 = logo;
      }

      // 4. Firebase Config (dari global firebaseConfig di script.js)
      if (typeof firebaseConfig !== 'undefined') {
        safeSetValue('fbApiKey', firebaseConfig.apiKey || '');
        safeSetValue('fbAuthDomain', firebaseConfig.authDomain || '');
        safeSetValue('fbDbUrl', firebaseConfig.databaseURL || '');
        safeSetValue('fbProjectId', firebaseConfig.projectId || '');
        safeSetValue('fbStorageBucket', firebaseConfig.storageBucket || '');
        safeSetValue('fbMessagingId', firebaseConfig.messagingSenderId || '');
        safeSetValue('fbAppId', firebaseConfig.appId || '');
      }

      console.log("Admin: Pengaturan berhasil dimuat dari Firebase ✅");

      // Force UI alert for diagnostic purposes (User cannot see console)
      showCustomAlert('Diagnostic Info', `Data Security: ${JSON.stringify(sec).substring(0, 50)}...`, '✅');

    } catch (dbErr) {
      console.error("Admin DB Query Error:", dbErr);
      if (dbErr.message.toLowerCase().includes('permission_denied') || dbErr.message.toLowerCase().includes('permission denied')) {
        showCustomAlert('Akses Ditolak', 'Firebase menolak akses (Permission Denied). Cek Rules di Firebase Console.', '🚫');
      } else {
        throw dbErr;
      }
    }
  } catch (e) {
    console.error("Admin Load General Error:", e);
    showCustomAlert('Gagal Memuat', 'Kesalahan sistem: ' + e.message, '❌');
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

window.toggleAbsenMode = function () {
  loadAdminDashboard();
};

window.promptBroadcast = async function (examId) {
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

window.previewSoal = function (examId) {
  showAdminPreview(examId);
};

window.openSoalEditorPage = function (bankId) {
  window.open('soal-editor.html?bank=' + bankId, '_blank');
};

window.deleteJadwal = async function (id) {
  if (confirm(`Hapus jadwal "${id}"? Data hasil pengerjaan terkait jadwal ini mungkin akan tetap ada di database.`)) {
    showLoading('Menghapus Jadwal...');
    try {
      if (window.dbConnectFast) await window.dbConnectFast();
      await db.ref('/jadwal/' + id).remove();
      showCustomAlert('Berhasil', 'Jadwal berhasil dihapus.', '✅');
      loadAdminJadwal();
    } catch (e) {
      showCustomAlert('Gagal', 'Gagal menghapus: ' + e.message, '❌');
    } finally {
      if (window.dbDisconnect) window.dbDisconnect();
      hideLoading();
    }
  }
};

window.deleteBankSoal = async function (bankId) {
  if (confirm(`PERINGATAN: Hapus bank soal "${bankId}"? SELURUH butir soal di dalamnya akan terhapus secara permanen!`)) {
    showLoading('Menghapus Bank Soal...');
    try {
      if (window.dbConnectFast) await window.dbConnectFast();
      await db.ref('/soal/' + bankId).remove();
      // Hapus juga kunci jawaban
      await db.ref('/kunci/' + bankId).remove();
      showCustomAlert('Berhasil', 'Bank soal berhasil dihapus.', '✅');
      loadAdminSoal();
    } catch (e) {
      showCustomAlert('Gagal', 'Gagal menghapus: ' + e.message, '❌');
    } finally {
      if (window.dbDisconnect) window.dbDisconnect();
      hideLoading();
    }
  }
};

window.deleteSiswa = async function (id) {
  if (confirm(`Hapus data siswa dengan ID "${id}"?`)) {
    showLoading('Menghapus Siswa...');
    try {
      if (window.dbConnectFast) await window.dbConnectFast();
      await db.ref('/peserta/' + id).remove();
      showCustomAlert('Berhasil', 'Siswa berhasil dihapus.', '✅');
      loadAdminSiswa();
    } catch (e) {
      showCustomAlert('Gagal', 'Gagal menghapus: ' + e.message, '❌');
    } finally {
      if (window.dbDisconnect) window.dbDisconnect();
      hideLoading();
    }
  }
};

let _editSiswaId = null;

window.openSiswaModal = function (id = null) {
  _editSiswaId = id;
  const overlay = document.getElementById('siswa-overlay');
  const modal = document.getElementById('siswa-modal');
  if (!overlay || !modal) return;

  overlay.classList.add('active');
  modal.style.display = 'flex';
  
  if (id) {
    document.getElementById('siswa-modal-title').innerText = 'Edit Siswa';
    showLoading('Memuat data siswa...');
    db.ref('/peserta/' + id).once('value').then(snap => {
      const data = snap.val();
      if (data) {
        document.getElementById('siswaIdInput').value = id;
        document.getElementById('siswaIdInput').readOnly = true;
        document.getElementById('siswaNamaInput').value = data.nama || '';
        document.getElementById('siswaKelasInput').value = data.kelas || '';
      }
      hideLoading();
    }).catch(e => {
      hideLoading();
      showCustomAlert('Gagal', 'Gagal memuat data siswa.', '❌');
    });
  } else {
    document.getElementById('siswa-modal-title').innerText = 'Tambah Siswa';
    document.getElementById('siswaIdInput').value = '';
    document.getElementById('siswaIdInput').readOnly = false;
    document.getElementById('siswaNamaInput').value = '';
    document.getElementById('siswaKelasInput').value = '';
  }
  
  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closeSiswaModal = function () {
  const overlay = document.getElementById('siswa-overlay');
  const modal = document.getElementById('siswa-modal');
  if (!overlay || !modal) return;

  overlay.classList.remove('active');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }, 300);
};

window.editSiswa = function (id) {
  openSiswaModal(id);
};

window.saveSiswa = async function () {
  const idInput = document.getElementById('siswaIdInput');
  const namaInput = document.getElementById('siswaNamaInput');
  const kelasInput = document.getElementById('siswaKelasInput');
  
  if (!idInput || !namaInput || !kelasInput) return;

  const id = idInput.value.trim();
  const nama = namaInput.value.trim();
  const kelas = kelasInput.value.trim();
  
  if (!id || !nama || !kelas) {
    return showCustomAlert('Data Tidak Lengkap', 'Harap isi semua field.', '📝');
  }
  
  showLoading('Menyimpan Data Siswa...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    const payload = {
      nama: nama,
      nama_lower: nama.toLowerCase(),
      kelas: kelas
    };
    await db.ref('/peserta/' + id).set(payload);
    showCustomAlert('Berhasil', 'Data siswa berhasil disimpan.', '✅');
    closeSiswaModal();
    loadAdminSiswa();
  } catch (e) {
    showCustomAlert('Gagal', 'Gagal menyimpan: ' + e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};
