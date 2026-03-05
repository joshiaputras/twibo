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
    const { data: smtpRows } = await adminClient
      .from("site_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "admin_notification_email"]);

    const smtp: Record<string, string> = {};
    (smtpRows ?? []).forEach((r: any) => { smtp[r.key] = r.value; });

    if (!smtp.smtp_host || !smtp.smtp_username || !smtp.smtp_password) {
      return new Response(JSON.stringify({ error: "SMTP belum dikonfigurasi. Lengkapi Host, Username, dan Password terlebih dahulu." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanHost = smtp.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const port = parseInt(smtp.smtp_port || "465");
    const to = smtp.admin_notification_email || "twibo.id@gmail.com";
    const from = smtp.smtp_from_email || smtp.smtp_username;
    const now = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" });

    const transporter = nodemailer.createTransport({
      host: cleanHost,
      port,
      secure: port === 465,
      auth: {
        user: smtp.smtp_username,
        pass: smtp.smtp_password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject: "[TWIBO] Test Email - SMTP Berhasil ✅",
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
    <div style="background:#111;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">✅ Test Email Berhasil</h1>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.7;">TWIBO.id SMTP Test</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#333;margin:0 0 12px;">Konfigurasi SMTP kamu sudah benar!</p>
      <table style="width:100%;font-size:13px;">
        <tr><td style="padding:6px 0;color:#888;">Host</td><td style="padding:6px 0;text-align:right;">${cleanHost}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Port</td><td style="padding:6px 0;text-align:right;">${port}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">From</td><td style="padding:6px 0;text-align:right;">${from}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">To</td><td style="padding:6px 0;text-align:right;">${to}</td></tr>
        <tr><td style="padding:6px 0;color:#888;">Waktu</td><td style="padding:6px 0;text-align:right;">${now}</td></tr>
      </table>
    </div>
    <div style="padding:12px 24px;background:#fafafa;text-align:center;font-size:11px;color:#aaa;">TWIBO.id — SMTP Test Email</div>
  </div>
</body></html>`,
    });

    return new Response(JSON.stringify({ status: "sent", to }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("test-smtp-email error:", err);
    return new Response(JSON.stringify({ error: err.message || "Gagal mengirim test email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
