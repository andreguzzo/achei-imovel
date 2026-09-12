import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";

type Body = {
  email?: string;
  userId?: string;
  action?: "set_plan" | "set_expiry" | "cancel";
  planSlug?: string;
  expiresAt?: string | null;
  notes?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { adminId, supabaseAdmin } = await requireAdmin(req);
    const body: Body = await req.json().catch(() => ({}));

    const action = body.action;
    if (!action || !["set_plan", "set_expiry", "cancel"].includes(action)) {
      return json({ error: "Ação inválida" }, 400);
    }

    // Resolve the target user (by id or email)
    let userId = typeof body.userId === "string" ? body.userId : "";
    let email = typeof body.email === "string" ? body.email.trim() : "";

    if (userId) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (error || !data?.user) return json({ error: "Usuário não encontrado" }, 400);
      email = data.user.email ?? email;
    } else if (email) {
      let page = 1;
      let found: { id: string; email?: string } | null = null;
      while (page <= 20 && !found) {
        const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        const batch = data?.users ?? [];
        found = batch.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
        if (batch.length < 200) break;
        page++;
      }
      if (!found) return json({ error: "Usuário não encontrado para este e-mail" }, 400);
      userId = found.id;
    } else {
      return json({ error: "Informe o usuário" }, 400);
    }

    const { data: beforeOverride } = await supabaseAdmin
      .from("subscription_overrides")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

    let stripeSubId: string | null = null;
    let customerId: string | null = null;
    if (stripe && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subs.data.length > 0) stripeSubId = subs.data[0].id;
      }
    }

    let afterState: Record<string, unknown> = {};

    if (action === "cancel") {
      if (stripe && stripeSubId) await stripe.subscriptions.cancel(stripeSubId);
      if (beforeOverride) {
        await supabaseAdmin
          .from("subscription_overrides")
          .update({ cancelled_at: new Date().toISOString(), expires_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
      afterState = { cancelled: true };
    }

    if (action === "set_plan") {
      const planSlug = typeof body.planSlug === "string" ? body.planSlug : "";
      const { data: plan } = await supabaseAdmin
        .from("subscription_plans")
        .select("*")
        .eq("slug", planSlug)
        .maybeSingle();
      if (!plan) return json({ error: "Plano não encontrado" }, 400);

      const expiresAt = body.expiresAt
        ? new Date(body.expiresAt).toISOString()
        : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      if (stripe && stripeSubId && plan.stripe_price_id) {
        const sub = await stripe.subscriptions.retrieve(stripeSubId);
        await stripe.subscriptions.update(stripeSubId, {
          items: [{ id: sub.items.data[0].id, price: plan.stripe_price_id }],
          proration_behavior: "none",
        });
        afterState = { plan_slug: plan.slug, via: "stripe" };
      } else {
        await supabaseAdmin.from("subscription_overrides").upsert(
          {
            user_id: userId,
            plan_slug: plan.slug,
            starts_at: new Date().toISOString(),
            expires_at: expiresAt,
            source: "manual",
            cancelled_at: null,
            notes: body.notes ?? null,
            created_by: adminId,
          },
          { onConflict: "user_id" },
        );
        afterState = { plan_slug: plan.slug, expires_at: expiresAt, via: "override" };
      }
    }

    if (action === "set_expiry") {
      const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime())) return json({ error: "Data inválida" }, 400);

      if (stripe && stripeSubId) {
        await stripe.subscriptions.update(stripeSubId, {
          cancel_at: Math.floor(expiresAt.getTime() / 1000),
        });
        afterState = { expires_at: expiresAt.toISOString(), via: "stripe" };
      } else if (beforeOverride) {
        await supabaseAdmin
          .from("subscription_overrides")
          .update({ expires_at: expiresAt.toISOString(), cancelled_at: null })
          .eq("user_id", userId);
        afterState = { expires_at: expiresAt.toISOString(), via: "override" };
      } else {
        return json({ error: "Nenhuma assinatura para ajustar" }, 400);
      }
    }

    await supabaseAdmin.from("subscription_audit_log").insert({
      target_user_id: userId,
      target_email: email || null,
      admin_id: adminId,
      action,
      before_state: beforeOverride ?? { stripe_subscription: stripeSubId },
      after_state: afterState,
    });

    return json({ success: true, ...afterState });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
