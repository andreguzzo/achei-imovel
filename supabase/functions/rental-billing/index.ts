import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const asaasBase = (env: string) =>
  env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

interface Settings {
  provider: string;
  api_key: string | null;
  environment: string;
  auto_charge_enabled: boolean;
  webhook_token: string;
}

/* ── Asaas ── */
const asaasFetch = async (env: string, key: string, path: string, init?: RequestInit) => {
  const res = await fetch(`${asaasBase(env)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: key, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return text ? JSON.parse(text) : {};
};

const asaasCustomer = async (env: string, key: string, tenant: {
  name: string; email: string | null; phone: string | null; cpf: string | null;
}) => {
  if (tenant.cpf) {
    const found = await asaasFetch(env, key, `/customers?cpfCnpj=${encodeURIComponent(tenant.cpf)}`);
    if (found?.data?.[0]?.id) return found.data[0].id as string;
  }
  const created = await asaasFetch(env, key, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: tenant.name,
      email: tenant.email || undefined,
      mobilePhone: tenant.phone?.replace(/\D/g, "") || undefined,
      cpfCnpj: tenant.cpf?.replace(/\D/g, "") || undefined,
    }),
  });
  return created.id as string;
};

/* ── Mercado Pago ── */
const mpFetch = async (key: string, path: string, init?: RequestInit) => {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return text ? JSON.parse(text) : {};
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Não autorizado" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "test" && action !== "charge") {
      return json({ error: "action deve ser 'test' ou 'charge'" }, 400);
    }

    const { data: settings } = await admin
      .from("rental_payment_settings")
      .select("provider, api_key, environment, auto_charge_enabled, webhook_token")
      .eq("broker_id", userId)
      .maybeSingle<Settings>();

    if (!settings?.api_key || settings.provider === "manual") {
      return json({ error: "Conecte a conta de cobrança antes de emitir." }, 400);
    }

    /* ── Test the connection ── */
    if (action === "test") {
      let accountName = "";
      if (settings.provider === "asaas") {
        const me = await asaasFetch(settings.environment, settings.api_key, "/myAccount/commercialInfo");
        accountName = me?.name || me?.companyName || "Asaas";
      } else if (settings.provider === "mercadopago") {
        const me = await mpFetch(settings.api_key, "/users/me");
        accountName = me?.nickname || me?.email || "Mercado Pago";
      } else {
        return json({ error: "Provedor não suportado" }, 400);
      }
      await admin
        .from("rental_payment_settings")
        .update({ provider_account_id: accountName, provider_connected_at: new Date().toISOString() })
        .eq("broker_id", userId);
      return json({ ok: true, account: accountName, webhook_token: settings.webhook_token });
    }

    /* ── Issue a charge ── */
    const chargeId = body?.chargeId;
    if (typeof chargeId !== "string" || chargeId.length < 10) {
      return json({ error: "chargeId é obrigatório" }, 400);
    }

    const { data: charge } = await admin
      .from("rental_charges")
      .select("id, broker_id, total_amount, due_date, competence, provider_charge_id, contract_id, rental_contracts(tenant_name, tenant_email, tenant_phone, tenant_cpf, property_label)")
      .eq("id", chargeId)
      .eq("broker_id", userId)
      .maybeSingle();

    if (!charge) return json({ error: "Cobrança não encontrada" }, 404);
    if (charge.provider_charge_id) return json({ error: "Cobrança já emitida" }, 400);

    const contract = charge.rental_contracts as {
      tenant_name: string; tenant_email: string | null; tenant_phone: string | null;
      tenant_cpf: string | null; property_label: string | null;
    } | null;

    const description = `Aluguel ${charge.competence?.slice(0, 7)}${contract?.property_label ? ` - ${contract.property_label}` : ""}`;
    const amount = Number(charge.total_amount);

    let update: Record<string, unknown> = {};

    if (settings.provider === "asaas") {
      const customerId = await asaasCustomer(settings.environment, settings.api_key, {
        name: contract?.tenant_name ?? "Inquilino",
        email: contract?.tenant_email ?? null,
        phone: contract?.tenant_phone ?? null,
        cpf: contract?.tenant_cpf ?? null,
      });
      const payment = await asaasFetch(settings.environment, settings.api_key, "/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: amount,
          dueDate: charge.due_date,
          description,
          externalReference: charge.id,
        }),
      });
      let pix: string | null = null;
      try {
        const qr = await asaasFetch(settings.environment, settings.api_key, `/payments/${payment.id}/pixQrCode`);
        pix = qr?.payload ?? null;
      } catch (_) {
        pix = null;
      }
      update = {
        provider_charge_id: payment.id,
        payment_link: payment.invoiceUrl ?? null,
        boleto_url: payment.bankSlipUrl ?? null,
        pix_payload: pix,
      };
    } else if (settings.provider === "mercadopago") {
      const payment = await mpFetch(settings.api_key, "/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": charge.id },
        body: JSON.stringify({
          transaction_amount: amount,
          description,
          payment_method_id: "pix",
          date_of_expiration: `${charge.due_date}T23:59:59.000-03:00`,
          external_reference: charge.id,
          payer: {
            email: contract?.tenant_email || `inquilino+${charge.id.slice(0, 8)}@example.com`,
            first_name: contract?.tenant_name?.split(" ")[0],
          },
        }),
      });
      update = {
        provider_charge_id: String(payment.id),
        pix_payload: payment?.point_of_interaction?.transaction_data?.qr_code ?? null,
        payment_link: payment?.point_of_interaction?.transaction_data?.ticket_url ?? null,
      };
    } else {
      return json({ error: "Provedor não suportado" }, 400);
    }

    const { error: updateError } = await admin.from("rental_charges").update(update).eq("id", charge.id);
    if (updateError) return json({ error: updateError.message }, 500);

    return json({ ok: true, ...update });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("rental-billing failed:", message);
    return json({ error: message }, 500);
  }
});
