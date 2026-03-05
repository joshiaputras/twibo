import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEmail(smtp: Record<string, string>, to: string, subject: string, html: string) {
  const cleanHost = smtp.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const port = parseInt(smtp.smtp_port || "465");
  const from = smtp.smtp_from_email || smtp.smtp_username;

  const client = new SMTPClient({
    connection: {
      hostname: cleanHost,
      port,
      tls: port === 465,
      auth: {
        username: smtp.smtp_username,
        password: smtp.smtp_password,
      },
    },
  });

  await client.send({ from, to, subject, content: "Email from TWIBO", html });
  await client.close();
}

function buildInvoiceHtml(payment: any, campaign: any, profile: any, invoiceUrl: string) {
  const isPaypal = payment.payment_method === 'paypal';
  const amount = isPaypal
    ? `$${(payment.amount / 100).toFixed(2)} USD`
    : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("id-ID", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5; overflow: hidden;">
    <div style="background: #111; color: #fff; padding: 24px 32px;">
      <h1 style="margin: 0; font-size: 20px;">✅ Pembayaran Berhasil</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.7;">Twibbo Creator Hub</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #333;">Halo <strong>${profile?.name || "Customer"}</strong>,</p>
      <p style="margin: 0 0 24px; color: #555; line-height: 1.6;">
        Terima kasih! Pembayaran upgrade premium untuk campaign 
        <strong>"${campaign?.name || "-"}"</strong> telah berhasil dikonfirmasi.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Order ID</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${payment.midtrans_order_id}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Metode</td>
          <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${payment.payment_method || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Tanggal Bayar</td>
          <td style="padding: 8px 0; text-align: right;">${paidAt}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #333; font-weight: bold; font-size: 16px;">Total</td>
          <td style="padding: 12px 0; text-align: right; color: #333; font-weight: bold; font-size: 16px;">${amount}</td>
        </tr>
      </table>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${invoiceUrl}" style="display: inline-block; padding: 12px 28px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Lihat Invoice</a>
      </div>
    </div>
    <div style="padding: 16px 32px; background: #fafafa; text-align: center; font-size: 11px; color: #aaa;">Twibbo Creator Hub — Invoice otomatis</div>
  </div>
</body></html>`;
}

function buildAdminNotificationHtml(payment: any, campaign: any, profile: any) {
  const isPaypal = payment.payment_method === 'paypal';
  const amount = isPaypal
    ? `$${(payment.amount / 100).toFixed(2)} USD`
    : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at
    ? new Date(payment.paid_at).toLocaleDateString("id-ID", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5; overflow: hidden;">
    <div style="background: #2563eb; color: #fff; padding: 24px 32px;">
      <h1 style="margin: 0; font-size: 20px;">💰 Transaksi Baru Berhasil</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.7;">TWIBO.id Admin Notification</p>
    </div>
    <div style="padding: 32px;">
      <p style="margin: 0 0 16px; color: #333;">Ada transaksi premium baru yang berhasil!</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Customer</td>
          <td style="padding: 8px 0; text-align: right;">${profile?.name || "-"} (${profile?.email || "-"})</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Campaign</td>
          <td style="padding: 8px 0; text-align: right;">${campaign?.name || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Order ID</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${payment.midtrans_order_id}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Metode</td>
          <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${payment.payment_method || "-"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px 0; color: #888;">Tanggal Bayar</td>
          <td style="padding: 8px 0; text-align: right;">${paidAt}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #333; font-weight: bold; font-size: 16px;">Total</td>
          <td style="padding: 12px 0; text-align: right; color: #2563eb; font-weight: bold; font-size: 16px;">${amount}</td>
        </tr>
      </table>
    </div>
    <div style="padding: 16px 32px; background: #fafafa; text-align: center; font-size: 11px; color: #aaa;">TWIBO.id — Admin Notification</div>
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

    const { data: smtpRows } = await adminClient
      .from("site_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "smtp_from_name", "admin_notification_email"]);

    const smtp: Record<string, string> = {};
    (smtpRows ?? []).forEach((r: any) => { smtp[r.key] = r.value; });

    if (!smtp.smtp_host || !smtp.smtp_username || !smtp.smtp_password) {
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

    const invoiceUrl = `${app_url || "https://twibbo-creator-hub.lovable.app"}/invoice/${order_id}`;

    // Send invoice email to customer
    if ((profile as any)?.email) {
      const html = buildInvoiceHtml(payment, campaign, profile, invoiceUrl);
      await sendEmail(smtp, (profile as any).email, `Invoice Pembayaran - ${(payment as any).midtrans_order_id}`, html);
      console.log("Invoice email sent to customer:", (profile as any).email);
    }

    // Send admin notification email
    const adminEmail = smtp.admin_notification_email || "twibo.id@gmail.com";
    try {
      const adminHtml = buildAdminNotificationHtml(payment, campaign, profile);
      await sendEmail(smtp, adminEmail, `[TWIBO] Transaksi Baru - ${(payment as any).midtrans_order_id}`, adminHtml);
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
