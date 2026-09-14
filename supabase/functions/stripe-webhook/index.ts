import Stripe from "https://esm.sh/stripe@18.5.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  serviceClient,
  resolvePlanSlug,
  findUserIdByEmail,
  applyPlanToProfile,
} from "../_shared/billing.ts";

const log = (step: string, details?: unknown) =>
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) return new Response("STRIPE_SECRET_KEY not set", { status: 500 });

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
    if (!signature) throw new Error("Missing stripe-signature header");
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (err) {
    log("Signature verification failed", { message: err instanceof Error ? err.message : String(err) });
    return new Response("Invalid signature", { status: 400 });
  }

  const db = serviceClient();
  log("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscription(stripe, db, sub, {
          email: session.customer_details?.email ?? session.customer_email ?? null,
          userId: (session.client_reference_id as string | null) ?? null,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(stripe, db, sub, {});
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoice(stripe, db, invoice, event.type === "invoice.paid" ? "paid" : "failed");
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        await db
          .from("billing_transactions")
          .update({
            status: charge.amount_refunded >= charge.amount ? "refunded" : "partially_refunded",
          })
          .eq("stripe_charge_id", charge.id);
        break;
      }
      default:
        log("Unhandled event ignored", { type: event.type });
    }
  } catch (err) {
    log("ERROR handling event", { message: err instanceof Error ? err.message : String(err) });
    // 500 so Stripe retries the delivery instead of silently dropping the payment.
    return new Response(JSON.stringify({ received: true, handled: false }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

async function customerEmail(stripe: Stripe, customerId: string | null): Promise<string | null> {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ((customer as Stripe.DeletedCustomer).deleted) return null;
    return (customer as Stripe.Customer).email ?? null;
  } catch {
    return null;
  }
}

async function syncSubscription(
  stripe: Stripe,
  db: SupabaseClient,
  sub: Stripe.Subscription,
  hint: { email?: string | null; userId?: string | null },
) {
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const productId = (item?.price?.product as string | null) ?? null;
  const slug = await resolvePlanSlug(db, { priceId, productId });

  const email = hint.email ?? (await customerEmail(stripe, sub.customer as string));
  const userId = hint.userId ?? (await findUserIdByEmail(db, email));
  const active = ACTIVE_STATUSES.includes(sub.status);

  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? item?.current_period_end ?? null;

  await db.from("billing_subscriptions").upsert({
    user_id: userId,
    email: email ?? "",
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    plan_slug: slug,
    status: sub.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
  }, { onConflict: "stripe_subscription_id" });

  await applyPlanToProfile(db, userId, slug, active);
  log("Subscription synced", { id: sub.id, slug, status: sub.status, userId });
}

async function recordInvoice(
  stripe: Stripe,
  db: SupabaseClient,
  invoice: Stripe.Invoice,
  status: "paid" | "failed",
) {
  const line = invoice.lines?.data?.[0];
  const priceId = (line as unknown as { price?: { id?: string; product?: string } })?.price?.id ?? null;
  const productId = (line as unknown as { price?: { product?: string } })?.price?.product ?? null;
  const slug = await resolvePlanSlug(db, { priceId, productId });

  const email = invoice.customer_email ?? (await customerEmail(stripe, invoice.customer as string));
  const userId = await findUserIdByEmail(db, email);

  let chargeId: string | null = null;
  let receiptUrl: string | null = invoice.hosted_invoice_url ?? null;
  let paymentMethod: string | null = null;
  const paymentIntentId =
    (invoice as unknown as { payment_intent?: string | null }).payment_intent ?? null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
      const charge = pi.latest_charge as Stripe.Charge | null;
      if (charge) {
        chargeId = charge.id;
        receiptUrl = charge.receipt_url ?? receiptUrl;
        paymentMethod = charge.payment_method_details?.type ?? null;
      }
    } catch { /* keep invoice-level data */ }
  }

  await db.from("billing_transactions").upsert({
    user_id: userId,
    email: email ?? "",
    stripe_customer_id: (invoice.customer as string) ?? null,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: chargeId,
    stripe_subscription_id:
      (invoice as unknown as { subscription?: string | null }).subscription ?? null,
    plan_slug: slug,
    amount_cents: status === "paid" ? (invoice.amount_paid ?? 0) : (invoice.amount_due ?? 0),
    currency: invoice.currency ?? "brl",
    status,
    description: line?.description ?? invoice.description ?? null,
    payment_method: paymentMethod,
    receipt_url: receiptUrl,
    livemode: !!invoice.livemode,
    period_start: line?.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
    period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
    occurred_at: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  }, { onConflict: "stripe_invoice_id" });

  if (status === "paid" && slug) {
    await applyPlanToProfile(db, userId, slug, true);
  }
  log("Invoice recorded", { id: invoice.id, status, slug, userId });
}
