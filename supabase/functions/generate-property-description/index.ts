import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FUNCTION_NAME = "generate-property-description";
const DAILY_LIMIT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Require an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: claimsData } = await anonClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: `Você atingiu o limite de ${DAILY_LIMIT} gerações de IA por dia. Tente novamente amanhã.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { propertyType, listingType, price, area, bedrooms, suites, bathrooms, parkingSpots, neighborhood, city, state, features, condoFee, iptu, address } = body;

    const typeLabels: Record<string, string> = { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Imóvel Comercial" };
    const listingLabels: Record<string, string> = { sale: "Venda", rent: "Aluguel" };

    const details = [
      `Tipo: ${typeLabels[propertyType] || propertyType}`,
      `Modalidade: ${listingLabels[listingType] || listingType}`,
      price ? `Preço: R$ ${Number(price).toLocaleString("pt-BR")}` : null,
      area ? `Área: ${area} m²` : null,
      bedrooms ? `Quartos: ${bedrooms}` : null,
      suites ? `Suítes: ${suites}` : null,
      bathrooms ? `Banheiros: ${bathrooms}` : null,
      parkingSpots ? `Vagas de garagem: ${parkingSpots}` : null,
      condoFee ? `Condomínio: R$ ${Number(condoFee).toLocaleString("pt-BR")}` : null,
      iptu ? `IPTU: R$ ${Number(iptu).toLocaleString("pt-BR")}` : null,
      neighborhood ? `Bairro: ${neighborhood}` : null,
      city ? `Cidade: ${city}` : null,
      state ? `Estado: ${state}` : null,
      address ? `Endereço: ${address}` : null,
      features ? `Características: ${features}` : null,
    ].filter(Boolean).join("\n");

    const systemPrompt = `Você é um especialista em redação de anúncios imobiliários no Brasil. 
Gere um título atraente (máximo 100 caracteres) e uma descrição profissional e persuasiva (3-5 parágrafos) para o imóvel com base nas informações fornecidas.
- Use linguagem profissional, clara e envolvente
- Destaque os principais diferenciais
- Inclua chamadas para ação sutis
- NÃO invente informações que não foram fornecidas
- Responda APENAS com o JSON usando a ferramenta fornecida`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere título e descrição para este imóvel:\n\n${details}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_listing",
              description: "Retorna título e descrição gerados para o anúncio imobiliário.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do anúncio (máximo 100 caracteres)" },
                  description: { type: "string", description: "Descrição completa do anúncio (3-5 parágrafos)" },
                },
                required: ["title", "description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_listing" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar descrição" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    const { error: logError } = await serviceClient
      .from("ai_usage_log")
      .insert({ user_id: userId, function_name: FUNCTION_NAME });
    if (logError) console.error("ai_usage_log insert error:", logError);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-property-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
