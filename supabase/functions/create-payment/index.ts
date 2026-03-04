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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "";

    const { campaign_id, voucher_code } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify campaign exists and belongs to user
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, name, user_id, tier")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (campaign.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not your campaign" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (campaign.tier === "premium") {
      return new Response(
        JSON.stringify({ error: "Campaign is already premium" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Read Midtrans settings using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: settingsRows } = await adminClient
      .from("site_settings")
      .select("key, value")
      .in("key", ["midtrans_server_key", "midtrans_client_key", "midtrans_mode", "premium_price"]);

    const settingsMap: Record<string, string> = {};
    (settingsRows ?? []).forEach((r: any) => {
      settingsMap[r.key] = r.value;
    });

    const serverKey = settingsMap["midtrans_server_key"];
    const clientKey = settingsMap["midtrans_client_key"];
    const mode = settingsMap["midtrans_mode"] || "sandbox";
    const configuredPrice = Number(settingsMap["premium_price"]) || 50000;

    if (!serverKey || !clientKey) {
      return new Response(
        JSON.stringify({
          error: "Payment gateway not configured. Contact admin.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl =
      mode === "production"
        ? "https://app.midtrans.com"
        : "https://app.sandbox.midtrans.com";

    const orderId = `TWIBO-${campaign_id.substring(0, 8)}-${Date.now()}`;
    let amount = configuredPrice;
    let discountAmount = 0;
    let appliedVoucherCode: string | null = null;

    // Validate voucher if provided
    if (voucher_code) {
      const { data: voucher } = await adminClient
        .from("vouchers")
        .select("*")
        .eq("code", voucher_code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (voucher) {
        const v = voucher as any;
        const now = new Date();
        const valid = (!v.max_uses || v.used_count < v.max_uses) &&
          (!v.valid_until || new Date(v.valid_until) > now) &&
          (!v.valid_from || new Date(v.valid_from) <= now);

        if (valid) {
          if (v.discount_type === 'percentage') {
            discountAmount = Math.round(amount * v.discount_value / 100);
          } else {
            discountAmount = v.discount_value;
          }
          amount = Math.max(1, amount - discountAmount); // Midtrans min 1
          appliedVoucherCode = v.code;

          // Increment used_count
          await adminClient
            .from("vouchers")
            .update({ used_count: v.used_count + 1 })
            .eq("id", v.id);
        }
      }
    }

    // Delete old pending/failed payments for this campaign
    await adminClient
      .from("payments")
      .delete()
      .eq("campaign_id", campaign_id)
      .eq("user_id", userId)
      .in("status", ["pending", "failed"]);

    // Create payment record
    const { error: insertErr } = await adminClient.from("payments").insert({
      user_id: userId,
      campaign_id,
      amount,
      midtrans_order_id: orderId,
      status: "pending",
      voucher_code: appliedVoucherCode,
      discount_amount: discountAmount,
    });

    if (insertErr) {
      console.error("Insert payment error:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create payment record" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Snap transaction
    const snapRes = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(serverKey + ":")}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: orderId,
          gross_amount: amount,
        },
        customer_details: {
          email: userEmail,
        },
        item_details: [
          {
            id: "premium-upgrade",
            price: amount,
            quantity: 1,
            name: `Premium: ${(campaign.name || "Campaign").substring(0, 40)}`,
          },
        ],
      }),
    });

    const snapData = await snapRes.json();

    if (!snapRes.ok || !snapData.token) {
      console.error("Midtrans Snap error:", snapData);
      return new Response(
        JSON.stringify({ error: "Failed to create payment token" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        snap_token: snapData.token,
        redirect_url: snapData.redirect_url,
        order_id: orderId,
        client_key: clientKey,
        snap_url:
          mode === "production"
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-payment error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
