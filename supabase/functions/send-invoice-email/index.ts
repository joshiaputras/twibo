import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEmail(smtp: Record<string, string>, to: string, subject: string, html: string) {
  const cleanHost = smtp.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const port = parseInt(smtp.smtp_port || "465");
  const from = smtp.smtp_from_email || smtp.smtp_username;

  const transporter = nodemailer.createTransport({
    host: cleanHost,
    port,
    secure: port === 465,
    auth: {
      user: smtp.smtp_username,
      pass: smtp.smtp_password,
    },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: `"${smtp.smtp_from_name || 'TWIBO.id'}" <${smtp.smtp_username}>`,
    to,
    subject,
    html,
    envelope: {
      from: smtp.smtp_username,
      to,
    },
  });
}

function buildInvoiceHtml(payment: any, campaign: any, profile: any, invoiceUrl: string, logoUrl: string) {
  const isPaypal = payment.payment_method === 'paypal';
  const amount = isPaypal
    ? `$${(payment.amount / 100).toFixed(2)} USD`
    : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("en-US", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="TWIBO.id" style="height:36px;margin-bottom:8px;" />`
    : `<span style="font-size:22px;font-weight:800;color:#b8860b;">TWIBO.id</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #b8860b, #FFD700); color: #fff; padding: 28px 32px; text-align: center;">
      ${logoBlock}
      <h1 style="margin: 8px 0 0; font-size: 20px; color: #ffffff;">✅ Payment Successful</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">TWIBO.id Creator Hub</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #333;">Hello <strong style="color: #b8860b;">${profile?.name || "Customer"}</strong>,</p>
      <p style="margin: 0 0 24px; color: #666; line-height: 1.6;">
        Thank you! Your premium upgrade payment for the campaign 
        <strong style="color: #333;">"${campaign?.name || "-"}"</strong> has been confirmed.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Order ID</td>
          <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 12px; color: #333;">${payment.midtrans_order_id}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Method</td>
          <td style="padding: 10px 0; text-align: right; text-transform: capitalize; color: #333;">${payment.payment_method || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Payment Date</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">${paidAt}</td>
        </tr>
        <tr>
          <td style="padding: 14px 0; color: #b8860b; font-weight: bold; font-size: 16px;">Total</td>
          <td style="padding: 14px 0; text-align: right; color: #b8860b; font-weight: bold; font-size: 16px;">${amount}</td>
        </tr>
      </table>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${invoiceUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #b8860b, #FFD700); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 700;">View Invoice</a>
      </div>
    </div>
    <div style="padding: 16px 32px; background: #fafafa; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee;">TWIBO.id — Automatic Invoice</div>
  </div>
</body></html>`;
}

function buildAdminNotificationHtml(payment: any, campaign: any, profile: any, logoUrl: string) {
  const isPaypal = payment.payment_method === 'paypal';
  const amount = isPaypal
    ? `$${(payment.amount / 100).toFixed(2)} USD`
    : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("en-US", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";

  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="TWIBO.id" style="height:36px;margin-bottom:8px;" />`
    : `<span style="font-size:22px;font-weight:800;color:#b8860b;">TWIBO.id</span>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #b8860b, #FFD700); color: #fff; padding: 28px 32px; text-align: center;">
      ${logoBlock}
      <h1 style="margin: 8px 0 0; font-size: 20px; color: #ffffff;">💰 New Transaction</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">TWIBO.id Admin Notification</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #333;">A new premium transaction has been completed!</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Customer</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">${profile?.name || "-"} (${profile?.email || "-"})</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Campaign</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">${campaign?.name || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Order ID</td>
          <td style="padding: 10px 0; text-align: right; font-family: monospace; font-size: 12px; color: #333;">${payment.midtrans_order_id}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Method</td>
          <td style="padding: 10px 0; text-align: right; text-transform: capitalize; color: #333;">${payment.payment_method || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 0; color: #888;">Payment Date</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">${paidAt}</td>
        </tr>
        <tr>
          <td style="padding: 14px 0; color: #b8860b; font-weight: bold; font-size: 16px;">Total</td>
          <td style="padding: 14px 0; text-align: right; color: #b8860b; font-weight: bold; font-size: 16px;">${amount}</td>
        </tr>
      </table>
    </div>
    <div style="padding: 16px 32px; background: #fafafa; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee;">TWIBO.id — Admin Notification</div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, app_url } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "SMTP not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: payment } = await adminClient
      .from("payments").select("*").eq("midtrans_order_id", order_id).single();

    if (!payment) {
      return new Response(JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: campaign }, { data: profile }] = await Promise.all([
      adminClient.from("campaigns").select("name, slug").eq("id", (payment as any).campaign_id).single(),
      adminClient.from("profiles").select("name, email, phone").eq("id", (payment as any).user_id).single(),
    ]);

    const logoUrl = settings.logo_url || '';
    const invoiceUrl = `${app_url || "https://twibbo-creator-hub.lovable.app"}/invoice/${order_id}`;

    if ((profile as any)?.email) {
      const html = buildInvoiceHtml(payment, campaign, profile, invoiceUrl, logoUrl);
      await sendEmail(settings, (profile as any).email, `Payment Invoice - ${(payment as any).midtrans_order_id}`, html);
      console.log("Invoice email sent to customer:", (profile as any).email);
    }

    const adminEmail = settings.admin_notification_email || "twibo.id@gmail.com";
    try {
      const adminHtml = buildAdminNotificationHtml(payment, campaign, profile, logoUrl);
      await sendEmail(settings, adminEmail, `[TWIBO] New Transaction - ${(payment as any).midtrans_order_id}`, adminHtml);
      console.log("Admin notification email sent to:", adminEmail);
    } catch (adminEmailErr: any) {
      console.error("Failed to send admin notification email:", adminEmailErr.message);
    }

    return new Response(JSON.stringify({ status: "sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-invoice-email error:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
