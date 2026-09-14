import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FUNCTION_NAME = "generate-social-caption";
const DAILY_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    // Require an authenticated user
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

    // Daily rate limit per user
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await serviceClient
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("function_name", FUNCTION_NAME)
      .gte("created_at", since);
    if (countError) console.error("rate limit count error:", countError);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: `Você atingiu o limite de ${DAILY_LIMIT} gerações de IA por dia. Tente novamente amanhã.` }, 429);
    }


    const body = await req.json();
    const {
      title, price, listingType, propertyType, city, state, neighborhood,
      bedrooms, bathrooms, parkingSpots, area, description, brokerName, phone, locale,
    } = body ?? {};

    if (!title || typeof title !== "string") return json({ error: "title é obrigatório" }, 400);

    const pt = locale !== "en";
    const typeLabels: Record<string, string> = { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Imóvel Comercial", farm: "Rural" };

    const details = [
      `Título: ${title}`,
      `Tipo: ${typeLabels[propertyType] || propertyType || "-"}`,
      `Modalidade: ${listingType === "rent" ? "Aluguel" : "Venda"}`,
      price ? `Preço: R$ ${Number(price).toLocaleString("pt-BR")}` : null,
      area ? `Área: ${area} m²` : null,
      bedrooms ? `Quartos: ${bedrooms}` : null,
      bathrooms ? `Banheiros: ${bathrooms}` : null,
      parkingSpots ? `Vagas: ${parkingSpots}` : null,
      neighborhood ? `Bairro: ${neighborhood}` : null,
      city ? `Cidade: ${city}` : null,
      state ? `Estado: ${state}` : null,
      brokerName ? `Corretor: ${brokerName}` : null,
      phone ? `Contato: ${phone}` : null,
      description ? `Descrição do anúncio: ${String(description).slice(0, 1200)}` : null,
    ].filter(Boolean).join("\n");

    const systemPrompt = pt
      ? `Você escreve legendas de Instagram/Facebook para anúncios imobiliários no Brasil.
- Máximo 600 caracteres, tom profissional e convidativo
- Comece com um gancho curto, use quebras de linha e no máximo 4 emojis discretos
- Inclua os principais dados (preço, localização, dormitórios/área) e uma chamada para ação com o contato quando houver
- Termine com 5 a 8 hashtags relevantes de mercado imobiliário e da cidade
- NÃO invente informações`
      : `You write Instagram/Facebook captions for real estate listings.
- Max 600 characters, professional and inviting tone
- Start with a short hook, use line breaks and at most 4 subtle emojis
- Include key data (price, location, beds/area) and a call to action with the contact when available
- End with 5 to 8 relevant real estate and city hashtags
- Do NOT invent information`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere a legenda para este imóvel:\n\n${details}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_caption",
              description: "Retorna a legenda pronta para publicação em redes sociais.",
              parameters: {
                type: "object",
                properties: {
                  caption: { type: "string", description: "Legenda completa, incluindo hashtags" },
                },
                required: ["caption"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_caption" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }, 429);
      if (response.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return json({ error: "Erro ao gerar legenda" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "Resposta inesperada da IA" }, 500);

    const result = JSON.parse(toolCall.function.arguments);

    const { error: logError } = await serviceClient
      .from("ai_usage_log")
      .insert({ user_id: userId, function_name: FUNCTION_NAME });
    if (logError) console.error("ai_usage_log insert error:", logError);

    return json({ caption: String(result.caption ?? "").trim() });
  } catch (e) {
    console.error("generate-social-caption error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
