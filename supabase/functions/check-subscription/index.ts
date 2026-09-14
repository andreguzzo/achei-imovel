import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");

    // Create client with auth header for ES256 compatibility
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Authentication failed");

    const email = claimsData.claims.email as string;
    const authUserId = claimsData.claims.sub as string;
    if (!email) throw new Error("User email not found in token");
    logStep("User authenticated", { email });

    // Manual/admin-granted subscription stored in our own tables
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: planRows } = await serviceClient
      .from("subscription_plans")
      .select("slug, stripe_product_id, stripe_price_id");
    const plans = planRows ?? [];
    const slugForProduct = (productId: string | null) =>
      plans.find((p) => p.stripe_product_id && p.stripe_product_id === productId)?.slug ?? null;

    let override: { product_id: string | null; plan_slug: string; subscription_end: string } | null = null;
    const { data: ov } = await serviceClient
      .from("subscription_overrides")
      .select("plan_slug, expires_at, cancelled_at")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (ov && !ov.cancelled_at && (!ov.expires_at || new Date(ov.expires_at) > new Date())) {
      const plan = plans.find((p) => p.slug === ov.plan_slug);
      if (plan) {
        override = {
          product_id: plan.stripe_product_id ?? null,
          plan_slug: plan.slug,
          subscription_end: ov.expires_at ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        };
        logStep("Manual subscription found", override);
      }
    }

    // Local snapshot kept up to date by the Stripe webhook — used as a fallback.
    const { data: localSub } = await serviceClient
      .from("billing_subscriptions")
      .select("plan_slug, status, current_period_end, cancel_at_period_end")
      .eq("user_id", authUserId)
      .in("status", ["active", "trialing", "past_due"])
      .order("current_period_end", { ascending: false })
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let customers;
    try {
      customers = await stripe.customers.list({ email, limit: 1 });
    } catch (stripeErr) {
      logStep("Stripe unavailable, using local snapshot", {
        message: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
      });
      const fallback = localSub ?? override;
      return new Response(JSON.stringify({
        subscribed: !!fallback,
        product_id: override?.product_id ?? null,
        plan_slug: localSub?.plan_slug ?? override?.plan_slug ?? null,
        subscription_end: localSub?.current_period_end ?? override?.subscription_end ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      const fallback = localSub ?? override;
      return new Response(JSON.stringify({
        subscribed: !!fallback,
        product_id: override?.product_id ?? null,
        plan_slug: localSub?.plan_slug ?? override?.plan_slug ?? null,
        subscription_end: localSub?.current_period_end ?? override?.subscription_end ?? null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasStripeSub = subscriptions.data.length > 0;
    const hasActiveSub = hasStripeSub || !!override || !!localSub;
    let productId: string | null = override?.product_id ?? null;
    let subscriptionEnd: string | null =
      override?.subscription_end ?? localSub?.current_period_end ?? null;
    let planSlug: string | null = override?.plan_slug ?? localSub?.plan_slug ?? null;

    if (hasStripeSub) {
      const subscription = subscriptions.data[0];
      const item = subscription.items.data[0];
      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
        ?? (item as unknown as { current_period_end?: number })?.current_period_end ?? null;
      subscriptionEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : subscriptionEnd;
      productId = item.price.product as string;
      planSlug = slugForProduct(productId) ?? planSlug;
      logStep("Active subscription found", { productId, planSlug });
    }

    // Fetch recent invoices for payment history
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
    });

    const paymentHistory = invoices.data.map((inv) => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      date: new Date((inv.created ?? 0) * 1000).toISOString(),
      invoice_url: inv.hosted_invoice_url,
      description: inv.lines?.data?.[0]?.description ?? null,
    }));

    // Get upcoming invoice if subscribed
    let upcomingInvoice = null;
    if (hasActiveSub) {
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({ customer: customerId });
        upcomingInvoice = {
          amount: upcoming.amount_due / 100,
          currency: upcoming.currency,
          due_date: upcoming.next_payment_attempt
            ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
            : subscriptionEnd,
        };
        logStep("Upcoming invoice fetched", upcomingInvoice);
      } catch (_) {
        logStep("No upcoming invoice");
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      plan_slug: planSlug,
      subscription_end: subscriptionEnd,
      payment_history: paymentHistory,
      upcoming_invoice: upcomingInvoice,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
