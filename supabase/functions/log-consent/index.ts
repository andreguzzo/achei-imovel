import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_TYPES = new Set(["signup_terms", "signup_privacy", "contact_form"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const consents = Array.isArray(body?.consents) ? body.consents : [];

    const valid = consents.filter(
      (c: { consent_type?: string; document_version?: string }) =>
        typeof c?.consent_type === "string" &&
        ALLOWED_TYPES.has(c.consent_type) &&
        typeof c?.document_version === "string" &&
        c.document_version.length > 0 &&
        c.document_version.length <= 40,
    );

    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: "consents inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Resolve the user when a session is available (consent at signup has none yet)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const { data: claimsData } = await anonClient.auth.getClaims(token);
      if (claimsData?.claims?.sub) userId = claimsData.claims.sub as string;
    }

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
    const userAgent = (typeof body?.user_agent === "string" ? body.user_agent : req.headers.get("user-agent")) ?? null;
    const visitorId = typeof body?.visitor_id === "string" ? body.visitor_id.slice(0, 100) : null;
    const context = typeof body?.context === "object" && body.context !== null ? body.context : {};

    const rows = valid.map((c: { consent_type: string; document_version: string }) => ({
      user_id: userId,
      visitor_id: visitorId,
      consent_type: c.consent_type,
      document_version: c.document_version,
      ip,
      user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      context,
    }));

    const { error } = await supabase.from("consent_log").insert(rows);
    if (error) {
      console.error("consent insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, recorded: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-consent error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
