# 📚 CBT Online — Panduan Lengkap

> **Computer Based Test** berbasis Google Apps Script & Google Sheets.  
> Dirancang untuk ujian sekolah dengan kapasitas **1.000 Siswa serentak**, tanpa database eksternal, tanpa biaya hosting.

---

## 📋 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur Sistem](#-arsitektur-sistem)
3. [Persiapan Awal (Setup)](#-persiapan-awal-setup)
4. [Struktur Spreadsheet](#-struktur-spreadsheet)
5. [Panduan Admin & Proktor](#-panduan-admin--proktor)
6. [Panduan Siswa](#-panduan-siswa)
7. [Jenis-Jenis Soal](#-jenis-jenis-soal)
8. [Fitur Anti-Kecurangan](#-fitur-anti-kecurangan)
9. [Teknis & Skalabilitas](#-teknis--skalabilitas)
10. [Troubleshooting (FAQ)](#-troubleshooting-faq)

---

## 🚀 Fitur Utama

### Untuk Siswa
| Fitur | Keterangan |
|---|---|
| 🔑 Login ID | Masuk menggunakan Nomor Induk Siswa (NISN/ID unik) |
| 🔍 Autocomplete | Ketik nama, sistem langsung menyarankan dari database |
| ⏱️ Timer Dinamis | Hitung mundur berdasarkan durasi ujian dari jadwal |
| 📱 Progressive Web App | Bisa di-install di HP seperti aplikasi native |
| 💾 Auto-Save Lokal | Jawaban tersimpan otomatis di perangkat (tidak hilang jika sinyal putus) |
| 🔄 Resume Ujian | Jika tab tertutup/browser crash, sesi dapat dilanjutkan |
| 🖼️ Zoom Gambar | Klik gambar soal untuk memperbesar |
| 📊 Navigasi Grid | Panel nomor soal untuk loncat-loncat antar soal |
| ✅ Batas Waktu Minimum | Tombol Selesai dikunci selama X menit pertama (anti-asal selesai) |

### Untuk Proktor / Admin
| Fitur | Keterangan |
|---|---|
| 📡 Monitor Live | Lihat siapa yang Online, Mengerjakan, dan Selesai secara real-time |
| 📅 Kelola Jadwal | Ubah Token dan Status Aktif ujian langsung dari dashboard |
| 🏆 Rekap Nilai | Tabel nilai semua siswa yang sudah submit, bisa diekspor ke CSV |
| 🛡️ Radar Kecurangan | Tabel log siswa yang pindah tab / cabut fullscreen |
| 📢 Broadcast Pesan | Kirim peringatan massal ke semua HP siswa yang sedang ujian |
| 🔍 Pratinjau Soal | Cek seluruh bank soal + kunci jawaban dari dashboard |
| 📄 Ekspor CSV | Download laporan nilai/pelanggaran tanpa koneksi internet (lokal) |
| 🗂️ Paginasi | Tabel besar dipecah 20 baris/halaman, navigasi instan tanpa loading |

---

## 🏛️ Arsitektur Sistem

```
[Siswa / HP]  ←─────────────────────────────────────────────→  [Google Apps Script]
                                                                         │
    Browser/PWA                        HTTPS                     ┌───────┴────────┐
        │                                                         │  Code.gs       │
        │  Login → ID Lookup     ─────────────────────►          │  (Server API)  │
        │  Ambil Soal (Cache)    ─────────────────────►          │                │
        │  Ping Status (3 menit) ─────────────────────►          │   CacheService │
        │  Submit (Jitter+Retry) ─────────────────────►          │   LockService  │
        │                                                         └───────┬────────┘
[Proktor Dashboard]                                                       │
        │  Monitor / Radar       ─────────────────────►            Google Sheets
        │  Kelola Jadwal         ─────────────────────►          (Jadwal, Peserta,
        │  Pratinjau Soal        ─────────────────────►          Soal, Hasil, Pelanggaran)
```

---

## ⚙️ Persiapan Awal (Setup)

### Langkah 1 — Buat Spreadsheet Google
1. Buat file **Google Spreadsheet** baru.
2. Beri nama file, misalnya: `CBT SMPN 1 Contoh`.

### Langkah 2 — Buat Proyek Apps Script
1. Di Spreadsheet, buka menu **Ekstensi → Apps Script**.
2. Hapus kode default di `Code.gs`.
3. **Salin-tempel** seluruh isi file `Code.gs` dari proyek ini ke editor.
4. Klik ikon `+` di sebelah kiri, pilih **File HTML**, beri nama `index`.
5. Salin seluruh isi file `index.html` ke editor.
6. Ulangi langkah serupa untuk membuat file `script` (HTML) dan tempel isi `script.js`.
7. Ulangi untuk `style` (HTML) dan tempel isi `style.css`.

### Langkah 3 — Jalankan Setup Template
1. Di editor Apps Script, pilih fungsi `setupTemplate` dari dropdown.
2. Klik tombol **▶ Jalankan**.
3. Izinkan akses Google saat diminta (satu kali saja).
4. Buka Spreadsheet — akan muncul sheet-sheet baru secara otomatis!

### Langkah 4 — Atur Sandi Proktor
1. Di editor Apps Script, buka **Setelan Proyek → Script Properties**.
2. Tambahkan properti baru:
   - **Key:** `ADMIN_PASS`
   - **Value:** *(sandi rahasia Anda, contoh: `PRK2025`)*
3. Klik **Simpan**.

### Langkah 5 — Deploy (Publikasikan) Aplikasi
1. Klik tombol **Deploy → Deployment Baru**.
2. Pilih jenis: **Web App**.
3. Atur:
   - **Jalankan sebagai:** `Saya` (akun Google Anda)
   - **Siapa yang punya akses:** `Semua orang`
4. Klik **Deploy** dan salin **URL Web App** yang dihasilkan.
5. Bagikan URL tersebut ke siswa.

> **PENTING:** Setiap kali Anda mengubah `Code.gs`, Anda **WAJIB** melakukan Deploy ulang → **Versi Baru**. Mengubah file HTML tidak memerlukan redeploy.

---

## 📊 Struktur Spreadsheet

### Sheet: `Jadwal`
| Kolom | Nama | Keterangan |
|---|---|---|
| A | ID_Ujian | Kode unik, contoh: `U01` |
| B | Nama_Ujian | Nama tampilan ujian |
| C | Waktu_Mulai | Format: `yyyy-MM-dd HH:mm:ss` |
| D | Waktu_Selesai | Format: `yyyy-MM-dd HH:mm:ss` |
| E | Durasi_Menit | Durasi dalam menit, contoh: `90` |
| F | Status_Aktif | `Aktif` atau `Tidak` |
| G | Token | Kode token siswa, contoh: `ABCD` |
| H | Nama_Sheet_Soal | Nama sheet berisi soal, contoh: `Soal_Mat9` |
| I | Target_Kelas | Kelas yang boleh akses, contoh: `9A,9B` atau `Semua` |
| J | Min_Selesai_Menit | Menit minimal sebelum Submit bisa diklik, contoh: `40` |

### Sheet: `Peserta`
| Kolom | Nama | Keterangan |
|---|---|---|
| A | ID | NISN atau ID unik siswa |
| B | Nama | Nama lengkap |
| C | Kelas | Kelas siswa, contoh: `9A` |

### Sheet: `Soal_[NamaUjian]`
| Kolom | Nama | Keterangan |
|---|---|---|
| A | ID_Soal | Kode unik soal, contoh: `PG-1` |
| B | Jenis_Soal | `PG`, `KOMPLEKS`, `BS`, `ISIAN`, `JODOH` |
| C | Pertanyaan | Teks soal |
| D | Link_Gambar | URL gambar (opsional) |
| E-H | Opsi A–D | Pilihan jawaban (untuk PG/KOMPLEKS) |
| I | Jawaban_Benar | Kunci jawaban |
| J | Bobot | Poin soal, contoh: `2` |

### Sheet: `Hasil` & `Pelanggaran`
Diisi otomatis oleh sistem saat siswa submit dan saat pelanggaran terdeteksi.

---

## 🎛️ Panduan Admin & Proktor

### Cara Masuk Dashboard Proktor
1. Buka URL aplikasi.
2. **Ketuk logo/judul aplikasi sebanyak 5 kali** (trigger tersembunyi).
3. Masukkan sandi Proktor → klik **Verifikasi**.

### Tab Monitor (📡)
- Status siswa: **MENGERJAKAN** 🟢 / **SELESAI** ✅ / **BELUM** ⬜
- **Mode Absen**: Toggle untuk hanya tampilkan siswa yang belum hadir.
- **Kirim Pesan** 📢: Pesan muncul di HP siswa dalam ≤3 menit.

### Tab Jadwal (📅)
- Ubah **Token** dan **Status Aktif** langsung dari browser.
- **Pratinjau** 🔍: Lihat semua soal + kunci jawaban dalam modal popup.

### Tab Hasil & Radar (🏆)
- **Rekap Nilai**: Tabel semua hasil + tombol ekspor CSV.
- **Radar**: Log pelanggaran + tombol ekspor CSV.
- Navigasi halaman: 20 baris per halaman, pindah halaman tanpa loading.

---

## 👩‍🎓 Panduan Siswa

1. **Buka URL** aplikasi di browser HP/Laptop.
2. *(Opsional)* Klik **Install App** untuk memasang sebagai PWA di layar utama.
3. Ketikkan **ID/NISN** atau **Nama** → pilih dari saran → klik **Masuk**.
4. Pilih ujian yang tersedia → klik **Ikuti Ujian**.
5. Masukkan **Token** dari Proktor → klik **Mulai**.
6. Kerjakan soal:
   - Gunakan tombol **⬅ ►** untuk berpindah soal.
   - Klik ikon **Grid** untuk lompat ke nomor tertentu.
   - Klik **☆ Ragu** untuk menandai soal yang belum yakin.
7. Klik **Selesai & Kirim** di soal terakhir → konfirmasi → kirim.
8. Layar akan menampilkan **Nilai Akhir**.

> **Koneksi Putus?** Jangan panik! Jawaban Anda tersimpan otomatis di perangkat. Buka kembali URL dan pilih **Lanjutkan Sesi**.

---

## 📝 Jenis-Jenis Soal

### 1. Pilihan Ganda (`PG`)
- Isi Opsi A, B, C, D.
- **Kunci:** Teks jawaban yang benar (bukan huruf, tapi isi teksnya).
  - Contoh: Jika jawaban benar Opsi C = "Jakarta", isi kunci: `Jakarta`

### 2. Pilihan Ganda Kompleks (`KOMPLEKS`)
- Siswa memilih **lebih dari satu** jawaban benar.
- **Kunci:** Pisahkan dengan koma. Contoh: `Paus,Kelelawar`

### 3. Benar/Salah (`BS`)
- Tidak perlu isi Opsi (sistem otomatis sediakan Benar/Salah).
- **Kunci:** `Benar` atau `Salah`

### 4. Isian Singkat (`ISIAN`)
- **Kunci:** Teks jawaban persis. Contoh: `25` (tidak case-sensitive)

### 5. Menjodohkan (`JODOH`)
- **Opsi A:** Sisi kiri, pisah koma. Contoh: `Sumatera,Jawa,Sulawesi`
- **Opsi B:** Sisi kanan, pisah koma. Contoh: `Sumatera Utara,Jawa Barat,Sulawesi Selatan`
- **Kunci:** Format `Kiri=Kanan` dipisah titik koma.
  - Contoh: `Sumatera=Sumatera Utara;Jawa=Jawa Barat;Sulawesi=Sulawesi Selatan`

---

## 🛡️ Fitur Anti-Kecurangan

| Mekanisme | Cara Kerja |
|---|---|
| Acak Soal | Urutan soal berbeda per siswa (seed berdasarkan ID Siswa + ID Ujian) |
| Acak Opsi PG | Pilihan A/B/C/D diacak per siswa dengan seed yang sama |
| Deteksi Pindah Tab | Setiap keluar halaman tercatat & dikirim ke Radar Proktor |
| Token Ujian | Siswa hanya bisa masuk jika punya token rahasia dari Proktor |
| Batas Waktu Minimum | Tombol Submit dikunci selama X menit di awal ujian |
| Cek Duplikasi Submit | Server menolak jika ID yang sama submit dua kali untuk ujian yang sama |
| Radar Dashboard | Proktor melihat log pelanggaran real-time dengan nama siswa |

---

## ⚡ Teknis & Skalabilitas

### Multi-Cache Chunking (Soal)
Soal disimpan di Google Cache dalam potongan 90KB. Ketika 1.000 siswa masuk bersamaan, hanya 1 permintaan pertama yang membaca Spreadsheet; sisanya dilayani dari Cache.

### Jitter Submit (Anti Tsunami 1.000 Request)
Ketika waktu habis otomatis, setiap perangkat menunggu jeda acak **0–55 detik** agar pengiriman tersebar merata dan tidak menghantam server di detik yang sama.

### Auto-Retry Diam-Diam (3x)
Jika pengiriman gagal karena koneksi, sistem otomatis mencoba ulang 3 kali dengan jeda 5 detik — tanpa menampilkan error ke siswa.

### Limit Google Apps Script
| Parameter | Nilai |
|---|---|
| Eksekusi bersamaan (dengan Lock) | ~30/detik; dengan Jitter menjadi ~18/detik — aman |
| Batas waktu 1 eksekusi | 6 menit |
| Cache timeout soal | 600 detik |
| Lock waitLock | 28 detik |

---

## ❓ Troubleshooting (FAQ)

**Q: Siswa tidak bisa login — "ID tidak ditemukan"**
> Pastikan ID siswa di sheet Peserta tidak ada spasi tersembunyi. Coba salin-tempel ID dari sheet langsung.

**Q: Ujian tidak muncul di daftar**
> Periksa: (1) Status_Aktif = `Aktif`, (2) waktu sekarang ada di antara Mulai dan Selesai, (3) Target_Kelas cocok atau isi `Semua`.

**Q: Soal tidak tampil**
> Pastikan Nama_Sheet_Soal di kolom H Jadwal persis sama dengan nama sheet (huruf besar/kecil sensitif).

**Q: Perubahan Code.gs tidak berlaku**
> Lakukan **Deploy → Kelola Deployment → Edit → Versi Baru → Deploy**.

**Q: Dashboard Proktor tidak bisa dibuka**
> Pastikan `ADMIN_PASS` sudah diatur di Script Properties. Login kembali dengan password yang benar.

**Q: Submit gagal saat ujian ramai**
> Sistem Auto-Retry menanganinya otomatis dalam 5–15 detik. Jika masih gagal, minta siswa buka kembali URL dan klik kirim ulang.

---

*Dokumentasi CBT Online | April 2025 | Dibuat untuk kemajuan pendidikan Indonesia 🇮🇩*
