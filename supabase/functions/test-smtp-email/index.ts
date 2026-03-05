import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      .in("key", ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "admin_notification_email", "logo_url"]);

    const settings: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => { settings[r.key] = r.value; });

    if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password) {
      return new Response(JSON.stringify({ error: "SMTP not configured. Please fill in Host, Username, and Password first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanHost = settings.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const port = parseInt(settings.smtp_port || "465");
    const to = settings.admin_notification_email || "twibo.id@gmail.com";
    const from = settings.smtp_from_email || settings.smtp_username;
    const now = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "medium" });
    const logoUrl = settings.logo_url || '';

    const logoBlock = logoUrl
      ? `<img src="${logoUrl}" alt="TWIBO.id" style="height:32px;margin-bottom:8px;" />`
      : `<span style="font-size:20px;font-weight:800;color:#FFD700;">TWIBO.id</span>`;

    const transporter = nodemailer.createTransport({
      host: cleanHost,
      port,
      secure: port === 465,
      auth: {
        user: settings.smtp_username,
        pass: settings.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject: "[TWIBO] Test Email - SMTP Successful ✅",
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#111;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1a1a1a;border-radius:12px;border:1px solid #333;overflow:hidden;">
    <div style="background:#0a0e1a;color:#fff;padding:24px;text-align:center;">
      ${logoBlock}
      <h1 style="margin:8px 0 0;font-size:18px;color:#FFD700;">✅ Test Email Successful</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#999;">TWIBO.id SMTP Test</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#e5e5e5;margin:0 0 12px;">Your SMTP configuration is working correctly!</p>
      <table style="width:100%;font-size:13px;">
        <tr><td style="padding:8px 0;color:#888;">Host</td><td style="padding:8px 0;text-align:right;color:#e5e5e5;">${cleanHost}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Port</td><td style="padding:8px 0;text-align:right;color:#e5e5e5;">${port}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">From</td><td style="padding:8px 0;text-align:right;color:#e5e5e5;">${from}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">To</td><td style="padding:8px 0;text-align:right;color:#e5e5e5;">${to}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Sent At</td><td style="padding:8px 0;text-align:right;color:#e5e5e5;">${now}</td></tr>
      </table>
    </div>
    <div style="padding:12px 24px;background:#111;text-align:center;font-size:11px;color:#666;">TWIBO.id — SMTP Test Email</div>
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
