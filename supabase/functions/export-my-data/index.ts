import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Tables exported for the requesting user, with the column that identifies them. */
const OWNED_TABLES: Array<[string, string]> = [
  ["profiles", "user_id"],
  ["properties", "user_id"],
  ["property_documents", "user_id"],
  ["broker_photos", "user_id"],
  ["favorites", "user_id"],
  ["saved_searches", "user_id"],
  ["contact_requests", "broker_id"],
  ["sales_pipeline", "broker_id"],
  ["pipeline_activities", "broker_id"],
  ["broker_appointments", "broker_id"],
  ["buyer_leads", "broker_id"],
  ["rental_contracts", "broker_id"],
  ["rental_charges", "broker_id"],
  ["rental_inspections", "broker_id"],
  ["rental_documents", "broker_id"],
  ["owner_reports", "broker_id"],
  ["identity_verifications", "user_id"],
  ["support_messages", "user_id"],
  ["consent_log", "user_id"],
  ["deletion_requests", "user_id"],
  ["billing_subscriptions", "user_id"],
  ["billing_transactions", "user_id"],
  ["user_roles", "user_id"],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: {
        id: userId,
        email: authUser?.user?.email ?? null,
        created_at: authUser?.user?.created_at ?? null,
        last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
        providers: authUser?.user?.app_metadata?.providers ?? null,
      },
    };

    for (const [table, column] of OWNED_TABLES) {
      const { data, error } = await supabase.from(table).select("*").eq(column, userId).limit(5000);
      if (error) {
        console.error(`export error on ${table}`, error.message);
        payload[table] = { error: error.message };
      } else {
        payload[table] = data ?? [];
      }
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-my-data error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
