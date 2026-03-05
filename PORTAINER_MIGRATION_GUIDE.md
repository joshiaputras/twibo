# Panduan Deploy Twibo.id ke VPS dengan Portainer

## Daftar Isi
1. [Prasyarat](#1-prasyarat)
2. [Install Docker & Portainer](#2-install-docker--portainer)
3. [Siapkan File Konfigurasi](#3-siapkan-file-konfigurasi)
4. [Clone & Deploy via Portainer](#4-clone--deploy-via-portainer)
5. [Setup SSL dengan Caddy](#5-setup-ssl-dengan-caddy)
6. [Verifikasi](#6-verifikasi)
7. [Update & Maintenance](#7-update--maintenance-setelah-deploy)
8. [CI/CD Otomatis](#8-cicd-otomatis-dengan-github-actions)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prasyarat

| Kebutuhan | Minimum |
|-----------|---------|
| OS | Ubuntu 22.04+ / Debian 12+ |
| RAM | 2 GB |
| Disk | 20 GB |
| Domain | Sudah diarahkan ke IP VPS (A record) |
| SSH | Akses root/sudo |

Pastikan domain sudah diarahkan:
```
A    @      → IP_VPS_ANDA
A    www    → IP_VPS_ANDA
```

---

## 2. Install Docker & Portainer

### Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Logout & login kembali agar group docker aktif
exit
# SSH kembali ke VPS
```

### Install Portainer CE
```bash
# Buat volume untuk data Portainer
docker volume create portainer_data

# Jalankan Portainer
docker run -d \
  -p 8000:8000 \
  -p 9443:9443 \
  --name portainer \
  --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Akses Portainer di: `https://IP_VPS_ANDA:9443`
- Buat username & password admin
- Pilih **Local** environment

---

## 3. Siapkan File Konfigurasi

Buat folder project:
```bash
mkdir -p /opt/twibo
cd /opt/twibo
```

### 3.1 Dockerfile

Buat file `/opt/twibo/Dockerfile`:
```dockerfile
# ============ Stage 1: Build ============
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files & install dependencies
COPY package*.json ./
RUN npm ci

# Copy semua source code
COPY . .

# Build arguments (diisi saat build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

# Build production
RUN npm run build

# ============ Stage 2: Serve ============
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.2 Nginx Config (dengan OG Bot Proxy)

Buat file `/opt/twibo/nginx.conf`:
```nginx
# Deteksi social media bots untuk OG preview
map $http_user_agent $is_social_bot {
    default 0;
    ~*(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Applebot|Pinterest|vkShare|redditbot|Embedly|SkypeUriPreview) 1;
}

server {
    listen 80;
    server_name twibo.id www.twibo.id;

    root /usr/share/nginx/html;
    index index.html;

    # ---- Gzip Compression ----
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # ---- Cache Static Assets ----
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # ---- OG Proxy: Campaign Pages ----
    # Bot WhatsApp/Facebook akan di-redirect ke edge function untuk mendapat OG tags
    # User biasa tetap dapat SPA React
    location ~ ^/c/(.+)$ {
        if ($is_social_bot) {
            return 302 https://wonvlwajwhjunccyopvq.supabase.co/functions/v1/og-share?type=campaign&slug=$1&app_url=https://twibo.id;
        }
        try_files $uri $uri/ /index.html;
    }

    # ---- OG Proxy: Blog Pages ----
    location ~ ^/blog/(.+)$ {
        if ($is_social_bot) {
            return 302 https://wonvlwajwhjunccyopvq.supabase.co/functions/v1/og-share?type=blog&slug=$1&app_url=https://twibo.id;
        }
        try_files $uri $uri/ /index.html;
    }

    # ---- SPA Fallback ----
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ---- Security Headers ----
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

**Cara kerja OG Proxy:**
1. User biasa buka `https://twibo.id/c/campaign-slug` → dapat React SPA seperti biasa
2. Bot WhatsApp/Facebook buka URL yang sama → Nginx redirect ke edge function `og-share` → bot mendapat HTML statis dengan OG tags (judul, deskripsi, gambar)
3. Link yang di-share tetap bersih: `https://twibo.id/c/campaign-slug`

### 3.3 Docker Compose

Buat file `/opt/twibo/docker-compose.yml`:
```yaml
version: "3.8"

services:
  twibo-web:
    build:
      context: .
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY}
        VITE_SUPABASE_PROJECT_ID: ${VITE_SUPABASE_PROJECT_ID}
    container_name: twibo-web
    restart: always
    ports:
      - "8080:80"
    networks:
      - web

  # Caddy sebagai reverse proxy + SSL otomatis
  caddy:
    image: caddy:2-alpine
    container_name: twibo-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - twibo-web
    networks:
      - web

volumes:
  caddy_data:
  caddy_config:

networks:
  web:
    driver: bridge
```

### 3.4 Caddyfile (SSL Otomatis)

Buat file `/opt/twibo/Caddyfile`:
```
twibo.id, www.twibo.id {
    reverse_proxy twibo-web:80
}
```

> Caddy otomatis mengurus sertifikat SSL via Let's Encrypt. Tidak perlu setup manual!

### 3.5 Environment Variables

Buat file `/opt/twibo/.env`:
```env
VITE_SUPABASE_URL=https://wonvlwajwhjunccyopvq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvbnZsd2Fqd2hqdW5jY3lvcHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzQ1OTIsImV4cCI6MjA4ODE1MDU5Mn0.Q5rf12Njw3DiyTzIrLI5FQ_qCzcavYHbcRohBMTJYgw
VITE_SUPABASE_PROJECT_ID=wonvlwajwhjunccyopvq
```

---

## 4. Clone & Deploy via Portainer

### Langkah 1: Clone Repository

```bash
cd /opt/twibo

# Clone dari GitHub (Lovable otomatis push ke GitHub)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git temp-clone

# Pindahkan semua file ke /opt/twibo
mv temp-clone/* temp-clone/.* . 2>/dev/null
rm -rf temp-clone

# Pastikan file konfigurasi (Dockerfile, nginx.conf, dll) sudah ada
ls -la Dockerfile nginx.conf docker-compose.yml Caddyfile .env
```

### Langkah 2: Deploy via Portainer UI

#### Opsi A: Stack dari File System
1. Buka **Portainer** → `https://IP_VPS_ANDA:9443`
2. Pilih **Local** → **Stacks** → **+ Add Stack**
3. Nama stack: `twibo`
4. Pilih **Upload** → upload file `docker-compose.yml`
5. Scroll ke **Environment variables** → klik **Advanced mode** → paste isi `.env`
6. Klik **Deploy the stack**

#### Opsi B: Stack dari Git Repository (Recommended! 🌟)
1. **Stacks** → **+ Add Stack**
2. Pilih tab **Repository**
3. Isi:
   - **Repository URL**: `https://github.com/YOUR_USERNAME/YOUR_REPO`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.yml`
4. ✅ Centang **Automatic updates** → Polling interval: `5m`
   > Ini membuat Portainer otomatis cek perubahan di GitHub setiap 5 menit!
5. Tambahkan **Environment variables**:
   | Name | Value |
   |------|-------|
   | VITE_SUPABASE_URL | https://wonvlwajwhjunccyopvq.supabase.co |
   | VITE_SUPABASE_PUBLISHABLE_KEY | *(anon key)* |
   | VITE_SUPABASE_PROJECT_ID | wonvlwajwhjunccyopvq |
6. Klik **Deploy the stack**

> **Catatan Opsi B**: Agar opsi ini bekerja, file `Dockerfile`, `nginx.conf`, `docker-compose.yml`, dan `Caddyfile` harus sudah ada di repository GitHub. Commit file-file ini ke repo Anda.

---

## 5. Setup SSL dengan Caddy

SSL sudah otomatis ditangani Caddy! Pastikan:
1. Domain `twibo.id` dan `www.twibo.id` sudah mengarah ke IP VPS
2. Port 80 dan 443 terbuka di firewall:
```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 9443  # Portainer
sudo ufw enable
```

Caddy akan otomatis:
- Request sertifikat SSL dari Let's Encrypt
- Auto-renew sebelum expired
- Redirect HTTP → HTTPS

---

## 6. Verifikasi

```bash
# Cek container berjalan
docker ps

# Output yang diharapkan:
# NAMES          STATUS          PORTS
# twibo-web      Up X minutes    0.0.0.0:8080->80/tcp
# twibo-caddy    Up X minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# portainer      Up X hours      0.0.0.0:9443->9443/tcp

# Cek logs jika ada masalah
docker logs twibo-web
docker logs twibo-caddy

# Test akses
curl -I https://twibo.id

# Test OG preview (simulasi bot WhatsApp)
curl -A "WhatsApp" -L "https://twibo.id/c/test-campaign"
# Harus menampilkan HTML dengan og:title, og:image, og:description
```

---

## 7. Update & Maintenance Setelah Deploy

### Skenario 1: Edit Fitur/UI di Lovable → Update di VPS

Setiap kali Anda melakukan perubahan di Lovable (tambah fitur, edit UI, fix bug):

1. **Lovable otomatis push ke GitHub** — tidak perlu action apapun
2. **Di VPS**, jalankan:
```bash
cd /opt/twibo
git pull origin main
docker compose build --no-cache
docker compose up -d
```

Atau jika menggunakan **Portainer Git Repository (Opsi B)**:
- Portainer otomatis mendeteksi perubahan dan redeploy! ✅
- Anda bisa juga manual: **Portainer → Stacks → twibo → Pull and redeploy**

### Skenario 2: Perubahan Database (Migration)

Jika Lovable menambah/mengubah tabel database:
1. File SQL baru akan muncul di `supabase/migrations/`
2. **Anda TIDAK perlu menjalankan migration di VPS** karena database tetap di Lovable Cloud
3. Migration otomatis dijalankan oleh Lovable Cloud

> **Penting**: Backend (database, auth, edge functions) tetap berjalan di Lovable Cloud. VPS hanya meng-host frontend (React app).

### Skenario 3: Perubahan Edge Functions

Edge functions juga tetap di Lovable Cloud dan auto-deploy saat Anda edit di Lovable. Tidak perlu action di VPS.

### Skenario 4: Update Manual via Portainer UI

1. Buka **Portainer** → `https://IP_VPS_ANDA:9443`
2. Klik **Stacks** → `twibo`
3. Klik **Pull and redeploy** (icon refresh)
4. Centang **Re-pull image and redeploy** 
5. Klik **Update**

### Skenario 5: Rollback ke Versi Sebelumnya

Jika update bermasalah:
```bash
cd /opt/twibo

# Lihat history commit
git log --oneline -10

# Rollback ke commit tertentu
git checkout COMMIT_HASH

# Rebuild
docker compose build --no-cache
docker compose up -d

# Untuk kembali ke terbaru
git checkout main
git pull origin main
docker compose build --no-cache
docker compose up -d
```

### Skenario 6: Update Konfigurasi (Env/Nginx)

Jika perlu ubah environment variables atau nginx config:
```bash
cd /opt/twibo

# Edit file yang diperlukan
nano .env          # Ubah env variables
nano nginx.conf    # Ubah nginx config
nano Caddyfile     # Ubah domain/SSL config

# Rebuild & restart
docker compose build --no-cache
docker compose up -d
```

Atau via **Portainer**:
1. **Stacks** → `twibo` → **Editor**
2. Edit `docker-compose.yml` atau environment variables
3. Klik **Update the stack**

### Maintenance Rutin

```bash
# Hapus image lama yang tidak terpakai (hemat disk)
docker image prune -a -f

# Cek disk usage
docker system df

# Lihat resource usage container
docker stats

# Backup konfigurasi
tar -czf /root/twibo-config-backup.tar.gz /opt/twibo/{Dockerfile,nginx.conf,docker-compose.yml,Caddyfile,.env}
```

---

## 8. CI/CD Otomatis dengan GitHub Actions

Jika tidak menggunakan Portainer auto-deploy, buat CI/CD pipeline:

### File `.github/workflows/deploy.yml`:
```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/twibo
            git pull origin main
            docker compose build --no-cache
            docker compose up -d
            docker image prune -f
```

### Setup GitHub Secrets:
Di GitHub repo → **Settings** → **Secrets and variables** → **Actions**:
| Secret | Nilai |
|--------|-------|
| `VPS_HOST` | IP VPS Anda |
| `VPS_USER` | `root` (atau user SSH lain) |
| `VPS_SSH_KEY` | Private key SSH (isi dari `~/.ssh/id_rsa`) |

### Generate SSH Key (jika belum punya):
```bash
# Di VPS
ssh-keygen -t ed25519 -C "github-actions"

# Tambahkan public key ke authorized_keys
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# Copy private key — paste ke GitHub Secret VPS_SSH_KEY
cat ~/.ssh/id_ed25519
```

---

## 9. Troubleshooting

### Container tidak start
```bash
docker logs twibo-web
docker logs twibo-caddy
```

### SSL tidak bekerja
- Pastikan port 80 & 443 terbuka
- Pastikan domain sudah mengarah ke IP VPS
- Cek logs Caddy: `docker logs twibo-caddy`

### OG Preview tidak muncul di WhatsApp
- Test manual: `curl -A "WhatsApp" -L "https://twibo.id/c/SLUG"`
- Pastikan nginx.conf sudah ter-copy ke container (rebuild jika perlu)
- Cek edge function og-share berjalan di Lovable Cloud

### Build gagal
```bash
# Cek error saat build
docker compose build --no-cache 2>&1 | tail -50

# Pastikan package.json valid
cd /opt/twibo && cat package.json | python3 -m json.tool
```

### Disk penuh
```bash
# Hapus semua yang tidak terpakai
docker system prune -a -f
```

---

## Arsitektur Keseluruhan

```
┌─────────────────────────────────────────────────────────┐
│                     DEVELOPMENT                         │
│                                                         │
│  Lovable (edit UI/logic/fitur)                          │
│       ↓ auto push                                       │
│  GitHub Repository                                      │
│       ↓ auto pull (Portainer) atau GitHub Actions        │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                      VPS                                │
│                                                         │
│  Portainer (manajemen container)                        │
│       │                                                 │
│  Docker Compose                                         │
│    ├── Caddy (reverse proxy + SSL otomatis)              │
│    │     ↓ proxy                                        │
│    └── Nginx (SPA + OG Bot Proxy)                       │
│          ├── User biasa → React SPA                     │
│          └── Bot sosmed → Edge Function og-share        │
└─────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 LOVABLE CLOUD (Backend)                  │
│                                                         │
│  ├── Database (PostgreSQL)                              │
│  ├── Authentication                                     │
│  ├── Edge Functions (og-share, create-payment, dll)     │
│  └── Storage (avatars, banner-images)                   │
└─────────────────────────────────────────────────────────┘
```

### Ringkasan Workflow Update:

```
1. Edit di Lovable
       ↓
2. Otomatis push ke GitHub
       ↓
3a. Portainer auto-pull (jika pakai Git Repository + Automatic updates)
   ATAU
3b. GitHub Actions SSH ke VPS → git pull → docker build → deploy
   ATAU
3c. Manual: SSH ke VPS → git pull → docker compose build → up
       ↓
4. Website terupdate! 🎉
```

---

## Catatan Penting

1. **Backend tetap di Lovable Cloud** — VPS hanya host frontend. Tidak perlu install Supabase di VPS.
2. **Edge functions auto-deploy** — Saat Anda edit edge function di Lovable, otomatis deploy ke Cloud.
3. **Database migration otomatis** — Perubahan schema ditangani Lovable Cloud.
4. **Portainer gratis** — Portainer CE (Community Edition) gratis untuk single node.
5. **Caddy vs Nginx** — Caddy digunakan untuk SSL otomatis, Nginx untuk SPA routing & OG proxy. Keduanya berjalan bersamaan di Docker.
6. **Jangan expose port 8080** di firewall — hanya Caddy yang perlu port 80/443. Port 8080 hanya internal antar container.
