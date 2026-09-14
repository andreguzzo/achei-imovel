import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { property_id, name, email, phone, message } = await req.json();

    if (!property_id || !name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: "property_id, name e email são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Try to authenticate user if auth header is present
    let senderId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
      );
      const { data: claimsData } = await anonClient.auth.getClaims(token);
      if (claimsData?.claims?.sub) {
        senderId = claimsData.claims.sub as string;
      }
    }

    // For anonymous users, use a system UUID
    const ANONYMOUS_SENDER_ID = "00000000-0000-0000-0000-000000000000";

    const { error } = await supabase.from("contact_requests").insert({
      property_id,
      sender_id: senderId || ANONYMOUS_SENDER_ID,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      message: message?.trim() || null,
      request_type: "contact",
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify the property owner by email. Never fail the request because of this.
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const { data: property } = await supabase
        .from("properties")
        .select("id, title, city, state, user_id, reference_code")
        .eq("id", property_id)
        .maybeSingle();

      if (!property) throw new Error("property not found for notification");

      const { data: adminUser } = await supabase.auth.admin.getUserById(property.user_id);
      const brokerEmail = adminUser?.user?.email;
      if (!brokerEmail) throw new Error("broker email not found");

      const propertyCode = property.reference_code ?? String(property.id).slice(0, 8).toUpperCase();
      const origin = req.headers.get("origin") || "https://abitzo.lovable.app";
      const panelUrl = `${origin}/painel?secao=contatos`;
      const leadPhone = (phone ?? "").replace(/\D/g, "");
      const waMessage = encodeURIComponent(
        `Olá ${name.trim()}, sou o corretor responsável pelo imóvel "${property.title}" (cód. ${propertyCode}). Recebi seu contato pelo Abitzo e estou à disposição.`
      );
      const waUrl = leadPhone
        ? `https://wa.me/${leadPhone.length <= 11 ? "55" + leadPhone : leadPhone}?text=${waMessage}`
        : null;

      if (!resendApiKey) {
        console.log(`[SEND-CONTACT] Lead for ${brokerEmail} (RESEND_API_KEY not set)`);
      } else {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color:#111;">
            <h2 style="margin:0 0 4px;">Novo contato recebido</h2>
            <p style="color:#666; margin:0 0 20px;">Imóvel: <strong>${escapeHtml(property.title)}</strong> (cód. ${propertyCode})<br/>${escapeHtml(property.city ?? "")} ${escapeHtml(property.state ?? "")}</p>
            <div style="background:#f4f4f5; border-radius:8px; padding:16px 20px; margin-bottom:20px;">
              <p style="margin:0 0 6px;"><strong>Nome:</strong> ${escapeHtml(name.trim())}</p>
              <p style="margin:0 0 6px;"><strong>E-mail:</strong> ${escapeHtml(email.trim())}</p>
              <p style="margin:0 0 6px;"><strong>Telefone:</strong> ${escapeHtml(phone?.trim() || "não informado")}</p>
              ${message?.trim() ? `<p style="margin:12px 0 0;"><strong>Mensagem:</strong><br/>${escapeHtml(message.trim()).replace(/\n/g, "<br/>")}</p>` : ""}
            </div>
            <p style="margin:0;">
              ${waUrl ? `<a href="${waUrl}" style="display:inline-block; background:#22c55e; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:bold; margin-right:8px;">Responder no WhatsApp</a>` : ""}
              <a href="${panelUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:bold;">Abrir no painel</a>
            </p>
          </div>
        `;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Abitzo <onboarding@resend.dev>",
            to: brokerEmail,
            subject: `Novo contato: ${property.title} (cód. ${propertyCode})`,
            html,
          }),
        });

        if (!emailRes.ok) {
          console.error("Resend error:", emailRes.status, await emailRes.text());
        }
      }
    } catch (notifyError) {
      console.error("Lead notification failed:", notifyError);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-contact error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
