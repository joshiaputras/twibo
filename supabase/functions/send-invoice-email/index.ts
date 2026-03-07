import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.12";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toWIB(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Jakarta",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

async function sendEmail(smtp: Record<string, string>, to: string, subject: string, html: string, attachments?: any[]) {
  const cleanHost = smtp.smtp_host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const port = parseInt(smtp.smtp_port || "465");

  const transporter = nodemailer.createTransport({
    host: cleanHost,
    port,
    secure: port === 465,
    auth: { user: smtp.smtp_username, pass: smtp.smtp_password },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: `"${smtp.smtp_from_name || 'TWIBO.id'}" <${smtp.smtp_username}>`,
    to,
    subject,
    html,
    envelope: { from: smtp.smtp_username, to },
    ...(attachments ? { attachments } : {}),
  });
}

const headerStyle = `background:#1a1a2e;background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);background-size:24px 24px;color:#fff;padding:28px 32px;text-align:center;`;

function buildLogoBlock(logoUrl: string) {
  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="TWIBO.id" style="height:36px;width:36px;border-radius:8px;object-fit:cover;vertical-align:middle;background:none;border:0;" />`
    : '';
  // Use table layout for reliable gap in email clients
  if (logoImg) {
    return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td style="vertical-align:middle;">${logoImg}</td><td style="width:10px;"></td><td style="vertical-align:middle;"><span style="font-size:22px;font-weight:800;color:#fcb503;font-family:'Space Grotesk','Segoe UI',sans-serif;">TWIBO.id</span></td></tr></table>`;
  }
  return `<span style="font-size:22px;font-weight:800;color:#fcb503;font-family:'Space Grotesk','Segoe UI',sans-serif;">TWIBO.id</span>`;
}

function buildInvoiceHtml(payment: any, campaign: any, profile: any, invoiceUrl: string, logoUrl: string) {
  const isPaypal = payment.payment_method === 'paypal';
  const discountAmount = payment.discount_amount || 0;
  const subtotal = (payment.amount || 0) + discountAmount;
  const subtotalStr = isPaypal ? `$${(subtotal / 100).toFixed(2)} USD` : `Rp ${subtotal.toLocaleString("id-ID")}`;
  const discountStr = isPaypal ? `-$${(discountAmount / 100).toFixed(2)} USD` : `-Rp ${discountAmount.toLocaleString("id-ID")}`;
  const totalStr = isPaypal ? `$${(payment.amount / 100).toFixed(2)} USD` : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at ? toWIB(payment.paid_at) : "-";

  const logoBlock = buildLogoBlock(logoUrl);

  const discountRow = discountAmount > 0
    ? `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#22863a;">Voucher Discount${payment.voucher_code ? ` (${payment.voucher_code})` : ''}</td><td style="padding:10px 0;text-align:right;color:#22863a;font-weight:600;">${discountStr}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
    <div style="${headerStyle}">
      ${logoBlock}
      <h1 style="margin:8px 0 0;font-size:20px;color:#FFD700;">✅ Payment Successful</h1>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">TWIBO.id Creator Hub</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#333;">Hello <strong style="color:#b8860b;">${profile?.name || "Customer"}</strong>,</p>
      <p style="margin:0 0 24px;color:#666;line-height:1.6;">
        Thank you! Your premium upgrade payment for the campaign 
        <strong style="color:#333;">"${campaign?.name || "-"}"</strong> has been confirmed.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Order ID</td><td style="padding:10px 0;text-align:right;font-family:monospace;font-size:12px;color:#333;">${payment.midtrans_order_id}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Method</td><td style="padding:10px 0;text-align:right;text-transform:capitalize;color:#333;">${payment.payment_method || "-"}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Payment Date</td><td style="padding:10px 0;text-align:right;color:#333;">${paidAt}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Subtotal</td><td style="padding:10px 0;text-align:right;color:#333;">${subtotalStr}</td></tr>
        ${discountRow}
        <tr><td style="padding:14px 0;color:#000000;font-weight:bold;font-size:16px;">Total</td><td style="padding:14px 0;text-align:right;color:#000000;font-weight:bold;font-size:16px;">${totalStr}</td></tr>
      </table>
      <p style="margin:20px 0 0;color:#888;font-size:12px;">A PDF invoice is also attached to this email.</p>
      <div style="margin-top:24px;text-align:center;">
        <a href="${invoiceUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#b8860b,#FFD700);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">View Invoice Online</a>
      </div>
    </div>
    <div style="padding:16px 32px;background:#fafafa;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;">TWIBO.id — Automatic Invoice</div>
  </div>
</body></html>`;
}

function buildAdminNotificationHtml(payment: any, campaign: any, profile: any, logoUrl: string) {
  const isPaypal = payment.payment_method === 'paypal';
  const amount = isPaypal
    ? `$${(payment.amount / 100).toFixed(2)} USD`
    : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  const paidAt = payment.paid_at ? toWIB(payment.paid_at) : "-";

  const logoBlock = buildLogoBlock(logoUrl);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;padding:24px;margin:0;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;overflow:hidden;">
    <div style="${headerStyle}">
      ${logoBlock}
      <h1 style="margin:8px 0 0;font-size:20px;color:#FFD700;">💰 New Transaction</h1>
      <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">TWIBO.id Admin Notification</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#333;">A new premium transaction has been completed!</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Customer</td><td style="padding:10px 0;text-align:right;color:#333;">${profile?.name || "-"} (${profile?.email || "-"})</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Campaign</td><td style="padding:10px 0;text-align:right;color:#333;">${campaign?.name || "-"}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Order ID</td><td style="padding:10px 0;text-align:right;font-family:monospace;font-size:12px;color:#333;">${payment.midtrans_order_id}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Method</td><td style="padding:10px 0;text-align:right;text-transform:capitalize;color:#333;">${payment.payment_method || "-"}</td></tr>
        <tr style="border-bottom:1px solid #eee;"><td style="padding:10px 0;color:#888;">Payment Date</td><td style="padding:10px 0;text-align:right;color:#333;">${paidAt}</td></tr>
        <tr><td style="padding:14px 0;color:#000000;font-weight:bold;font-size:16px;">Total</td><td style="padding:14px 0;text-align:right;color:#000000;font-weight:bold;font-size:16px;">${amount}</td></tr>
      </table>
    </div>
    <div style="padding:16px 32px;background:#fafafa;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;">TWIBO.id — Admin Notification</div>
  </div>
</body></html>`;
}

async function generateInvoicePdf(payment: any, campaign: any, profile: any, logoUrl: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  const gold = rgb(0.99, 0.71, 0.01); // #fcb503
  const black = rgb(0.13, 0.13, 0.13);
  const gray = rgb(0.53, 0.53, 0.53);

  let y = height - 60;

  // Header - embed logo if available
  let logoXOffset = 50;
  if (logoUrl) {
    try {
      // Convert WebP/any format to PNG via canvas-free approach
      // Try fetching as PNG first by checking content type
      const logoRes = await fetch(logoUrl);
      const contentType = logoRes.headers.get("content-type") || "";
      const logoBytes = new Uint8Array(await logoRes.arrayBuffer());
      
      let logoImage;
      if (contentType.includes("jpeg") || contentType.includes("jpg") || logoUrl.endsWith(".jpg") || logoUrl.endsWith(".jpeg")) {
        logoImage = await doc.embedJpg(logoBytes);
      } else if (contentType.includes("png") || logoUrl.endsWith(".png")) {
        logoImage = await doc.embedPng(logoBytes);
      } else {
        // WebP or other formats - skip embedding, pdf-lib doesn't support them
        console.warn("Logo format not supported for PDF embedding (webp/other). Skipping logo.");
        logoImage = null;
      }
      
      if (logoImage) {
        const logoDim = logoImage.scale(32 / logoImage.height);
        page.drawImage(logoImage, { x: 50, y: y - 4, width: logoDim.width, height: logoDim.height });
        logoXOffset = 50 + logoDim.width + 10;
      }
    } catch (e) {
      console.error("Failed to embed logo in PDF:", e);
    }
  }
  page.drawText("TWIBO.id", { x: logoXOffset, y, size: 28, font: fontBold, color: gold });
  page.drawText("INVOICE", { x: 430, y, size: 22, font: fontBold, color: black });
  y -= 20;
  page.drawText("www.twibo.id", { x: logoXOffset, y, size: 10, font, color: gray });

  const isPaid = payment.status === "paid";
  page.drawText(isPaid ? "PAID" : (payment.status || "").toUpperCase(), {
    x: 430, y, size: 12, font: fontBold, color: isPaid ? rgb(0.13, 0.55, 0.13) : rgb(0.8, 0.6, 0),
  });
  y -= 40;

  // Line
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 30;

  // Details
  const drawRow = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font, color: gray });
    page.drawText(value, { x: 250, y, size: 11, font, color: black });
    y -= 22;
  };

  drawRow("Order ID", payment.midtrans_order_id || "-");
  drawRow("Date", payment.created_at ? toWIB(payment.created_at) : "-");
  if (payment.paid_at) drawRow("Payment Date", toWIB(payment.paid_at));
  if (payment.payment_method) drawRow("Payment Method", payment.payment_method);
  if (payment.midtrans_transaction_id) drawRow("Transaction ID", payment.midtrans_transaction_id);

  y -= 10;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 25;

  // Bill To
  page.drawText("Bill To", { x: 50, y, size: 11, font: fontBold, color: gray });
  y -= 18;
  page.drawText(profile?.name || "-", { x: 50, y, size: 12, font: fontBold, color: black });
  y -= 16;
  page.drawText(profile?.email || "-", { x: 50, y, size: 10, font, color: gray });
  if (profile?.phone) { y -= 14; page.drawText(profile.phone, { x: 50, y, size: 10, font, color: gray }); }

  y -= 30;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
  y -= 25;

  // Items
  page.drawText("Description", { x: 50, y, size: 11, font: fontBold, color: gray });
  page.drawText("Amount", { x: 430, y, size: 11, font: fontBold, color: gray });
  y -= 22;

  page.drawText("Premium Upgrade", { x: 50, y, size: 12, font, color: black });
  const isPaypal = payment.payment_method === "paypal";
  const discountAmt = payment.discount_amount || 0;
  const subtotal = (payment.amount || 0) + discountAmt;
  const subtotalStr = isPaypal ? `$${(subtotal / 100).toFixed(2)} USD` : `Rp ${subtotal.toLocaleString("id-ID")}`;
  const amountStr = isPaypal ? `$${(payment.amount / 100).toFixed(2)} USD` : `Rp ${(payment.amount || 0).toLocaleString("id-ID")}`;
  page.drawText(subtotalStr, { x: 430, y, size: 12, font, color: black });
  y -= 16;
  page.drawText(`Campaign: ${campaign?.name || "-"}`, { x: 50, y, size: 9, font, color: gray });

  if (discountAmt > 0) {
    y -= 22;
    const discountStr = isPaypal ? `-$${(discountAmt / 100).toFixed(2)} USD` : `-Rp ${discountAmt.toLocaleString("id-ID")}`;
    const green = rgb(0.13, 0.53, 0.13);
    page.drawText(`Voucher Discount${payment.voucher_code ? ` (${payment.voucher_code})` : ''}`, { x: 50, y, size: 11, font, color: green });
    page.drawText(discountStr, { x: 430, y, size: 11, font, color: green });
  }

  y -= 25;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;

  page.drawText("Total", { x: 50, y, size: 14, font: fontBold, color: black });
  page.drawText(amountStr, { x: 430, y, size: 14, font: fontBold, color: black });

  // Footer - centered line separator + text
  const pageWidth = 595;
  page.drawLine({ start: { x: 50, y: 55 }, end: { x: 545, y: 55 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  const footerText1 = "TWIBO.id  —  www.twibo.id  —  cs@twibo.id";
  const footerText2 = "Thank you for your purchase!";
  const ft1Width = font.widthOfTextAtSize(footerText1, 9);
  const ft2Width = font.widthOfTextAtSize(footerText2, 9);
  page.drawText(footerText1, { x: (pageWidth - ft1Width) / 2, y: 40, size: 9, font, color: gray });
  page.drawText(footerText2, { x: (pageWidth - ft2Width) / 2, y: 26, size: 9, font, color: gray });

  return await doc.save();
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
      .in("key", ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "smtp_from_name", "admin_notification_email", "logo_url", "invoice_logo_url"]);

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
    const invoiceLogoUrl = settings.invoice_logo_url || logoUrl; // PNG version for PDF
    const invoiceUrl = `${app_url || "https://twibo.id"}/invoice/${order_id}`;

    // Generate PDF with PNG invoice logo
    let pdfBytes: Uint8Array | null = null;
    try {
      pdfBytes = await generateInvoicePdf(payment, campaign, profile, invoiceLogoUrl);
    } catch (pdfErr: any) {
      console.error("PDF generation failed:", pdfErr.message);
    }

    const attachments = pdfBytes
      ? [{ filename: `invoice-${order_id}.pdf`, content: pdfBytes, contentType: "application/pdf" }]
      : undefined;

    if ((profile as any)?.email) {
      const html = buildInvoiceHtml(payment, campaign, profile, invoiceUrl, logoUrl);
      await sendEmail(settings, (profile as any).email, `Payment Invoice - ${(payment as any).midtrans_order_id}`, html, attachments);
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
