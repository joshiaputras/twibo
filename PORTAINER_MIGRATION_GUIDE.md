# Panduan Deploy Twibo.id ke VPS dengan Portainer (Fully Self-Hosted)

> **Semua berjalan mandiri di VPS Anda** — Database, Auth, Edge Functions, Storage, Frontend. Tidak ada ketergantungan ke cloud server luar.

## Daftar Isi
1. [Prasyarat](#1-prasyarat)
2. [Install Docker & Portainer](#2-install-docker--portainer)
3. [Setup Supabase Self-Hosted](#3-setup-supabase-self-hosted)
4. [Siapkan File Konfigurasi Frontend](#4-siapkan-file-konfigurasi-frontend)
5. [Deploy Edge Functions Lokal](#5-deploy-edge-functions-lokal)
6. [Setup Nginx Reverse Proxy + SSL](#6-setup-nginx-reverse-proxy--ssl)
7. [Import Data & Storage](#7-import-data--storage)
8. [Verifikasi](#8-verifikasi)
9. [Update & Maintenance](#9-update--maintenance-setelah-deploy)
10. [CI/CD Otomatis](#10-cicd-otomatis-dengan-github-actions)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prasyarat

| Kebutuhan | Minimum |
|-----------|---------|
| OS | Ubuntu 22.04+ / Debian 12+ |
| RAM | **4 GB** (Supabase self-hosted butuh lebih banyak RAM) |
| Disk | 40 GB |
| Domain | Sudah diarahkan ke IP VPS (A record) |
| SSH | Akses root/sudo |

Pastikan domain sudah diarahkan:
```
A    @      → IP_VPS_ANDA
A    www    → IP_VPS_ANDA
A    api    → IP_VPS_ANDA   (opsional, untuk Supabase API)
```

---

## 2. Install Docker & Portainer

### Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Logout & login kembali
exit
# SSH kembali ke VPS
```

### Install Docker Compose (jika belum ada)
```bash
sudo apt install docker-compose-plugin
# Verifikasi:
docker compose version
```

### Install Portainer CE
```bash
docker volume create portainer_data

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

## 3. Setup Supabase Self-Hosted

Ini adalah **backend mandiri** Anda — database PostgreSQL, authentication, REST API, storage, dan Realtime.

### 3.1 Clone Supabase Docker
```bash
mkdir -p /opt/supabase
cd /opt/supabase

git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

### 3.2 Generate Secrets
```bash
# Generate JWT Secret (simpan, jangan sampai hilang!)
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET: $JWT_SECRET"

# Generate Anon Key & Service Role Key menggunakan JWT secret
# Gunakan tool online: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

# Generate POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(openssl rand -base64 24)
echo "POSTGRES_PASSWORD: $POSTGRES_PASSWORD"
```

### 3.3 Edit Environment Variables
```bash
nano .env
```

Ubah variabel berikut:
```env
# ====== WAJIB DIUBAH ======

# URL Supabase (ganti dengan domain Anda)
SITE_URL=https://twibo.id
API_EXTERNAL_URL=https://api.twibo.id
# Atau jika tidak punya subdomain api:
# API_EXTERNAL_URL=https://twibo.id/supabase

# Database
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_AMAN

# JWT (generate di langkah 3.2)
JWT_SECRET=GANTI_DENGAN_JWT_SECRET
ANON_KEY=GANTI_DENGAN_GENERATED_ANON_KEY
SERVICE_ROLE_KEY=GANTI_DENGAN_GENERATED_SERVICE_ROLE_KEY

# Dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=GANTI_PASSWORD_DASHBOARD

# SMTP (untuk email verifikasi & reset password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SENDER_NAME=TWIBO.id
SMTP_ADMIN_EMAIL=your-email@gmail.com

# ====== PORT MAPPING (sesuaikan) ======
# Kong API Gateway → port 8001 (bukan default 8000 karena Portainer pakai 8000)
KONG_HTTP_PORT=8001
# PostgreSQL → port 5433 (bukan default 5432 untuk menghindari konflik)
POSTGRES_PORT=5433

# ====== BIARKAN DEFAULT ======
POSTGRES_HOST=db
POSTGRES_DB=postgres
```

> **⚠️ Penting**: Port Kong diubah ke **8001** karena Portainer sudah memakai port 8000. Port PostgreSQL diubah ke **5433** untuk menghindari konflik dengan PostgreSQL sistem jika ada.

### 3.4 Update Port di Docker Compose Supabase

Edit file `docker-compose.yml` di `/opt/supabase/supabase/docker/`:

```bash
nano docker-compose.yml
```

Cari bagian service `kong` dan ubah port mapping:
```yaml
  kong:
    # ...
    ports:
      - ${KONG_HTTP_PORT:-8001}:8000   # Expose Kong di port 8001
      - ${KONG_HTTPS_PORT:-8443}:8443
```

Cari bagian service `db` dan ubah port mapping:
```yaml
  db:
    # ...
    ports:
      - ${POSTGRES_PORT:-5433}:5432    # Expose PostgreSQL di port 5433
```

### 3.5 Jalankan Supabase
```bash
docker compose up -d
```

Tunggu ~2-3 menit, lalu verifikasi:
```bash
# Cek semua container berjalan
docker compose ps

# Harus ada: supabase-db, supabase-auth, supabase-rest, supabase-storage, 
# supabase-realtime, supabase-studio, supabase-kong, dll

# Test Kong di port 8001
curl http://localhost:8001/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Test PostgreSQL di port 5433
docker exec supabase-db psql -U postgres -c "SELECT 1;"
```

Akses Supabase Studio: `http://IP_VPS_ANDA:3000` (default Studio port)

### 3.6 Import Database Schema

Jalankan semua migration SQL dari project. Buka **Supabase Studio** → **SQL Editor**, lalu jalankan SQL berikut secara berurutan:

```sql
-- 1. Buat enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Buat tabel profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT '',
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    avatar_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Buat tabel user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Buat tabel campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    slug text NOT NULL UNIQUE,
    name text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    caption text NOT NULL DEFAULT '',
    type text NOT NULL DEFAULT 'twibbon',
    size text NOT NULL DEFAULT '1080x1080',
    status text NOT NULL DEFAULT 'draft',
    tier text NOT NULL DEFAULT 'free',
    is_featured boolean NOT NULL DEFAULT false,
    is_private boolean NOT NULL DEFAULT false,
    design_json jsonb NOT NULL DEFAULT '{}',
    banner_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- 5. Buat tabel payments
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    amount integer NOT NULL DEFAULT 0,
    discount_amount integer NOT NULL DEFAULT 0,
    voucher_code text,
    midtrans_order_id text,
    midtrans_transaction_id text,
    payment_method text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 6. Buat tabel site_settings
CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value text NOT NULL DEFAULT '',
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 7. Buat tabel campaign_stats
CREATE TABLE IF NOT EXISTS public.campaign_stats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL UNIQUE,
    supporters_count integer NOT NULL DEFAULT 0,
    downloads_count integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;

-- 8. Buat tabel campaign_stats_daily
CREATE TABLE IF NOT EXISTS public.campaign_stats_daily (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    date date NOT NULL DEFAULT CURRENT_DATE,
    supporters_count integer NOT NULL DEFAULT 0,
    downloads_count integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(campaign_id, date)
);
ALTER TABLE public.campaign_stats_daily ENABLE ROW LEVEL SECURITY;

-- 9. Buat tabel blog_posts
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL,
    slug text NOT NULL UNIQUE,
    title text NOT NULL DEFAULT '',
    excerpt text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    meta_title text NOT NULL DEFAULT '',
    meta_description text NOT NULL DEFAULT '',
    cover_image_url text,
    tags text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'draft',
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 10. Buat tabel vouchers
CREATE TABLE IF NOT EXISTS public.vouchers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    discount_type text NOT NULL DEFAULT 'percentage',
    discount_value integer NOT NULL DEFAULT 0,
    max_uses integer,
    max_uses_per_user integer,
    used_count integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz,
    valid_until timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
```

Lalu jalankan **Database Functions**:

```sql
-- Function: handle_new_user (auto-create profile + role saat signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Trigger: auto create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function: increment_campaign_stats
CREATE OR REPLACE FUNCTION public.increment_campaign_stats(_slug text, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _campaign_id uuid;
BEGIN
  SELECT c.id INTO _campaign_id FROM public.campaigns c
  WHERE c.slug = _slug AND c.status = 'published' LIMIT 1;
  IF _campaign_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.campaign_stats (campaign_id, supporters_count, downloads_count)
  VALUES (
    _campaign_id,
    CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'download' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    supporters_count = campaign_stats.supporters_count + CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    downloads_count = campaign_stats.downloads_count + CASE WHEN _event = 'download' THEN 1 ELSE 0 END,
    updated_at = now();

  INSERT INTO public.campaign_stats_daily (campaign_id, date, supporters_count, downloads_count)
  VALUES (
    _campaign_id, CURRENT_DATE,
    CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    CASE WHEN _event = 'download' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id, date)
  DO UPDATE SET
    supporters_count = campaign_stats_daily.supporters_count + CASE WHEN _event = 'supporter' THEN 1 ELSE 0 END,
    downloads_count = campaign_stats_daily.downloads_count + CASE WHEN _event = 'download' THEN 1 ELSE 0 END;
END;
$$;
```

> **Catatan**: Untuk RLS policies, jalankan juga migration SQL dari folder `supabase/migrations/` secara berurutan di SQL Editor.

### 3.7 Setup Storage Buckets

Di Supabase Studio → **Storage** → buat bucket:
1. `avatars` — Public: ✅ Yes
2. `banner-images` — Public: ✅ Yes

---

## 4. Siapkan File Konfigurasi Frontend

### 4.1 Clone Repository
```bash
mkdir -p /opt/twibo
cd /opt/twibo

git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .
```

### 4.2 Dockerfile

Buat file `/opt/twibo/Dockerfile`:
```dockerfile
# ============ Stage 1: Build ============
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build arguments — mengarah ke Supabase LOKAL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

RUN npm run build

# ============ Stage 2: Serve ============
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.3 Nginx Config Internal (SPA Routing + OG Bot Proxy)

Ini adalah nginx **di dalam container** twibo-web. Tugasnya: SPA routing + OG bot proxy ke edge function lokal.

Buat file `/opt/twibo/nginx.conf`:
```nginx
# Deteksi social media bots untuk OG preview
map $http_user_agent $is_social_bot {
    default 0;
    ~*(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Applebot|Pinterest|vkShare|redditbot|Embedly|SkypeUriPreview) 1;
}

server {
    listen 80;
    server_name _;

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

    # ---- OG Proxy: Campaign Pages (ke edge function LOKAL) ----
    location ~ ^/c/(.+)$ {
        if ($is_social_bot) {
            # Mengarah ke edge function lokal (bukan cloud!)
            return 302 http://twibo-functions:8000/og-share?type=campaign&slug=$1&app_url=https://twibo.id;
        }
        try_files $uri $uri/ /index.html;
    }

    # ---- OG Proxy: Blog Pages ----
    location ~ ^/blog/(.+)$ {
        if ($is_social_bot) {
            return 302 http://twibo-functions:8000/og-share?type=blog&slug=$1&app_url=https://twibo.id;
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

### 4.4 Edge Functions Server (Deno)

Buat file `/opt/twibo/edge-functions-server.ts` — ini adalah server Deno yang menjalankan semua edge functions secara lokal:

```typescript
// edge-functions-server.ts
// Server lokal yang meniru behavior Supabase Edge Functions
// Jalankan dengan: deno run --allow-net --allow-env --allow-read edge-functions-server.ts

const PORT = 8000;

// Import handler dari setiap function
// Kita gunakan dynamic import berdasarkan path

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  
  // Route ke function yang sesuai
  try {
    switch (path) {
      case 'og-share': {
        const mod = await import('./supabase/functions/og-share/index.ts');
        return mod.default ? mod.default(req) : new Response('Not found', { status: 404 });
      }
      case 'create-payment': {
        const mod = await import('./supabase/functions/create-payment/index.ts');
        return mod.default ? mod.default(req) : new Response('Not found', { status: 404 });
      }
      case 'midtrans-webhook': {
        const mod = await import('./supabase/functions/midtrans-webhook/index.ts');
        return mod.default ? mod.default(req) : new Response('Not found', { status: 404 });
      }
      case 'send-invoice-email': {
        const mod = await import('./supabase/functions/send-invoice-email/index.ts');
        return mod.default ? mod.default(req) : new Response('Not found', { status: 404 });
      }
      case 'test-smtp-email': {
        const mod = await import('./supabase/functions/test-smtp-email/index.ts');
        return mod.default ? mod.default(req) : new Response('Not found', { status: 404 });
      }
      default:
        return new Response(JSON.stringify({ error: 'Function not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error(`Error in function ${path}:`, err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve({ port: PORT }, handler);
console.log(`Edge functions server running on port ${PORT}`);
```

> **Catatan**: Karena edge functions menggunakan `Deno.serve()` secara internal, pendekatan yang lebih mudah adalah menggunakan **Supabase CLI** untuk menjalankan functions secara lokal (lihat bagian 5).

### 4.5 Docker Compose (Full Stack)

Buat file `/opt/twibo/docker-compose.yml`:
```yaml
version: "3.8"

services:
  # ========== Frontend ==========
  twibo-web:
    build:
      context: .
      args:
        # Mengarah ke Supabase LOKAL via Kong gateway (port 8001)
        VITE_SUPABASE_URL: ${SUPABASE_PUBLIC_URL}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${SUPABASE_ANON_KEY}
        VITE_SUPABASE_PROJECT_ID: local
    container_name: twibo-web
    restart: always
    ports:
      - "8080:80"
    networks:
      - web
    depends_on:
      - twibo-functions

  # ========== Edge Functions (Deno) ==========
  twibo-functions:
    image: denoland/deno:latest
    container_name: twibo-functions
    restart: always
    working_dir: /app
    command: >
      deno run --allow-net --allow-env --allow-read 
      edge-functions-server.ts
    volumes:
      - ./edge-functions-server.ts:/app/edge-functions-server.ts:ro
      - ./supabase/functions:/app/supabase/functions:ro
    environment:
      - SUPABASE_URL=${SUPABASE_INTERNAL_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - APP_URL=https://twibo.id
    networks:
      - web
      - supabase

networks:
  web:
    driver: bridge
  supabase:
    external: true
    name: supabase_default  # Network dari docker compose Supabase
```

> **Penting**: Network `supabase_default` menghubungkan container frontend & edge functions ke database, auth, storage Supabase yang berjalan lokal.
>
> **Port Kong = 8001**, jadi `SUPABASE_PUBLIC_URL` harus mengarah ke domain:8001 atau melalui Nginx reverse proxy.

### 4.6 Environment Variables

Buat file `/opt/twibo/.env`:
```env
# ====== Supabase Self-Hosted ======
# URL publik Supabase (yang diakses browser user, via Nginx reverse proxy)
SUPABASE_PUBLIC_URL=https://api.twibo.id
# Atau jika path-based: https://twibo.id/supabase

# URL internal (antar container Docker — Kong listen internal di port 8000)
SUPABASE_INTERNAL_URL=http://supabase-kong:8000

# Keys (dari langkah 3.2)
SUPABASE_ANON_KEY=GANTI_DENGAN_ANON_KEY_ANDA
SUPABASE_SERVICE_ROLE_KEY=GANTI_DENGAN_SERVICE_ROLE_KEY_ANDA
```

---

## 5. Deploy Edge Functions Lokal

Ada **2 opsi** untuk menjalankan edge functions:

### Opsi A: Supabase Edge Runtime (Recommended ✅)

Ganti service `twibo-functions` di `docker-compose.yml` dengan:

```yaml
  twibo-functions:
    image: supabase/edge-runtime:latest
    container_name: twibo-functions
    restart: always
    volumes:
      - ./supabase/functions:/home/deno/functions:ro
    environment:
      - SUPABASE_URL=http://supabase-kong:8000
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - APP_URL=https://twibo.id
    command: ["start", "--main-service", "/home/deno/functions/main"]
    networks:
      - web
      - supabase
```

Dan buat file `supabase/functions/main/index.ts`:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const functionName = url.pathname.split('/')[1];
  
  // Dynamic import
  try {
    const handler = await import(`../${functionName}/index.ts`);
    // Edge runtime will handle this
  } catch {
    return new Response('Function not found', { status: 404 });
  }
});
```

### Opsi B: Deno Standalone

Menggunakan `edge-functions-server.ts` yang sudah dibuat di langkah 4.4. Sudah termasuk di docker-compose.

---

## 6. Setup Nginx Reverse Proxy + SSL

Nginx digunakan sebagai **reverse proxy utama di host VPS** — menerima traffic port 80/443, lalu meneruskan ke container yang sesuai.

### 6.1 Install Nginx & Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Konfigurasi Nginx (Reverse Proxy)

Buat file `/etc/nginx/sites-available/twibo`:

```nginx
# ================================================
# Deteksi social media bots untuk OG preview
# ================================================
map $http_user_agent $is_social_bot {
    default 0;
    ~*(facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Googlebot|bingbot|Applebot|Pinterest|vkShare|redditbot|Embedly|SkypeUriPreview) 1;
}

# ================================================
# TWIBO.ID — Frontend + OG Proxy
# ================================================
server {
    listen 80;
    server_name twibo.id www.twibo.id;

    # ---- Gzip ----
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # ---- OG Proxy: Campaign Pages ----
    location ~ ^/c/(.+)$ {
        if ($is_social_bot) {
            # Mengarah ke edge function lokal
            # twibo-functions container internal port 8000
            return 302 http://127.0.0.1:8080/functions/og-share?type=campaign&slug=$1&app_url=https://twibo.id;
        }
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- OG Proxy: Blog Pages ----
    location ~ ^/blog/(.+)$ {
        if ($is_social_bot) {
            return 302 http://127.0.0.1:8080/functions/og-share?type=blog&slug=$1&app_url=https://twibo.id;
        }
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- Semua route lain → twibo-web container ----
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- Security Headers ----
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

# ================================================
# API.TWIBO.ID — Supabase Kong Gateway (port 8001)
# ================================================
server {
    listen 80;
    server_name api.twibo.id;

    # Proxy ke Supabase Kong (exposed di port 8001)
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (untuk Supabase Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 6.3 Aktifkan Site & Test

```bash
# Aktifkan site config
sudo ln -sf /etc/nginx/sites-available/twibo /etc/nginx/sites-enabled/twibo

# Hapus default (opsional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test konfigurasi
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

### 6.4 Setup SSL dengan Certbot (Let's Encrypt)

```bash
# Buka firewall
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 9443  # Portainer
sudo ufw enable

# Generate SSL certificates
sudo certbot --nginx -d twibo.id -d www.twibo.id -d api.twibo.id

# Certbot otomatis:
# - Menambahkan SSL config ke Nginx
# - Redirect HTTP → HTTPS
# - Auto-renew via systemd timer
```

Verifikasi auto-renew:
```bash
sudo certbot renew --dry-run
```

### 6.5 Hasil Nginx Setelah Certbot

Setelah certbot, file `/etc/nginx/sites-available/twibo` akan otomatis dimodifikasi menjadi seperti ini (contoh):

```nginx
server {
    server_name twibo.id www.twibo.id;

    # ... (semua location block tetap sama) ...

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/twibo.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/twibo.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name twibo.id www.twibo.id;
    return 301 https://$server_name$request_uri;
}

server {
    server_name api.twibo.id;

    location / {
        proxy_pass http://127.0.0.1:8001;
        # ... proxy headers ...
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/api.twibo.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.twibo.id/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name api.twibo.id;
    return 301 https://$server_name$request_uri;
}
```

---

## 7. Import Data & Storage

### 7.1 Export Data dari Lovable Cloud

Sebelum pindah, export data Anda:

1. **Database**: Dari Lovable Cloud UI, export setiap tabel sebagai CSV:
   - `profiles`, `campaigns`, `payments`, `site_settings`, `user_roles`, `vouchers`, `blog_posts`, `campaign_stats`, `campaign_stats_daily`

2. **Storage**: Download semua file dari bucket `avatars` dan `banner-images`

### 7.2 Import ke Supabase Self-Hosted

1. Buka **Supabase Studio** lokal (`http://IP_VPS:3000` atau sesuai port Studio)
2. **Table Editor** → pilih tabel → **Import CSV**
3. Upload file CSV yang sudah di-export

### 7.3 Import Storage Files

Upload file gambar ke storage bucket melalui Supabase Studio:
- Storage → `avatars` → Upload
- Storage → `banner-images` → Upload

> **Penting**: URL storage akan berubah! Dari `https://wonvlwajwhjunccyopvq.supabase.co/storage/v1/object/public/...` menjadi `https://api.twibo.id/storage/v1/object/public/...`. Anda perlu update URL di database:

```sql
-- Update avatar URLs di profiles
UPDATE profiles 
SET avatar_url = REPLACE(avatar_url, 'https://wonvlwajwhjunccyopvq.supabase.co', 'https://api.twibo.id')
WHERE avatar_url LIKE '%wonvlwajwhjunccyopvq.supabase.co%';

-- Update banner URLs di campaigns
UPDATE campaigns 
SET banner_url = REPLACE(banner_url, 'https://wonvlwajwhjunccyopvq.supabase.co', 'https://api.twibo.id')
WHERE banner_url LIKE '%wonvlwajwhjunccyopvq.supabase.co%';

-- Update cover images di blog_posts
UPDATE blog_posts 
SET cover_image_url = REPLACE(cover_image_url, 'https://wonvlwajwhjunccyopvq.supabase.co', 'https://api.twibo.id')
WHERE cover_image_url LIKE '%wonvlwajwhjunccyopvq.supabase.co%';

-- Update logo/OG image URLs di site_settings
UPDATE site_settings 
SET value = REPLACE(value, 'https://wonvlwajwhjunccyopvq.supabase.co', 'https://api.twibo.id')
WHERE value LIKE '%wonvlwajwhjunccyopvq.supabase.co%';
```

---

## 8. Verifikasi

```bash
# Cek semua container berjalan
docker ps

# Output yang diharapkan:
# NAMES               STATUS          PORTS
# twibo-web            Up X minutes    0.0.0.0:8080->80/tcp
# twibo-functions      Up X minutes    (internal only)
# portainer            Up X hours      0.0.0.0:9443->9443/tcp
# supabase-kong        Up X minutes    0.0.0.0:8001->8000/tcp
# supabase-db          Up X minutes    0.0.0.0:5433->5432/tcp
# supabase-auth        Up X minutes    ...
# supabase-storage     Up X minutes    ...
# ...dll
# 
# Nginx berjalan sebagai service systemd (bukan container)

# Cek Nginx
sudo systemctl status nginx

# Cek logs container
docker logs twibo-web
docker logs twibo-functions
docker logs supabase-kong
docker logs supabase-db

# Test akses website
curl -I https://twibo.id

# Test Supabase API via Nginx reverse proxy
curl https://api.twibo.id/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Test Supabase API langsung ke Kong port 8001
curl http://localhost:8001/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Test PostgreSQL di port 5433
psql -h localhost -p 5433 -U postgres -c "SELECT 1;"

# Test OG preview (simulasi bot WhatsApp)
curl -A "WhatsApp" -L "https://twibo.id/c/test-campaign"

# Test edge function langsung
curl http://localhost:8080/functions/og-share?type=campaign&slug=test&app_url=https://twibo.id
```

---

## 9. Update & Maintenance Setelah Deploy

### Skenario 1: Edit Fitur/UI di Lovable → Update di VPS

Setiap kali Anda melakukan perubahan di Lovable:

1. **Lovable otomatis push ke GitHub**
2. **Di VPS**, jalankan:
```bash
cd /opt/twibo
git pull origin main
docker compose build --no-cache twibo-frontend
docker compose up -d twibo-frontend
```

Atau jika menggunakan **Portainer Git Repository**:
- Portainer otomatis mendeteksi perubahan dan redeploy! ✅
- Manual: **Portainer → Stacks → twibo → Pull and redeploy**

### Skenario 2: Perubahan Database (Migration)

Jika Lovable menambah/mengubah tabel database:

1. File SQL baru akan muncul di `supabase/migrations/`
2. **Pull perubahan** di VPS:
```bash
cd /opt/twibo
git pull origin main
```
3. **Jalankan migration** di Supabase Studio lokal:
   - Buka **SQL Editor**
   - Copy-paste isi file migration baru
   - Klik **Run**

> **Atau** jalankan via CLI:
```bash
# Dari folder project
cat supabase/migrations/TIMESTAMP_nama_migration.sql | \
  docker exec -i supabase-db psql -U postgres -d postgres
```

### Skenario 3: Perubahan Edge Functions

Jika Lovable mengubah/menambah edge function:

1. Pull perubahan:
```bash
cd /opt/twibo
git pull origin main
```

2. Restart container edge functions:
```bash
docker compose restart twibo-functions
```

### Skenario 4: Update via Portainer UI

1. Buka **Portainer** → `https://IP_VPS_ANDA:9443`
2. **Stacks** → `twibo`
3. **Pull and redeploy** (icon refresh)
4. Centang **Re-pull image and redeploy**
5. Klik **Update**

### Skenario 5: Rollback ke Versi Sebelumnya

```bash
cd /opt/twibo

# Lihat history commit
git log --oneline -10

# Rollback ke commit tertentu
git checkout COMMIT_HASH

# Rebuild frontend saja
docker compose build --no-cache twibo-web
docker compose up -d twibo-web

# Kembali ke terbaru
git checkout main
git pull origin main
docker compose build --no-cache twibo-web
docker compose up -d twibo-web
```

### Skenario 6: Update Konfigurasi

```bash
cd /opt/twibo

# Edit konfigurasi
nano .env                                    # Environment variables
nano nginx.conf                              # Nginx internal (di container)
sudo nano /etc/nginx/sites-available/twibo   # Nginx host reverse proxy

# Rebuild & restart container
docker compose build --no-cache
docker compose up -d

# Reload Nginx host
sudo nginx -t && sudo systemctl reload nginx
```

### Skenario 7: Update Supabase Self-Hosted

```bash
cd /opt/supabase/supabase/docker

# Backup database dulu!
docker exec supabase-db pg_dump -U postgres postgres > /root/backup-$(date +%Y%m%d).sql

# Pull versi terbaru
git pull origin main

# Restart dengan image baru
docker compose pull
docker compose up -d
```

### Maintenance Rutin

```bash
# Backup database (jalankan rutin via cron)
docker exec supabase-db pg_dump -U postgres postgres > /root/twibo-backup-$(date +%Y%m%d).sql

# Cron job backup harian (tambahkan ke crontab -e)
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres > /root/backups/twibo-$(date +\%Y\%m\%d).sql 2>&1

# Hapus image lama
docker image prune -a -f

# Cek disk usage
docker system df

# Lihat resource usage
docker stats

# Renew SSL (otomatis via certbot timer, tapi bisa manual)
sudo certbot renew

# Backup konfigurasi
tar -czf /root/twibo-config-backup.tar.gz /opt/twibo/{Dockerfile,nginx.conf,docker-compose.yml,.env} /etc/nginx/sites-available/twibo
```

---

## 10. CI/CD Otomatis dengan GitHub Actions

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
            
            # Rebuild frontend
            docker compose build --no-cache twibo-web
            docker compose up -d twibo-web
            
            # Restart edge functions (jika ada perubahan)
            docker compose restart twibo-functions
            
            # Check untuk migration baru
            LATEST_MIGRATION=$(ls -t supabase/migrations/*.sql 2>/dev/null | head -1)
            if [ -n "$LATEST_MIGRATION" ]; then
              echo "New migration found: $LATEST_MIGRATION"
              echo "⚠️ Jalankan manual di Supabase Studio!"
            fi
            
            # Cleanup
            docker image prune -f
```

### Setup GitHub Secrets:
Di GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Nilai |
|--------|-------|
| `VPS_HOST` | IP VPS Anda |
| `VPS_USER` | `root` (atau user SSH lain) |
| `VPS_SSH_KEY` | Private key SSH |

### Generate SSH Key:
```bash
ssh-keygen -t ed25519 -C "github-actions"
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_ed25519  # Copy ini ke GitHub Secret VPS_SSH_KEY
```

---

## 11. Troubleshooting

### Container tidak start
```bash
docker logs twibo-web
docker logs twibo-functions
docker logs supabase-kong
docker logs supabase-db
```

### Frontend tidak bisa connect ke Supabase
- Pastikan `VITE_SUPABASE_URL` mengarah ke URL publik Supabase (`https://api.twibo.id`)
- Pastikan Nginx host melakukan reverse proxy ke `127.0.0.1:8001` (Kong)
- Test API: `curl https://api.twibo.id/rest/v1/ -H "apikey: ANON_KEY"`

### SSL tidak bekerja
- Pastikan port 80 & 443 terbuka: `sudo ufw status`
- Pastikan domain sudah mengarah ke IP VPS: `dig twibo.id`
- Cek logs: `sudo tail -f /var/log/nginx/error.log`
- Re-run certbot: `sudo certbot --nginx -d twibo.id -d www.twibo.id -d api.twibo.id`

### OG Preview tidak muncul di WhatsApp
- Test: `curl -A "WhatsApp" -L "https://twibo.id/c/SLUG"`
- Pastikan Nginx host mengkonfigurasi bot proxy dengan benar
- Cek logs: `docker logs twibo-functions`

### Edge function error
```bash
docker logs twibo-functions

# Test langsung
curl http://localhost:8080/functions/og-share?type=campaign&slug=test&app_url=https://twibo.id
```

### Database connection issue
```bash
# Cek Supabase DB
docker logs supabase-db

# Test koneksi lokal (port 5433)
psql -h localhost -p 5433 -U postgres -c "SELECT 1;"

# Test dari container lain
docker exec twibo-functions sh -c "curl http://supabase-kong:8000/rest/v1/"
```

### Port conflict
```bash
# Cek port yang sudah dipakai
sudo ss -tlnp | grep -E '(8000|8001|5432|5433|80|443|9443)'

# Pastikan:
# - Port 8000 → Portainer
# - Port 8001 → Supabase Kong
# - Port 5433 → PostgreSQL
# - Port 8080 → twibo-web container
# - Port 80/443 → Nginx host
# - Port 9443 → Portainer HTTPS
```

### Build gagal
```bash
docker compose build --no-cache 2>&1 | tail -50
```

### Disk penuh
```bash
docker system prune -a -f
# Hapus backup lama
find /root/backups/ -mtime +30 -delete
```

---

## Arsitektur Keseluruhan (Fully Self-Hosted)

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
│              VPS (Semua Mandiri di Sini!)                │
│                                                         │
│  Portainer (:9443 — manajemen semua container)           │
│       │                                                 │
│  Nginx Host (reverse proxy + SSL via Certbot)            │
│    ├── :80/:443 twibo.id → twibo-web (:8080)            │
│    │     └── Bot sosmed → redirect ke og-share           │
│    └── :80/:443 api.twibo.id → supabase-kong (:8001)    │
│                                                         │
│  ┌─── Docker Network: web ────────────────────────────┐ │
│  │                                                     │ │
│  │  twibo-web (Nginx container, :8080)                 │ │
│  │    ├── User biasa → React SPA                       │ │
│  │    └── Bot sosmed → twibo-functions (OG share)      │ │
│  │                                                     │ │
│  │  twibo-functions (Deno/Edge Runtime)                │ │
│  │    ├── og-share                                     │ │
│  │    ├── create-payment                               │ │
│  │    ├── midtrans-webhook                             │ │
│  │    ├── send-invoice-email                           │ │
│  │    └── test-smtp-email                              │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│       │                                                 │
│  ┌─── Docker Network: supabase ───────────────────────┐ │
│  │                                                     │ │
│  │  Supabase Self-Hosted                               │ │
│  │    ├── PostgreSQL (:5433 → internal :5432)          │ │
│  │    ├── GoTrue (authentication)                      │ │
│  │    ├── PostgREST (REST API)                         │ │
│  │    ├── Kong API Gateway (:8001 → internal :8000)    │ │
│  │    ├── Storage (file upload)                        │ │
│  │    ├── Realtime (websocket)                         │ │
│  │    └── Studio (dashboard admin)                     │ │
│  │                                                     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  ✅ TIDAK ADA koneksi ke server luar!                    │
│  ✅ Semua data tersimpan di VPS Anda                     │
│  ✅ Full kontrol atas backend                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Port Mapping Summary

| Port | Service | Keterangan |
|------|---------|------------|
| 80 | Nginx Host | HTTP (redirect ke HTTPS) |
| 443 | Nginx Host | HTTPS (SSL via Certbot) |
| 8000 | Portainer | Portainer Edge Agent |
| 8001 | Supabase Kong | API Gateway (REST, Auth, Storage) |
| 8080 | twibo-web | Frontend container (internal) |
| 5433 | PostgreSQL | Database (external access) |
| 9443 | Portainer | Dashboard HTTPS |

### Ringkasan Workflow Update:

```
1. Edit di Lovable (UI/fitur/logic)
       ↓
2. Otomatis push ke GitHub
       ↓
3a. Portainer auto-pull (jika pakai Git Repository + Automatic updates)
   ATAU
3b. GitHub Actions SSH → git pull → docker build → deploy
   ATAU
3c. Manual: SSH → git pull → docker compose build → up
       ↓
4. Jika ada migration SQL baru:
   → Jalankan manual di Supabase Studio lokal
       ↓
5. Website terupdate! 🎉
```

---

## Catatan Penting

1. **100% Self-Hosted** — Semua berjalan di VPS Anda. Database, Auth, Storage, Edge Functions, Frontend. Tidak ada ketergantungan ke server luar.
2. **Supabase Self-Hosted gratis** — Tidak ada biaya lisensi. Hanya biaya VPS.
3. **Database migration manual** — Saat Lovable menghasilkan migration baru di `supabase/migrations/`, Anda perlu menjalankannya manual di Supabase Studio lokal.
4. **Edge functions perlu restart** — Saat ada perubahan edge function, restart container: `docker compose restart twibo-functions`
5. **Backup rutin!** — Setup cron job pg_dump untuk backup database harian.
6. **Portainer gratis** — Portainer CE (Community Edition) gratis untuk single node.
7. **Nginx ganda** — Nginx Host (reverse proxy + SSL) dan Nginx Container (SPA routing + OG proxy). Host Nginx di-manage via systemd, container Nginx di-manage via Docker.
8. **Jangan expose port internal** — Hanya port 80, 443 (Nginx), dan 9443 (Portainer) yang perlu dibuka di firewall. Port 8001, 8080, 5433 cukup listen di localhost atau via Docker network.
9. **RAM minimum 4GB** — Supabase self-hosted membutuhkan RAM lebih banyak daripada hanya frontend.
10. **Midtrans webhook** — Update webhook URL di dashboard Midtrans ke: `https://api.twibo.id/functions/v1/midtrans-webhook`
