import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toWIB(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: settingsRows } = await adminClient
      .from("site_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "smtp_from_name", "admin_notification_email", "logo_url"]);

    const settings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => { settings[r.key] = r.value; });

    if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
      return new Response(JSON.stringify({ error: "SMTP not configured. Please fill in Host, Username, and Password first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanHost = settings.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const port = parseInt(settings.smtp_port || "465");
    const to = settings.admin_notification_email || "twibo.id@gmail.com";
    const now = toWIB(new Date());
    const logoUrl = settings.logo_url || '';

    const logoImg = logoUrl
      ? `<img src="${logoUrl}" alt="TWIBO.id" style="height:36px;vertical-align:middle;background:none;mix-blend-mode:normal;" />`
      : '';
    const logoBlock = `<div style="display:inline-flex;align-items:center;gap:14px;justify-content:center;">${logoImg}<span style="font-size:22px;font-weight:800;color:#fcb503;font-family:'Space Grotesk','Segoe UI',sans-serif;vertical-align:middle;">TWIBO.id</span></div>`;

    const headerStyle = `background:#1a1a2e;background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);background-size:24px 24px;color:#fff;padding:24px;text-align:center;`;

    const transporter = nodemailer.createTransport({
      host: cleanHost,
      port,
      secure: port === 465,
      auth: { user: settings.smtp_username, pass: settings.smtp_password },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: `"${settings.smtp_from_name || 'TWIBO.id'}" <${settings.smtp_username}>`,
      to,
      subject: "[TWIBO] Test Email - SMTP Successful ✅",
      envelope: { from: settings.smtp_username, to },
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;padding:24px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
    <div style="${headerStyle}">
      ${logoBlock}
      <h1 style="margin:8px 0 0;font-size:18px;color:#FFD700;">✅ Test Email Successful</h1>
      <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">TWIBO.id SMTP Test</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#333;margin:0 0 12px;">Your SMTP configuration is working correctly!</p>
      <table style="width:100%;font-size:13px;">
        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Host</td><td style="padding:8px 0;text-align:right;color:#333;">${cleanHost}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">Port</td><td style="padding:8px 0;text-align:right;color:#333;">${port}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">From</td><td style="padding:8px 0;text-align:right;color:#333;">${settings.smtp_username}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;color:#888;">To</td><td style="padding:8px 0;text-align:right;color:#333;">${to}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Sent At</td><td style="padding:8px 0;text-align:right;color:#333;">${now}</td></tr>
      </table>
    </div>
    <div style="padding:12px 24px;background:#fafafa;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;">TWIBO.id — SMTP Test Email</div>
  </div>
</body></html>`,
    });

    return new Response(JSON.stringify({ status: "sent", to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("test-smtp-email error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to send test email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
