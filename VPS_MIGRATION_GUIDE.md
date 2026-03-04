# Panduan Migrasi ke VPS & Lanjut Develop dari Lovable

## Bagian 1: Migrasi dari Lovable Cloud ke VPS

### Prasyarat VPS
- Ubuntu 22.04+ / Debian 12+
- Min 2GB RAM, 20GB disk
- Domain & SSL (Let's Encrypt)
- Docker & Docker Compose terinstall

### Langkah 1: Export Kode dari GitHub
Lovable otomatis push ke GitHub. Clone repo:
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### Langkah 2: Install Supabase Self-Hosted di VPS
```bash
# Clone Supabase docker setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, dll
docker compose up -d
```

Setelah Supabase self-hosted berjalan di `http://YOUR_VPS_IP:8000`:
1. Buka Supabase Studio di `http://YOUR_VPS_IP:8000`
2. Import semua migrasi SQL dari folder `supabase/migrations/` secara berurutan
3. Buat semua database functions yang ada (lihat di Supabase Studio → SQL Editor)

### Langkah 3: Export Data dari Lovable Cloud
Gunakan Lovable Cloud UI untuk export data tabel:
- Buka Cloud → Database → Tables
- Export setiap tabel (campaigns, profiles, payments, site_settings, user_roles, campaign_stats)
- Import CSV ke Supabase self-hosted via Studio

### Langkah 4: Deploy Edge Functions di VPS
```bash
# Install Supabase CLI
npm install -g supabase

# Deploy edge functions
supabase functions deploy create-payment --project-ref YOUR_LOCAL_REF
supabase functions deploy midtrans-webhook --project-ref YOUR_LOCAL_REF
```

Atau gunakan Deno deploy langsung:
```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Jalankan edge function sebagai standalone server
deno run --allow-net --allow-env supabase/functions/create-payment/index.ts
```

### Langkah 5: Build & Deploy Frontend
```bash
# Di folder project
npm install
npm run build

# Hasil build ada di folder dist/
# Deploy dengan Nginx:
sudo cp -r dist/* /var/www/html/
```

### Langkah 6: Konfigurasi Nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy ke Supabase self-hosted (opsional)
    location /supabase/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Langkah 7: Update Environment Variables
Buat file `.env.production`:
```env
VITE_SUPABASE_URL=https://yourdomain.com/supabase  # atau IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_NEW_ANON_KEY
VITE_SUPABASE_PROJECT_ID=your-local-project-id
```

Rebuild: `npm run build`

### Langkah 8: Setup SSL
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Langkah 9: Konfigurasi Midtrans Webhook
Di dashboard Midtrans, ubah webhook URL ke:
```
https://yourdomain.com/supabase/functions/v1/midtrans-webhook
```

---

## Bagian 2: Lanjut Develop di Lovable, Deploy ke VPS

### Workflow yang Direkomendasikan

1. **Develop di Lovable** → push otomatis ke GitHub
2. **Pull di VPS** → `git pull origin main`
3. **Rebuild** → `npm install && npm run build`
4. **Deploy** → copy `dist/` ke Nginx

### Automasi dengan GitHub Actions (CI/CD)
Buat `.github/workflows/deploy.yml`:
```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & Build
        run: |
          npm ci
          npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}

      - name: Deploy to VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "dist/*"
          target: "/var/www/html"
          strip_components: 1

      - name: Restart Nginx
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: sudo systemctl reload nginx
```

### Workflow Lengkap:
```
Lovable (edit UI/logic)
    ↓ auto push
GitHub (source code)
    ↓ GitHub Actions
VPS (build + deploy)
    ↓
Nginx (serve static files)
    ↓
Supabase Self-Hosted (database + auth + functions)
```

### Tips Penting:
1. **Database migrations**: Saat menambah fitur di Lovable yang mengubah database, migration SQL akan muncul di `supabase/migrations/`. Jalankan SQL ini manual di Supabase Studio VPS Anda.
2. **Edge functions**: Saat Lovable membuat/mengubah edge functions, pull dan deploy ulang di VPS.
3. **Environment**: Pastikan `.env.production` di VPS selalu diupdate jika ada perubahan konfigurasi.
4. **Backup**: Setup pg_dump cron job untuk backup database rutin.

---

## Bagian 3: Alternatif Tanpa Supabase Self-Hosted

Jika tidak ingin host Supabase sendiri, Anda tetap bisa pakai Lovable Cloud untuk backend dan hanya host frontend di VPS:

1. Build frontend: `npm run build`
2. Deploy `dist/` ke VPS Nginx
3. Biarkan `.env` tetap mengarah ke Lovable Cloud Supabase URL
4. Edge functions tetap berjalan di Lovable Cloud

Ini adalah opsi paling mudah — frontend di VPS Anda, backend tetap di Lovable Cloud.
