import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "legible",
    "document_type",
    "person_name",
    "creci_number",
    "creci_state",
    "expires_at",
    "cnpj",
    "expired",
    "confidence",
    "notes",
  ],
  properties: {
    legible: { type: "boolean" },
    document_type: { type: "string" },
    person_name: { type: ["string", "null"] },
    creci_number: { type: ["string", "null"] },
    creci_state: { type: ["string", "null"] },
    expires_at: { type: ["string", "null"] },
    cnpj: { type: ["string", "null"] },
    expired: { type: "boolean" },
    confidence: { type: "number" },
    notes: { type: "string" },
  },
} as const;

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: claims, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) return json({ error: "Falha na autenticação" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const professionalPath = typeof body.professionalPath === "string" ? body.professionalPath : "";
    const personalPath = typeof body.personalPath === "string" ? body.personalPath : "";
    const kind = body.kind === "agency" ? "agency" : "creci";
    const claimedCreci = typeof body.creci === "string" ? body.creci.trim() : "";
    const claimedName = typeof body.fullName === "string" ? body.fullName.trim() : "";

    if (!professionalPath || !personalPath) return json({ error: "Envie os dois documentos" }, 400);
    if (!professionalPath.startsWith(`${userId}/`) || !personalPath.startsWith(`${userId}/`)) {
      return json({ error: "Arquivo inválido" }, 403);
    }
    if (claimedName.length < 3) return json({ error: "Informe seu nome completo" }, 400);
    if (kind === "creci" && claimedCreci.length < 3) return json({ error: "Informe o número do CRECI" }, 400);

    // Rate limit: max 5 attempts per day
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: attempts } = await admin
      .from("identity_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((attempts ?? 0) >= 5) {
      return json({ error: "Limite de tentativas diárias atingido. Tente novamente amanhã." }, 429);
    }

    const { data: record, error: insertError } = await admin
      .from("identity_verifications")
      .insert({
        user_id: userId,
        kind,
        status: "pending",
        professional_doc_path: professionalPath,
        personal_doc_path: personalPath,
        claimed_name: claimedName,
        claimed_creci: claimedCreci || null,
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);

    const signed = await Promise.all(
      [professionalPath, personalPath].map((path) =>
        admin.storage.from("identity-documents").createSignedUrl(path, 600),
      ),
    );
    const urls = signed.map((s) => s.data?.signedUrl).filter(Boolean) as string[];

    const isImage = (p: string) => /\.(jpe?g|png|webp)$/i.test(p);
    const bothImages = isImage(professionalPath) && isImage(personalPath);

    let extracted: Record<string, unknown> = {};
    let status = "manual_review";
    let reason = "";
    let confidence = 0;

    if (!bothImages || urls.length < 2) {
      reason = "Arquivo em PDF ou não legível automaticamente — enviado para revisão manual.";
    } else {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return json({ error: "IA não configurada" }, 500);

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          response_format: { type: "json_schema", json_schema: { name: "identity", strict: true, schema: SCHEMA } },
          messages: [
            {
              role: "system",
              content:
                "Você analisa documentos brasileiros de identificação profissional (CRECI/CNPJ) e pessoal (RG/CNH). " +
                "Extraia somente o que está visível. Se não conseguir ler, marque legible=false. " +
                "Datas no formato AAAA-MM-DD. confidence entre 0 e 1.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    `Documento profissional (primeira imagem) e documento pessoal (segunda imagem). ` +
                    `Nome declarado: "${claimedName}". ` +
                    (kind === "creci" ? `CRECI declarado: "${claimedCreci}". ` : `CNPJ/CRECI jurídico declarado: "${claimedCreci}". `) +
                    `Hoje é ${new Date().toISOString().slice(0, 10)}.`,
                },
                { type: "image_url", image_url: { url: urls[0] } },
                { type: "image_url", image_url: { url: urls[1] } },
              ],
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        const text = await aiRes.text();
        await admin
          .from("identity_verifications")
          .update({ status: "manual_review", reason: "Falha na leitura automática — revisão manual." })
          .eq("id", record.id);
        if (aiRes.status === 402 || aiRes.status === 403) {
          return json({ status: "manual_review", reason: "Leitura automática indisponível. Enviado para revisão manual." });
        }
        console.error("AI gateway error", aiRes.status, text);
        return json({ status: "manual_review", reason: "Leitura automática indisponível. Enviado para revisão manual." });
      }

      const aiData = await aiRes.json();
      const content = aiData?.choices?.[0]?.message?.content ?? "{}";
      extracted = typeof content === "string" ? JSON.parse(content) : content;

      const legible = extracted.legible === true;
      confidence = Number(extracted.confidence ?? 0);
      const expired = extracted.expired === true;
      const readName = normalize(extracted.person_name as string);
      const profileName = normalize(claimedName);
      const nameParts = profileName.split(" ").filter((p) => p.length > 2);
      const nameMatch =
        readName.length > 0 && nameParts.length > 0 &&
        nameParts.filter((p) => readName.includes(p)).length >= Math.min(2, nameParts.length);
      const creciMatch =
        kind === "agency"
          ? true
          : digits(extracted.creci_number as string).length > 0 &&
            digits(extracted.creci_number as string) === digits(claimedCreci);

      const problems: string[] = [];
      if (!legible) problems.push("documento ilegível");
      if (expired) problems.push("documento vencido");
      if (!nameMatch) problems.push("nome do documento diferente do perfil");
      if (!creciMatch) problems.push("número do CRECI diferente do informado");
      if (confidence < 0.6) problems.push("leitura com baixa confiança");

      if (!legible || expired) {
        status = "rejected";
        reason = `Reprovado: ${problems.join(", ")}.`;
      } else if (problems.length === 0) {
        status = "approved";
        reason = "Aprovado automaticamente pela leitura dos documentos.";
      } else {
        status = "manual_review";
        reason = `Enviado para revisão manual: ${problems.join(", ")}.`;
      }

      // Anti-fraud: same CRECI already approved for a different account
      if (status === "approved" && kind === "creci") {
        const { data: clash } = await admin
          .from("identity_verifications")
          .select("id")
          .eq("status", "approved")
          .eq("claimed_creci", claimedCreci)
          .neq("user_id", userId)
          .limit(1);
        if (clash && clash.length > 0) {
          status = "manual_review";
          reason = "Este CRECI já está aprovado em outra conta — revisão manual necessária.";
        }
      }
    }

    await admin
      .from("identity_verifications")
      .update({ status, reason, extracted, confidence })
      .eq("id", record.id);

    const profileUpdate: Record<string, unknown> = {
      verification_status: status,
      account_type: kind === "agency" ? "agency" : "broker",
    };
    if (status === "approved") {
      profileUpdate.verified_at = new Date().toISOString();
      if (claimedCreci) profileUpdate.creci = claimedCreci;
    }
    await admin.from("profiles").update(profileUpdate).eq("user_id", userId);

    return json({ status, reason, extracted, confidence, id: record.id });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
