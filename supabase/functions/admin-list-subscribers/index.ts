import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });

    const subscribers: {
      email: string;
      product_id: string | null;
      subscription_end: string;
      subscription_start: string;
    }[] = [];

    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { status: "active", limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;

      const subs = await stripe.subscriptions.list(params);

      for (const sub of subs.data) {
        const customer = sub.customer as any;
        subscribers.push({
          email: customer?.email || "—",
          product_id: sub.items.data[0]?.price?.product as string || null,
          subscription_end: new Date(sub.current_period_end * 1000).toISOString(),
          subscription_start: new Date(sub.start_date * 1000).toISOString(),
        });
      }

      hasMore = subs.has_more;
      if (subs.data.length > 0) {
        startingAfter = subs.data[subs.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    subscribers.sort((a, b) => new Date(b.subscription_start).getTime() - new Date(a.subscription_start).getTime());

    return new Response(JSON.stringify({ subscribers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
