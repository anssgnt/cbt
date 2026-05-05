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
      let actionBtn = '';
      const onData = (data.onlines && data.onlines[ex.id]) ? data.onlines[ex.id][p.id] : null;
      const isOnline = !!onData;
      
      let progressInfo = '';
      if (completedSet.has(p.id)) { d = 'SELESAI'; badgeClass = 'status-selesai'; selesai++; }
      else if (isOnline) { 
        d = 'MENGERJAKAN'; badgeClass = 'status-online'; mengerjakan++; 
        actionBtn = `<button class="btn btn-outline" style="padding:2px 6px; font-size:0.65rem; color:var(--danger); border-color:#FECACA;" onclick="resetSiswaLogin('${p.id}', '${ex.id}')">🔄 Reset</button>`;
        
        if (onData.progress !== undefined && onData.total !== undefined) {
          const pct = Math.round((onData.progress / onData.total) * 100) || 0;
          progressInfo = `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Prog: ${onData.progress}/${onData.total} (${pct}%)</div>`;
        }
      }
      else { blmSelesai++; }
      return { html: `<tr><td>${p.nama}</td><td>${p.kelas}</td><td><div style="display:flex; flex-direction:column;"><div style="display:flex; align-items:center; gap:8px;"><span class="status-badge ${badgeClass}">${d}</span>${actionBtn}</div>${progressInfo}</div></td></tr>`, stat: d };
    });
    const absenMode = document.getElementById('chkAbsenMode') ? document.getElementById('chkAbsenMode').checked : false;
    const filterRows = rRaw.filter(x => !absenMode || x.stat === 'BELUM');
    const page = window.adminState.monitorPage[ex.id] || 1;
    const perPage = 20;
    const slicedRows = filterRows.slice((page - 1) * perPage, page * perPage).map(x => x.html).join('');
    return `
       <div class="admin-exam-card">
          <h4 style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
            <span>${ex.nama}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-outline" style="border-color:#38BDF8; color:#0284C7; padding:4px 10px; font-size:0.75rem;" onclick="promptBroadcast('${ex.id}')">📢 Pesan</button>
              <button class="btn btn-outline" style="border-color:#F87171; color:#B91C1C; padding:4px 10px; font-size:0.75rem;" onclick="forceSelesaiSemua('${ex.id}')">⚡ Selesaikan Semua</button>
            </div>
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
      const isAktif = j.aktif;
      const isForce = j.force_aktif;
      const color = isAktif ? '#059669' : '#DC2626';
      html += `
          <tr>
            <td>
              <div style="font-weight:700;">${j.nama}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${id} | Bank: ${j.nama_soal}</div>
            </td>
            <td>
              <div style="font-size:0.75rem;">${j.mulai ? new Date(j.mulai).toLocaleString('id-ID') : '-'}</div>
              <div style="font-size:0.75rem;">${j.selesai ? new Date(j.selesai).toLocaleString('id-ID') : '-'}</div>
            </td>
            <td>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span class="status-dot" style="background:${color};"></span>
                  <span style="font-size:0.75rem; font-weight:700; color:${color};">${isAktif ? 'AKTIF' : 'NONAKTIF'}</span>
                </div>
                <code style="font-size:0.8rem; font-weight:bold; color:var(--primary);">${j.token || '-'}</code>
                ${isForce ? '<span style="font-size:0.6rem; background:#FEE2E2; color:#B91C1C; padding:1px 4px; border-radius:4px; width:fit-content; font-weight:bold;">OVERRIDE</span>' : ''}
              </div>
            </td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="openJadwalModal('${id}')">⚙️ Edit</button>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="openAnalisisModal('${id}', '${j.nama}')">📊 Analisis</button>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#2563EB" onclick="openPrintModal('${id}', '${j.nama}')">🖨️ Cetak</button>
                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:var(--danger); border-color:#FECACA;" onclick="deleteJadwal('${id}')">🗑️</button>
              </div>
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

window.openJadwalModal = async function (editId = null) {
  const overlay = document.getElementById('jadwal-overlay');
  const modal = document.getElementById('jadwal-modal');
  if (!overlay || !modal) return;

  // Helper for datetime-local format
  const toLocalISO = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  overlay.classList.add('active');
  modal.style.display = 'flex';
  
  showLoading('Menyiapkan Form...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    
    // Load bank soal options
    const sSnap = await db.ref('/soal').once('value');
    const sData = sSnap.val() || {};
    const select = document.getElementById('jSoal');
    if (select) {
      select.innerHTML = '<option value="">-- Pilih Bank Soal --</option>' + 
        Object.keys(sData).map(k => `<option value="${k}">${k} (${Object.keys(sData[k]).length} soal)</option>`).join('');
    }

    if (editId) {
      document.getElementById('jadwal-modal-title').innerText = 'Edit Jadwal: ' + editId;
      const snap = await db.ref('/jadwal/' + editId).once('value');
      const data = snap.val() || {};
      document.getElementById('jId').value = editId;
      document.getElementById('jId').readOnly = true;
      document.getElementById('jNama').value = data.nama || '';
      document.getElementById('jSoal').value = data.nama_soal || '';
      document.getElementById('jDurasi').value = data.durasi || 60;
      document.getElementById('jMinSelesai').value = data.min_selesai || 0;
      document.getElementById('jMulai').value = toLocalISO(data.mulai);
      document.getElementById('jSelesai').value = toLocalISO(data.selesai);
      document.getElementById('jKelas').value = data.kelas || '';
      document.getElementById('jShuffleSoal').checked = data.shuffle_soal !== false;
      document.getElementById('jShuffleOpsi').checked = data.shuffle_opsi !== false;
      document.getElementById('jAktif').checked = data.aktif !== false;
      document.getElementById('jToken').value = data.token || Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
      document.getElementById('jadwal-modal-title').innerText = 'Buat Jadwal Baru';
      document.getElementById('jId').value = '';
      document.getElementById('jId').readOnly = false;
      document.getElementById('jNama').value = '';
      document.getElementById('jSoal').value = '';
      document.getElementById('jDurasi').value = '60';
      document.getElementById('jMinSelesai').value = '0';
      document.getElementById('jMulai').value = '';
      document.getElementById('jSelesai').value = '';
      document.getElementById('jKelas').value = '';
      document.getElementById('jShuffleSoal').checked = true;
      document.getElementById('jShuffleOpsi').checked = true;
      document.getElementById('jAktif').checked = true;
      document.getElementById('jToken').value = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  } catch (e) { 
    console.error(e);
    showCustomAlert('Gagal', 'Gagal memuat data: ' + e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }

  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closeJadwalModal = function () {
  const overlay = document.getElementById('jadwal-overlay');
  const modal = document.getElementById('jadwal-modal');
  if (!overlay || !modal) return;

  overlay.classList.remove('active');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }, 300);
};

window.saveJadwal = async function () {
  const id = document.getElementById('jId').value.trim();
  const nama = document.getElementById('jNama').value.trim();
  const soal = document.getElementById('jSoal').value;
  const durasi = document.getElementById('jDurasi').value;
  const minS = document.getElementById('jMinSelesai').value;
  const mulaiStr = document.getElementById('jMulai').value;
  const selesaiStr = document.getElementById('jSelesai').value;
  const kelas = document.getElementById('jKelas').value.trim();
  
  if (!id || !nama || !soal || !mulaiStr || !selesaiStr) {
    return showCustomAlert('Data Tidak Lengkap', 'Harap isi semua field utama.', '📝');
  }

  const mulaiMs = new Date(mulaiStr).getTime();
  const selesaiMs = new Date(selesaiStr).getTime();

  if (isNaN(mulaiMs) || isNaN(selesaiMs)) {
    return showCustomAlert('Format Salah', 'Format tanggal tidak valid.', '📅');
  }

  if (mulaiMs >= selesaiMs) {
    return showCustomAlert('Waktu Tidak Valid', 'Waktu mulai harus sebelum waktu selesai.', '⏰');
  }

  showLoading('Menyimpan Jadwal...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    
    // Cek apakah ini baru atau edit
    const existingSnap = await db.ref('/jadwal/' + id).once('value');
    const existingData = existingSnap.val();
    
    const payload = {
      nama: nama,
      nama_soal: soal,
      durasi: parseInt(durasi) || 60,
      min_selesai: parseInt(minS) || 0,
      mulai: mulaiMs,
      selesai: selesaiMs,
      kelas: kelas,
      shuffle_soal: document.getElementById('jShuffleSoal').checked,
      shuffle_opsi: document.getElementById('jShuffleOpsi').checked,
      aktif: document.getElementById('jAktif').checked,
      token: document.getElementById('jToken').value.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase(),
      force_aktif: existingData ? (existingData.force_aktif || false) : false
    };

    await db.ref('/jadwal/' + id).set(payload);
    showCustomAlert('Berhasil', 'Jadwal berhasil disimpan.', '✅');
    closeJadwalModal();
    loadAdminJadwal();
  } catch (e) {
    showCustomAlert('Gagal', 'Gagal menyimpan: ' + e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};

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

      const showBadge = getVal(sec, 'showSyncBadge', undefined);
      safeSetChecked('cfgShowSyncBadge', showBadge !== false && showBadge !== "false" && showBadge !== 0 && showBadge !== "0");

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
      showSyncBadge: document.getElementById('cfgShowSyncBadge') ? document.getElementById('cfgShowSyncBadge').checked : true,
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

window.resetSiswaLogin = async function (pesertaId, examId) {
  if (!confirm('Reset login siswa ini? Gunakan jika siswa mendapatkan pesan "Akun sedang digunakan".')) return;
  showLoading('Mereset Sesi...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    await db.ref(`/online_status/${examId}/${pesertaId}`).remove();
    showCustomAlert('Berhasil', 'Sesi siswa berhasil direset.', '✅');
    loadAdminDashboard();
  } catch (e) {
    showCustomAlert('Gagal', e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};

window.forceSelesaiSemua = async function (examId) {
  if (!confirm('Paksa SELESAI semua siswa yang sedang mengerjakan ujian ini?')) return;
  showLoading('Memproses...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    const snap = await db.ref(`/online_status/${examId}`).once('value');
    const onlines = snap.val() || {};
    const ids = Object.keys(onlines);
    if (ids.length === 0) {
      showCustomAlert('Info', 'Tidak ada siswa yang sedang mengerjakan.', 'ℹ️');
      return;
    }

    const updates = {};
    const now = new Date().toISOString();
    ids.forEach(id => {
      // Mengikuti struktur hasil Anda (mungkin butuh userId & examId)
      const resKey = db.ref('/hasil').push().key;
      updates[`/hasil/${resKey}`] = {
        userId: id,
        examId: examId,
        waktu: now,
        skor: 'F-SUBMIT', // Mark as forced submit
        nama: 'Siswa', // Fallback, script.js usually handles this
        ujian: 'Ujian'
      };
      updates[`/online_status/${examId}/${id}`] = null;
    });

    await db.ref().update(updates);
    showCustomAlert('Berhasil', `${ids.length} siswa berhasil diselesaikan.`, '✅');
    loadAdminDashboard();
  } catch (e) {
    showCustomAlert('Gagal', e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};

window.hapusSemuaHasil = async function () {
  const code = prompt('Ketik "HAPUS" untuk menghapus seluruh Data Hasil & Log Pelanggaran:');
  if (code !== 'HAPUS') return;

  showLoading('Membersihkan Database...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    await db.ref('/hasil').remove();
    await db.ref('/pelanggaran').remove();
    await db.ref('/online_status').remove();
    
    showCustomAlert('Berhasil', 'Database Hasil & Log berhasil dibersihkan.', '✅');
    loadAdminHasil(true);
  } catch (e) {
    showCustomAlert('Gagal', e.message, '❌');
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
    hideLoading();
  }
};

window.startItemAnalysis = function() {
  const container = document.getElementById('analisis-container');
  if (!container) return;
  
  const results = window.adminState.hasil || [];
  if (results.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--danger);">Tidak ada data hasil untuk dianalisis.</div>';
    return;
  }

  showLoading('Menganalisis Butir Soal...');
  
  // Map to store wrong counts: { questionId: { wrong: N, total: M } }
  const stats = {};

  results.forEach(res => {
    if (!res.detail) return;
    try {
      const detail = JSON.parse(res.detail);
      Object.keys(detail).forEach(qId => {
        if (!stats[qId]) stats[qId] = { wrong: 0, total: 0 };
        stats[qId].total++;
        if (detail[qId].correct === false) {
          stats[qId].wrong++;
        }
      });
    } catch(e) {}
  });

  const sortedIds = Object.keys(stats).sort((a, b) => {
    const pctA = stats[a].wrong / stats[a].total;
    const pctB = stats[b].wrong / stats[b].total;
    return pctB - pctA; // Sort by highest wrong percentage
  });

  if (sortedIds.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">Data detail jawaban tidak ditemukan. Pastikan siswa menggunakan versi aplikasi terbaru.</div>';
    hideLoading();
    return;
  }

  let html = '';
  sortedIds.forEach((id, idx) => {
    const s = stats[id];
    const pct = Math.round((s.wrong / s.total) * 100);
    const color = pct > 70 ? '#EF4444' : (pct > 40 ? '#F59E0B' : '#10B981');
    
    html += `
      <div class="admin-card" style="padding:15px; border-left: 4px solid ${color};">
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:5px;">ID SOAL: ${id}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-size:1.1rem; color:${color}">${pct}% Salah</span>
          <span style="font-size:0.8rem; background:var(--bg-subtle); padding:2px 8px; border-radius:10px;">${s.wrong}/${s.total} Siswa</span>
        </div>
        <div style="margin-top:10px; height:6px; background:#E5E7EB; border-radius:3px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:${color};"></div>
        </div>
        <div style="margin-top:8px; font-size:0.75rem; color:var(--text-muted);">
          ${pct > 70 ? '⚠️ Soal ini sangat sulit!' : (pct < 20 ? '✅ Soal ini sangat mudah.' : 'Ketajaman soal rata-rata.')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  hideLoading();
};

window.openPrintModal = function (examId, examName) {
  const overlay = document.getElementById('print-overlay');
  const modal = document.getElementById('print-modal');
  if (!overlay || !modal) return;

  document.getElementById('print-exam-id').value = examId;
  document.getElementById('print-exam-name-display').innerText = examName;

  overlay.classList.add('active');
  modal.style.display = 'flex';
  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closePrintModal = function () {
  const overlay = document.getElementById('print-overlay');
  const modal = document.getElementById('print-modal');
  if (!overlay || !modal) return;

  overlay.classList.remove('active');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  }, 300);
};

window.executePrint = async function () {
  const examId = document.getElementById('print-exam-id').value;
  const examName = document.getElementById('print-exam-name-display').innerText;
  const type = document.getElementById('print-type').value;

  showLoading('Menyiapkan Dokumen...');
  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    
    // Load Identity for Logo
    const idenSnap = await db.ref('/config/identity').once('value');
    const iden = idenSnap.val() || {};
    const schoolLogo = iden.logo || '';
    const schoolName = iden.name || 'CBT Online';

    // Load Peserta
    const pSnap = await db.ref('/peserta').once('value');
    const pData = pSnap.val() || {};
    
    // Filter by class if needed (jadwal has class info)
    const jSnap = await db.ref('/jadwal/' + examId).once('value');
    const jData = jSnap.val() || {};
    const targetKelas = jData.kelas || '';

    let students = [];
    for (let id in pData) {
      if (!targetKelas || targetKelas.toLowerCase() === 'semua' || pData[id].kelas.toLowerCase().includes(targetKelas.toLowerCase())) {
        students.push({ id, ...pData[id] });
      }
    }
    students.sort((a, b) => a.nama.localeCompare(b.nama));

    // Update Print UI
    document.getElementById('pd-school-name').innerText = schoolName.toUpperCase();
    document.getElementById('pd-exam-name').innerText = examName.toUpperCase();
    document.getElementById('pd-exam-date').innerText = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const logoImg = document.getElementById('pd-logo-img');
    if (schoolLogo) {
      logoImg.src = schoolLogo;
      logoImg.style.display = 'block';
    } else {
      logoImg.style.display = 'none';
    }

    const tbody = document.getElementById('print-siswa-tbody');
    tbody.innerHTML = students.map((s, i) => `
      <tr>
        <td style="text-align:center; padding:8px; border:1px solid black;">${i + 1}</td>
        <td style="padding:8px; border:1px solid black;">${s.id}</td>
        <td style="padding:8px; border:1px solid black;">${s.nama}</td>
        <td style="padding:8px; border:1px solid black; width:17%;">${i % 2 === 0 ? (i + 1) + '. .........' : ''}</td>
        <td style="padding:8px; border:1px solid black; width:17%;">${i % 2 !== 0 ? (i + 1) + '. .........' : ''}</td>
      </tr>
    `).join('');

    // Hide everything else for printing
    const printArea = document.getElementById('print-document-area');
    const originalDisplay = printArea.style.display;
    printArea.style.display = 'block';
    
    window.print();
    
    printArea.style.display = originalDisplay;
    closePrintModal();
  } catch (e) {
    console.error(e);
    showCustomAlert('Gagal', 'Gagal mencetak: ' + e.message, '❌');
  } finally {
    hideLoading();
  }
};

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
    if (window.dbConnectFast) await window.dbConnectFast();
    try {
      await db.ref('/soal/' + bankId).set(soalUpdates);
      await db.ref('/kunci/' + bankId).set(kunciUpdates);
      showCustomAlert('Import Berhasil', 'Berhasil mengimpor ' + count + ' soal ke bank ' + bankId + '.', '✅');
      closeImportModal();
      loadAdminSoal();
    } finally {
      if (window.dbDisconnect) window.dbDisconnect();
    }
  } else {
    showCustomAlert('Format Salah', 'Data kosong/salah format. Gunakan titik koma (;) sebagai pemisah.', '⚠️');
  }
}

// --- Analisis Logic ---
window.openAnalisisModal = async function (examId, examName) {
  const overlay = document.getElementById('analisis-overlay');
  const modal = document.getElementById('analisis-modal');
  const content = document.getElementById('analisis-content');
  if (!overlay || !modal || !content) return;

  overlay.classList.add('active');
  modal.style.display = 'flex';
  content.innerHTML = '<div style="text-align:center; padding:40px;">Menganalisis data...</div>';

  try {
    if (window.dbConnectFast) await window.dbConnectFast();
    
    // 1. Ambil data soal untuk teks pertanyaan
    const jSnap = await db.ref('/jadwal/' + examId).once('value');
    const sch = jSnap.val();
    if (!sch) throw new Error("Jadwal tidak ditemukan.");
    
    const [sSnap, hSnap] = await Promise.all([
      db.ref('/soal/' + sch.nama_soal).once('value'),
      db.ref('/hasil').orderByChild('examId').equalTo(examId).once('value')
    ]);
    
    const sData = sSnap.val() || {};
    const hData = hSnap.val() || {};
    const hList = Object.values(hData);
    
    if (hList.length === 0) {
      content.innerHTML = '<div style="text-align:center; padding:40px;">Belum ada hasil yang masuk untuk ujian ini.</div>';
      return;
    }

    // 2. Hitung statistik per soal
    const stats = {};
    hList.forEach(h => {
      let detail = {};
      try { detail = JSON.parse(h.detail || '{}'); } catch(e) {}
      
      Object.keys(detail).forEach(qId => {
        if (!stats[qId]) stats[qId] = { wrong: 0, total: 0 };
        stats[qId].total++;
        if (detail[qId].correct === false) stats[qId].wrong++;
      });
    });

    // 3. Urutkan berdasarkan % salah (paling sulit)
    const sorted = Object.keys(stats).map(qId => ({
      id: qId,
      wrong: stats[qId].wrong,
      total: stats[qId].total,
      pct: Math.round((stats[qId].wrong / stats[qId].total) * 100),
      text: sData[qId] ? sData[qId].pertanyaan : 'Soal telah dihapus'
    })).sort((a, b) => b.pct - a.pct);

    // 4. Render
    let html = `
      <div style="background:var(--primary-light); padding:10px; border-radius:8px; margin-bottom:15px; font-weight:600; font-size:0.85rem;">
        Total Peserta Teranalisis: ${hList.length} Siswa
      </div>
    `;
    
    sorted.forEach((s, i) => {
      const color = s.pct > 70 ? '#DC2626' : (s.pct > 40 ? '#D97706' : '#059669');
      html += `
        <div class="card" style="margin-bottom:10px; padding:12px; border-left: 4px solid ${color};">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="font-weight:700; color:${color};">#${i+1} - ${s.pct}% SALAH</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${s.wrong}/${s.total} Siswa</span>
          </div>
          <div style="font-size:0.85rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
            ${s.text}
          </div>
        </div>
      `;
    });
    
    content.innerHTML = html;

  } catch (e) {
    console.error(e);
    content.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">Error: ${e.message}</div>`;
  } finally {
    if (window.dbDisconnect) window.dbDisconnect();
  }

  setTimeout(() => {
    overlay.style.opacity = '1';
    modal.style.opacity = '1';
    modal.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
};

window.closeAnalisisModal = function () {
  const overlay = document.getElementById('analisis-overlay');
  const modal = document.getElementById('analisis-modal');
  if (!overlay || !modal) return;
  overlay.classList.remove('active');
  modal.style.opacity = '0';
  modal.style.transform = 'translate(-50%, -50%) scale(0.95)';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
};

