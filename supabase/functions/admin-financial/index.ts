import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";
import { resolvePlanSlug, findUserIdByEmail } from "../_shared/billing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabaseAdmin } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "list";

    if (action === "sync") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return json({ error: "Stripe não configurado" }, 400);
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      let imported = 0;
      const invoices = await stripe.invoices.list({ limit: 100 });
      for (const invoice of invoices.data) {
        const line = invoice.lines?.data?.[0];
        const price = (line as unknown as { price?: { id?: string; product?: string } })?.price;
        const slug = await resolvePlanSlug(supabaseAdmin, {
          priceId: price?.id ?? null,
          productId: price?.product ?? null,
        });
        const email = invoice.customer_email ?? null;
        const userId = await findUserIdByEmail(supabaseAdmin, email);
        const status = invoice.status === "paid"
          ? "paid"
          : invoice.status === "open"
            ? "pending"
            : invoice.status === "void" || invoice.status === "uncollectible"
              ? "failed"
              : (invoice.status ?? "pending");

        const { error } = await supabaseAdmin.from("billing_transactions").upsert({
          user_id: userId,
          email: email ?? "",
          stripe_customer_id: (invoice.customer as string) ?? null,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id:
            (invoice as unknown as { payment_intent?: string | null }).payment_intent ?? null,
          stripe_subscription_id:
            (invoice as unknown as { subscription?: string | null }).subscription ?? null,
          plan_slug: slug,
          amount_cents: invoice.amount_paid || invoice.amount_due || 0,
          currency: invoice.currency ?? "brl",
          status,
          description: line?.description ?? invoice.description ?? null,
          receipt_url: invoice.hosted_invoice_url ?? null,
          livemode: !!invoice.livemode,
          period_start: line?.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
          period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
          occurred_at: new Date((invoice.created ?? 0) * 1000).toISOString(),
        }, { onConflict: "stripe_invoice_id" });
        if (!error) imported++;
      }

      // Refresh subscription snapshots too.
      const subs = await stripe.subscriptions.list({ limit: 100, status: "all" });
      for (const sub of subs.data) {
        const item = sub.items.data[0];
        const slug = await resolvePlanSlug(supabaseAdmin, {
          priceId: item?.price?.id ?? null,
          productId: (item?.price?.product as string | null) ?? null,
        });
        let email: string | null = null;
        try {
          const c = await stripe.customers.retrieve(sub.customer as string);
          email = (c as Stripe.Customer).email ?? null;
        } catch { /* ignore */ }
        const userId = await findUserIdByEmail(supabaseAdmin, email);
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
          ?? item?.current_period_end ?? null;
        await supabaseAdmin.from("billing_subscriptions").upsert({
          user_id: userId,
          email: email ?? "",
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          plan_slug: slug,
          status: sub.status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
        }, { onConflict: "stripe_subscription_id" });
      }

      return json({ success: true, imported, subscriptions: subs.data.length });
    }

    // ---- list + summary ----
    const { data: txRows } = await supabaseAdmin
      .from("billing_transactions")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(1000);
    const transactions = txRows ?? [];

    const { data: subRows } = await supabaseAdmin
      .from("billing_subscriptions")
      .select("plan_slug, status, current_period_end, cancel_at_period_end, email");
    const subscriptions = subRows ?? [];

    const { data: plans } = await supabaseAdmin
      .from("subscription_plans")
      .select("slug, name, price_cents");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const paid = transactions.filter((t) => t.status === "paid");
    const monthPaid = paid.filter((t) => t.occurred_at >= monthStart);
    const priceBySlug = new Map((plans ?? []).map((p) => [p.slug, p.price_cents as number]));
    const activeSubs = subscriptions.filter((s) => ["active", "trialing", "past_due"].includes(s.status));

    const byPlan: Record<string, number> = {};
    for (const s of activeSubs) byPlan[s.plan_slug ?? "—"] = (byPlan[s.plan_slug ?? "—"] ?? 0) + 1;

    const summary = {
      revenue_month_cents: monthPaid.reduce((a, t) => a + (t.amount_cents ?? 0), 0),
      revenue_total_cents: paid.reduce((a, t) => a + (t.amount_cents ?? 0), 0),
      mrr_cents: activeSubs.reduce((a, s) => a + (priceBySlug.get(s.plan_slug ?? "") ?? 0), 0),
      active_subscribers: activeSubs.length,
      pending: transactions.filter((t) => t.status === "pending").length,
      failed: transactions.filter((t) => t.status === "failed").length,
      refunded: transactions.filter((t) => t.status === "refunded" || t.status === "partially_refunded").length,
      by_plan: byPlan,
      livemode: transactions.some((t) => t.livemode),
    };

    return json({ transactions, subscriptions, plans: plans ?? [], summary });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
