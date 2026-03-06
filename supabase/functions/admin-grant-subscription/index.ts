import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_PRICES: Record<string, string> = {
  basic: "price_1T6wzyRZflpUnPI8eHlq6pUi",
  pro: "price_1T6x0FRZflpUnPI81C5BzNFT",
  premium: "price_1T6x0VRZflpUnPI816Ekf7tf",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Authentication failed");

    const userId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Not authorized");

    const { email, tier, months } = await req.json();
    if (!email || !tier || !months) throw new Error("Missing parameters");

    const priceId = TIER_PRICES[tier];
    if (!priceId) throw new Error("Invalid tier");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    let customerId: string;
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    // Cancel existing active subscriptions
    const existingSubs = await stripe.subscriptions.list({ customer: customerId, status: "active" });
    for (const sub of existingSubs.data) {
      await stripe.subscriptions.cancel(sub.id);
    }

    // Create free subscription with trial
    const trialEnd = Math.floor(Date.now() / 1000) + (months * 30 * 24 * 60 * 60);
    await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      payment_settings: { save_default_payment_method: "on_subscription" },
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
