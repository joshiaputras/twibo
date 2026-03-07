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
#   0 * * * * /path/to/scripts/generate-sitemap.sh
#
# Requirements:
#   - psql (PostgreSQL client)
#   - Pastikan variabel di bawah sesuai dengan konfigurasi VPS
# =============================================================

# ---- KONFIGURASI ----
# Sesuaikan dengan konfigurasi Docker Supabase di VPS Anda
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="your-super-secret-and-long-postgres-password"  # Ganti dengan password PostgreSQL Anda

SITE_URL="https://twibo.id"
OUTPUT_DIR="/var/www/twibo.id"  # Sesuaikan dengan document root Nginx Anda
OUTPUT_FILE="$OUTPUT_DIR/sitemap.xml"

# ---- STATIC PAGES ----
TODAY=$(date +%Y-%m-%d)

cat > "$OUTPUT_FILE" << 'HEADER'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
HEADER

# Static pages
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
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' \
  -c "SELECT slug, updated_at::date FROM public.campaigns WHERE status = 'published' AND is_private = false ORDER BY updated_at DESC;" \
  2>/dev/null | while IFS='|' read -r slug updated_at; do
    [ -z "$slug" ] && continue
    cat >> "$OUTPUT_FILE" << EOF
  <url>
    <loc>${SITE_URL}/campaign/${slug}</loc>
    <lastmod>${updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
EOF
done

# ---- BLOG POSTS (published) ----
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F'|' \
  -c "SELECT slug, updated_at::date FROM public.blog_posts WHERE status = 'published' ORDER BY updated_at DESC;" \
  2>/dev/null | while IFS='|' read -r slug updated_at; do
    [ -z "$slug" ] && continue
    cat >> "$OUTPUT_FILE" << EOF
  <url>
    <loc>${SITE_URL}/blog/${slug}</loc>
    <lastmod>${updated_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
EOF
done

# Close urlset
echo "</urlset>" >> "$OUTPUT_FILE"

echo "✅ Sitemap generated: $OUTPUT_FILE ($(date))"
