import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Payment notifications from the broker's own billing account (Asaas / Mercado Pago).
 * Public endpoint identified by the broker's webhook token in the URL:
 *   POST /functions/v1/rental-webhook?token=<webhook_token>
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, asaas-access-token, x-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token || token.length < 16) return json({ error: "invalid token" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: settings } = await admin
      .from("rental_payment_settings")
      .select("broker_id, provider, api_key, environment")
      .eq("webhook_token", token)
      .maybeSingle<{ broker_id: string; provider: string; api_key: string | null; environment: string }>();

    if (!settings) return json({ error: "invalid token" }, 401);

    const payload = await req.json().catch(() => null);
    if (!payload) return json({ error: "invalid body" }, 400);

    let providerChargeId: string | null = null;
    let paid = false;
    let paidAmount: number | null = null;
    let paidAt: string | null = null;

    if (settings.provider === "asaas") {
      const event = String(payload.event ?? "");
      providerChargeId = payload?.payment?.id ?? null;
      paid = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event);
      paidAmount = Number(payload?.payment?.value ?? 0) || null;
      paidAt = payload?.payment?.paymentDate ?? payload?.payment?.confirmedDate ?? null;
    } else if (settings.provider === "mercadopago") {
      const id = payload?.data?.id ?? payload?.id;
      if (!id || !settings.api_key) return json({ ok: true, ignored: true });
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { Authorization: `Bearer ${settings.api_key}` },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`mercadopago lookup failed [${res.status}]: ${text}`);
        return json({ error: "provider lookup failed", status: res.status, details: text }, res.status);
      }
      const payment = JSON.parse(text);
      providerChargeId = String(payment.id);
      paid = payment.status === "approved";
      paidAmount = Number(payment.transaction_amount ?? 0) || null;
      paidAt = payment.date_approved ?? null;
    } else {
      return json({ ok: true, ignored: true });
    }

    if (!paid || !providerChargeId) return json({ ok: true, ignored: true });

    const { data: charge } = await admin
      .from("rental_charges")
      .select("id, total_amount, status")
      .eq("broker_id", settings.broker_id)
      .eq("provider_charge_id", providerChargeId)
      .maybeSingle();

    if (!charge) return json({ ok: true, ignored: true });
    if (charge.status === "paid") return json({ ok: true, alreadyPaid: true });

    const { error } = await admin
      .from("rental_charges")
      .update({
        status: "paid",
        paid_amount: paidAmount ?? Number(charge.total_amount),
        paid_at: (paidAt ?? new Date().toISOString()).slice(0, 10),
      })
      .eq("id", charge.id);

    if (error) {
      console.error("failed to settle charge:", error.message);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true, settled: charge.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("rental-webhook failed:", message);
    return json({ error: message }, 500);
  }
});
