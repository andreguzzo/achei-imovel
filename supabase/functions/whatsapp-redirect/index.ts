import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ANONYMOUS_SENDER_ID = "00000000-0000-0000-0000-000000000000";
const MAX_CLICKS_PER_HOUR = 5;

/**
 * Mirrors src/lib/phone.ts: the country code is decided by digit count only,
 * never by startsWith("55") — 55 is also the DDD of Rio Grande do Sul.
 */
const normalizeBrPhone = (input: string | null | undefined): string | null => {
  const digits = (input ?? "").replace(/\D/g, "").replace(/^0+/, "");

  const national = (value: string): string | null => {
    if (value.length !== 10 && value.length !== 11) return null;
    const ddd = Number(value.slice(0, 2));
    if (ddd < 11 || ddd > 99) return null;
    const subscriber = value.slice(2);
    if (value.length === 11 && !/^9/.test(subscriber)) return null;
    if (value.length === 10 && /^[6-9]/.test(subscriber)) return `55${value.slice(0, 2)}9${subscriber}`;
    return `55${value}`;
  };

  if (digits.length === 12 || digits.length === 13) {
    if (digits.slice(0, 2) !== "55") return null;
    return national(digits.slice(2));
  }
  if (digits.length === 10 || digits.length === 11) return national(digits);
  return null;
};

/** Landlines (DDD + 8 digits starting with 2-5) cannot receive WhatsApp. */
const isWhatsAppCapable = (normalized: string) => {
  const national = normalized.slice(2);
  return !(national.length === 10 && /^[2-5]/.test(national.slice(2)));
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const isUuid = (v: string | null) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const siteOrigin = (req: Request) => {
  const referer = req.headers.get("Referer") || req.headers.get("Origin");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore malformed referer
    }
  }
  return Deno.env.get("SITE_URL") ?? "https://abitzo.com.br";
};

const clientIp = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
  req.headers.get("cf-connecting-ip") ||
  "unknown";

const fail = (message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("property_id");
    const brokerParam = url.searchParams.get("broker_id");

    if (!isUuid(propertyId)) return fail("property_id inválido");
    if (brokerParam && !isUuid(brokerParam)) return fail("broker_id inválido");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: property } = await supabase
      .from("properties")
      .select("id, user_id, title, price, reference_code, status")
      .eq("id", propertyId)
      .maybeSingle();

    if (!property) return fail("Imóvel não encontrado");

    // The broker may be a partner sharing the consolidated listing.
    let brokerId = property.user_id as string;
    if (brokerParam && brokerParam !== property.user_id) {
      const { data: member } = await supabase
        .from("property_group_members")
        .select("broker_id, status, group_id")
        .eq("broker_id", brokerParam)
        .eq("status", "approved")
        .limit(50);
      const { data: ownGroups } = await supabase
        .from("property_group_members")
        .select("group_id")
        .eq("property_id", propertyId);
      const groupIds = new Set((ownGroups ?? []).map((g) => g.group_id));
      if ((member ?? []).some((m) => groupIds.has(m.group_id))) brokerId = brokerParam;
    }

    const { data: contact } = await supabase
      .from("profiles")
      .select("whatsapp, phone, full_name")
      .eq("user_id", brokerId)
      .maybeSingle();

    const normalized = normalizeBrPhone(contact?.whatsapp || contact?.phone);
    if (!normalized || !isWhatsAppCapable(normalized)) {
      return fail("Este corretor não tem WhatsApp disponível");
    }

    // Rate limit: 5 clicks per IP per property per hour, so reloads and bots
    // do not inflate the lead count.
    const ip = clientIp(req);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("whatsapp_click_log")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("ip", ip)
      .gte("created_at", since);

    if ((count ?? 0) < MAX_CLICKS_PER_HOUR) {
      await supabase.from("whatsapp_click_log").insert({ property_id: propertyId, ip });
      await supabase.from("contact_requests").insert({
        property_id: propertyId,
        sender_id: ANONYMOUS_SENDER_ID,
        broker_id: brokerId,
        name: "Contato via WhatsApp",
        email: "whatsapp@abitzo.lead",
        request_type: "whatsapp",
        status: "new",
        message: "Clique no botão de WhatsApp do anúncio. A conversa começou direto no celular do corretor.",
      });
    }

    const reference = property.reference_code ? `${property.reference_code} — ` : "";
    const price = property.price ? `, ${brl(Number(property.price))}` : "";
    const listingUrl = `${siteOrigin(req)}/imovel/${property.id}`;
    const message = `Olá! Tenho interesse no imóvel ${reference}${property.title}${price}. Vi na Abitzo: ${listingUrl}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("whatsapp-redirect error", e);
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
