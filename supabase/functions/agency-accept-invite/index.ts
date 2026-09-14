import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: claims, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) return json({ error: "Falha na autenticação" }, 401);
    const userId = claims.claims.sub as string;
    const userEmail = String(claims.claims.email ?? "").toLowerCase();

    const body = await req.json().catch(() => ({}));
    const inviteToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!inviteToken) return json({ error: "Convite inválido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: invite } = await admin
      .from("agency_invites")
      .select("*")
      .eq("token", inviteToken)
      .maybeSingle();

    if (!invite) return json({ error: "Convite não encontrado" }, 404);
    if (invite.status !== "pending") return json({ error: "Este convite já foi utilizado" }, 400);
    if (new Date(invite.expires_at).getTime() < Date.now()) return json({ error: "Convite expirado" }, 400);
    if (userEmail && invite.email.toLowerCase() !== userEmail) {
      return json({ error: "Este convite é para outro e-mail" }, 403);
    }

    const { error: memberError } = await admin
      .from("agency_members")
      .upsert(
        {
          agency_id: invite.agency_id,
          user_id: userId,
          status: "active",
          permissions: invite.permissions ?? {},
        },
        { onConflict: "agency_id,user_id" },
      );
    if (memberError) throw new Error(memberError.message);

    await admin
      .from("agency_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    const { data: agency } = await admin.from("agencies").select("name").eq("id", invite.agency_id).maybeSingle();

    return json({ success: true, agency_name: agency?.name ?? null });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
