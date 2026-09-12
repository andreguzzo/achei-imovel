import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { adminId, supabaseAdmin } = await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId : "";
    const suspend = body.suspend === true;

    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Usuário inválido" }, 400);
    if (userId === adminId) return json({ error: "Não é possível suspender a própria conta" }, 400);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: suspend ? "876000h" : "none",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("profiles")
      .update({ suspended_at: suspend ? new Date().toISOString() : null })
      .eq("user_id", userId);

    return json({ success: true, suspended: suspend });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
