import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabaseAdmin } = await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const roles: string[] = Array.isArray(body.roles) ? body.roles : [];

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (password.length < 8) return json({ error: "A senha deve ter ao menos 8 caracteres" }, 400);
    if (fullName.length < 2 || fullName.length > 120) return json({ error: "Nome inválido" }, 400);

    const allowed = ["admin", "moderator", "broker", "user"];
    const cleanRoles = roles.filter((r) => allowed.includes(r));

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(error.message);

    const newId = data.user!.id;

    if (cleanRoles.length > 0) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(cleanRoles.map((role) => ({ user_id: newId, role })), { onConflict: "user_id,role" });
    }

    return json({ success: true, user_id: newId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
