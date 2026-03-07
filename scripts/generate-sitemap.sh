#!/bin/bash
# =============================================================
# Sitemap Generator for twibo.id (VPS)
# Generates /sitemap.xml from PostgreSQL database
# 
# Usage:
#   chmod +x scripts/generate-sitemap.sh
#   ./scripts/generate-sitemap.sh
#
# Cron (setiap 1 jam):
#   0 * * * * /path/to/scripts/generate-sitemap.sh >> /var/log/sitemap.log 2>&1
#
# Requirements:
#   - psql (PostgreSQL client)
#   - Pastikan variabel di bawah sesuai dengan konfigurasi VPS
# =============================================================

set -e

# ---- KONFIGURASI ----
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="your-super-secret-and-long-postgres-password"  # Ganti dengan password PostgreSQL Anda

SITE_URL="https://twibo.id"
OUTPUT_DIR="/var/www/twibo.id"  # Sesuaikan dengan document root Nginx Anda
OUTPUT_FILE="$OUTPUT_DIR/sitemap.xml"
LOG_PREFIX="[sitemap $(date '+%Y-%m-%d %H:%M:%S')]"

# ---- CEK PSQL ----
if ! command -v psql &> /dev/null; then
  echo "$LOG_PREFIX ❌ ERROR: psql tidak ditemukan. Install dulu: apt install postgresql-client"
  exit 1
fi

# ---- CEK KONEKSI DB ----
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "$LOG_PREFIX ❌ ERROR: Tidak bisa connect ke database. Cek host/port/password."
  exit 1
fi

echo "$LOG_PREFIX ✅ Database connected"

# ---- CEK TABEL blog_posts ----
BLOG_TABLE_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A \
  -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blog_posts');")

if [ "$BLOG_TABLE_EXISTS" != "t" ]; then
  echo "$LOG_PREFIX ⚠️ WARNING: Tabel blog_posts TIDAK ADA di database!"
fi

# ---- BUAT OUTPUT DIR ----
mkdir -p "$OUTPUT_DIR"

# ---- STATIC PAGES ----
TODAY=$(date +%Y-%m-%d)

cat > "$OUTPUT_FILE" << 'HEADER'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
HEADER

declare -A STATIC_PAGES=(
  ["/"]="1.0|daily"
  ["/pricing"]="0.8|weekly"
  ["/blog"]="0.8|daily"
  ["/about"]="0.5|monthly"
  ["/contact"]="0.5|monthly"
  ["/terms"]="0.3|yearly"
  ["/privacy"]="0.3|yearly"
  ["/login"]="0.3|yearly"
  ["/signup"]="0.3|yearly"
)

for path in "${!STATIC_PAGES[@]}"; do
  IFS='|' read -r priority changefreq <<< "${STATIC_PAGES[$path]}"
  cat >> "$OUTPUT_FILE" << EOF
  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
EOF
done

# ---- CAMPAIGNS (published & not private) ----
CAMPAIGN_COUNT=0
while IFS='|' read -r slug updated_at; do
  [ -z "$slug" ] && continue
  CAMPAIGN_COUNT=$((CAMPAIGN_COUNT + 1))
  cat >> "$OUTPUT_FILE" << EOF
  <url>
    <loc>${SITE_URL}/campaign/${slug}</loc>
    <lastmod>${updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
EOF
done < <(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' \
  -c "SELECT slug, updated_at::date FROM public.campaigns WHERE status = 'published' AND is_private = false ORDER BY updated_at DESC;")

echo "$LOG_PREFIX 📋 Campaigns: $CAMPAIGN_COUNT entries"

# ---- BLOG POSTS (published) ----
BLOG_COUNT=0
while IFS='|' read -r slug updated_at; do
  [ -z "$slug" ] && continue
  BLOG_COUNT=$((BLOG_COUNT + 1))
  cat >> "$OUTPUT_FILE" << EOF
  <url>
    <loc>${SITE_URL}/blog/${slug}</loc>
    <lastmod>${updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
EOF
done < <(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' \
  -c "SELECT slug, updated_at::date FROM public.blog_posts WHERE status = 'published' ORDER BY updated_at DESC;")

echo "$LOG_PREFIX 📝 Blog posts: $BLOG_COUNT entries"

# Close urlset
echo "</urlset>" >> "$OUTPUT_FILE"

echo "$LOG_PREFIX ✅ Sitemap generated: $OUTPUT_FILE (total: $((9 + CAMPAIGN_COUNT + BLOG_COUNT)) URLs)"
