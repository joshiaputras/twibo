import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const body = await req.json();
    const {
      order_id,
      transaction_status,
      fraud_status,
      transaction_id,
      payment_type,
      signature_key,
      status_code,
      gross_amount,
    } = body;

    console.log("Midtrans webhook:", { order_id, transaction_status, fraud_status });

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify signature using server key from site_settings
    const { data: serverKeyRow } = await adminClient
      .from("site_settings")
      .select("value")
      .eq("key", "midtrans_server_key")
      .single();

    const serverKey = serverKeyRow?.value;

    if (serverKey && signature_key) {
      // SHA512(order_id + status_code + gross_amount + server_key)
      const raw = `${order_id}${status_code}${gross_amount}${serverKey}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-512", encoder.encode(raw));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const expectedSig = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (expectedSig !== signature_key) {
        console.error("Signature mismatch");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Determine payment status
    let newStatus = "pending";
    if (
      transaction_status === "capture" ||
      transaction_status === "settlement"
    ) {
      if (fraud_status === "accept" || !fraud_status) {
        newStatus = "paid";
      } else {
        newStatus = "fraud";
      }
    } else if (
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "expire"
    ) {
      newStatus = "failed";
    } else if (transaction_status === "pending") {
      newStatus = "pending";
    } else if (transaction_status === "refund") {
      newStatus = "refunded";
    }

    // Update payment record
    const updateData: Record<string, any> = {
      status: newStatus,
      midtrans_transaction_id: transaction_id || null,
      payment_method: payment_type || "",
      updated_at: new Date().toISOString(),
    };

    if (newStatus === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: paymentData, error: updateErr } = await adminClient
      .from("payments")
      .update(updateData)
      .eq("midtrans_order_id", order_id)
      .select("campaign_id, user_id")
      .single();

    if (updateErr) {
      console.error("Update payment error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update payment" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If paid, upgrade campaign to premium and cleanup other pending orders
    if (newStatus === "paid" && paymentData?.campaign_id) {
      const { error: upgradeErr } = await adminClient
        .from("campaigns")
        .update({ tier: "premium", updated_at: new Date().toISOString() })
        .eq("id", paymentData.campaign_id);

      if (upgradeErr) {
        console.error("Upgrade campaign error:", upgradeErr);
      } else {
        console.log("Campaign upgraded to premium:", paymentData.campaign_id);
      }

      // Delete other pending/failed payment records for this campaign (keep only the paid one)
      const { error: cleanupErr } = await adminClient
        .from("payments")
        .delete()
        .eq("campaign_id", paymentData.campaign_id)
        .neq("midtrans_order_id", order_id)
        .in("status", ["pending", "failed"]);

      if (cleanupErr) {
        console.error("Cleanup pending orders error:", cleanupErr);
      } else {
        console.log("Cleaned up duplicate pending orders for campaign:", paymentData.campaign_id);
      }

      // Send invoice email (fire-and-forget)
      try {
        const appUrl = Deno.env.get("APP_URL") || "https://twibbo-creator-hub.lovable.app";
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ order_id, app_url: appUrl }),
        });
        console.log("Invoice email triggered for:", order_id);
      } catch (emailErr) {
        console.error("Invoice email trigger failed:", emailErr);
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("midtrans-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
