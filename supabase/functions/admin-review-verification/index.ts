import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { adminId, supabaseAdmin } = await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : "";
    const approve = body.approve === true;
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

    if (!id) return json({ error: "Verificação não informada" }, 400);
    if (!approve && reason.trim().length < 3) return json({ error: "Informe o motivo da recusa" }, 400);

    const { data: record, error } = await supabaseAdmin
      .from("identity_verifications")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !record) return json({ error: "Verificação não encontrada" }, 404);

    const status = approve ? "approved" : "rejected";

    const { error: updateError } = await supabaseAdmin
      .from("identity_verifications")
      .update({
        status,
        reason: reason || (approve ? "Aprovado manualmente pelo administrador." : "Recusado pelo administrador."),
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) throw new Error(updateError.message);

    const profileUpdate: Record<string, unknown> = { verification_status: status };
    if (approve) {
      profileUpdate.verified_at = new Date().toISOString();
      if (record.claimed_creci) profileUpdate.creci = record.claimed_creci;
      profileUpdate.account_type = record.kind === "agency" ? "agency" : "broker";
    } else {
      profileUpdate.verified_at = null;
    }
    await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", record.user_id);

    await supabaseAdmin.from("subscription_audit_log").insert({
      target_user_id: record.user_id,
      admin_id: adminId,
      action: approve ? "verification_approved" : "verification_rejected",
      after_state: { verification_id: id, status, reason },
    });

    return json({ success: true, status });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
