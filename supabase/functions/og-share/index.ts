import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_APP_URL = "https://twibo.id";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function padDescription(name: string, desc: string): string {
  if (desc.length >= 150) return desc.slice(0, 160);
  const templates = [
    `Dukung kampanye ${name} dengan membuat twibbon gratis di TWIBO.id. ${desc} Upload foto kamu dan bagikan dukunganmu sekarang!`,
    `${desc} Buat twibbon ${name} secara gratis di TWIBO.id. Mudah, cepat, dan bisa langsung dibagikan ke media sosial.`,
    `Ikuti kampanye ${name} di TWIBO.id! ${desc} Buat twibbon kamu sendiri dan tunjukkan dukunganmu kepada semua orang.`,
    `${name} — ${desc} Bergabung dengan kampanye ini dan buat twibbon gratis di TWIBO.id sekarang juga!`,
  ];
  const idx = name.length % templates.length;
  return templates[idx].slice(0, 160);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // "campaign" or "blog"
  const slug = url.searchParams.get("slug");
  const appUrl = url.searchParams.get("app_url") || DEFAULT_APP_URL;

  if (!type || !slug) {
    return Response.redirect(appUrl, 302);
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get default OG image
  const { data: ogSetting } = await adminClient
    .from("site_settings")
    .select("value")
    .eq("key", "og_image_url")
    .maybeSingle();
  const defaultOgImage = ogSetting?.value || `${appUrl}/og-image.png`;

  let title = "TWIBO.id — Buat Twibbon Online Gratis & Privat";
  let description = "Buat twibbon campaign online gratis di TWIBO.id. Platform twibbon maker privat untuk komunitas, organisasi, dan event.";
  let ogImage = defaultOgImage;
  let canonicalUrl = appUrl;
  let ogType = "website";

  if (type === "campaign") {
    const { data: campaign } = await adminClient
      .from("campaigns")
      .select("name, description, banner_url, slug")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (campaign) {
      title = `${campaign.name} — Twibbon TWIBO.id`;
      const rawDesc = (campaign.description || "").trim();
      description = padDescription(campaign.name, rawDesc);
      ogImage = campaign.banner_url || defaultOgImage;
      canonicalUrl = `${appUrl}/c/${campaign.slug}`;
    }
  } else if (type === "blog") {
    const { data: post } = await adminClient
      .from("blog_posts")
      .select("title, meta_title, meta_description, excerpt, cover_image_url, slug")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (post) {
      title = `${post.meta_title || post.title} — TWIBO.id Blog`;
      description = post.meta_description || post.excerpt || description;
      ogImage = post.cover_image_url || defaultOgImage;
      canonicalUrl = `${appUrl}/blog/${post.slug}`;
      ogType = "article";
    }
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="TWIBO.id">
  <meta property="og:locale" content="id_ID">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonicalUrl)}">
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
