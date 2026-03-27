# coco-local-api

Sebuah API server sederhana berbasis Node.js dan Express untuk mengeksekusi perintah CLI `coco` secara lokal dan mengaksesnya melalui HTTP request. Server ini memungkinkan perangkat lain dalam jaringan yang sama untuk berinteraksi dengan `coco` CLI.

## Persyaratan

- Node.js (direkomendasikan v14+)
- npm atau yarn
- [coco CLI](https://bytedance.larkoffice.com/wiki/Er28whaTUiRgMekHLvDcISWmnXc) sudah terinstal dan berada di system PATH.
- Akun `coco` yang sudah terautentikasi (jalankan `coco login` di terminal sebelumnya).

## Instalasi

1. Pastikan Anda berada di direktori project:
   ```bash
   cd /Users/bytedance/git-repo/coco-local-api
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

## Menjalankan Server

### Mode Produksi
```bash
npm start
```
*Catatan: Secara default server akan berjalan di port `3000`.*

### Mode Development (menggunakan nodemon)
```bash
npm run dev
```

## Akses Jaringan

Server ini secara bawaan dikonfigurasi untuk mendengarkan dari semua interface jaringan (`0.0.0.0`). Ini berarti server bisa diakses:
- **Lokal:** `http://localhost:3000` atau `http://127.0.0.1:3000`
- **Jaringan (LAN/Wi-Fi):** `http://<IP-Lokal-Komputer-Anda>:3000`

*Pastikan firewall Anda mengizinkan koneksi masuk (inbound) pada port 3000 jika ingin mengaksesnya dari perangkat lain di jaringan yang sama.*

## Endpoint API

### 1. Health Check
Mengecek apakah server berjalan dengan baik.

- **URL:** `/health`
- **Method:** `GET`
- **Response Sukses:**
  ```json
  {
    "status": "OK",
    "timestamp": "2026-03-27T10:00:00.000Z"
  }
  ```

### 2. Process Text Prompt
Mengeksekusi perintah `coco -p "<prompt>"` dan mengembalikan hasilnya.

- **URL:** `/api/process`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "prompt": "Tuliskan kode halo dunia dalam Python"
  }
  ```
- **Response Sukses (200 OK):**
  ```json
  {
    "success": true,
    "command": "coco -p \"Tuliskan kode halo dunia dalam Python\"",
    "output": "print(\"Halo Dunia!\")\n",
    "stderr": ""
  }
  ```

### 3. Process Image with Prompt
Mengeksekusi perintah `coco` dengan menyertakan prompt dan sebuah file gambar. File gambar akan di-upload, diproses oleh `coco`, dan kemudian dihapus.

- **URL:** `/api/process-image`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`
- **Body (Form Data):**
  - `image`: (File gambar, max 10MB)
  - `prompt`: (Opsional) Teks instruksi untuk gambar, default: `"Deskripsikan gambar ini"`
- **Response Sukses (200 OK):**
  ```json
  {
    "success": true,
    "command": "coco -p \"Tolong jelaskan gambar ini /path/to/uploaded/image.jpg\"",
    "output": "Gambar tersebut menampilkan...",
    "stderr": ""
  }
  ```

- **Response Error Umum (400 / 500):**
  - **400 Bad Request:** Jika `prompt` tidak dikirim (untuk endpoint teks) atau `image` tidak disertakan (untuk endpoint gambar).
  - **500 Auth Required:** Jika `coco` belum login.
  - **500 Not Found:** Jika `coco` CLI tidak ditemukan di PATH.
  - **500 Timeout:** Jika eksekusi melebihi batas waktu (120 detik).

## Contoh Penggunaan (cURL)

### Eksekusi Prompt Teks
Dari terminal lokal Anda:
```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"prompt":"hello"}' http://localhost:3000/api/process
```

### Upload dan Analisis Gambar
Pastikan Anda memiliki file gambar (misalnya `test.jpg`):
```bash
curl -s -X POST -F "image=@/path/to/test.jpg" -F "prompt=Tolong analisa kode yang ada di screenshot ini" http://localhost:3000/api/process-image
```

## Keamanan

⚠️ **Peringatan Penting:** Aplikasi ini menjalankan perintah shell secara langsung (`child_process.exec`). Aplikasi ini harus digunakan secara hati-hati di lingkungan jaringan tertutup/lokal yang Anda percayai. Jangan pernah mengekspos aplikasi ini langsung ke internet publik tanpa menambahkan lapisan autentikasi dan otorisasi (misalnya API Key atau JWT).
