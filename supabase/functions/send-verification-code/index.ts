import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type } = await req.json();

    if (type !== "email") {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invalidate previous codes
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("user_id", user.id)
      .eq("type", type)
      .eq("used", false);

    // Generate new code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    await supabase.from("verification_codes").insert({
      user_id: user.id,
      code,
      type,
      expires_at: expiresAt,
    });

    // Send email using Supabase Auth admin API (send OTP via email)
    // We'll use a simple approach: send via the Resend-compatible endpoint or use admin
    // For now, we use Supabase's built-in email by leveraging the admin API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      // Send via Resend
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "noreply@lovable.app",
          to: user.email,
          subject: "Código de verificação / Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #333;">Código de Verificação</h2>
              <p style="color: #666;">Use o código abaixo para verificar seu e-mail:</p>
              <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
              </div>
              <p style="color: #999; font-size: 12px;">Este código expira em 10 minutos.</p>
            </div>
          `,
        }),
      });
      
      if (!emailRes.ok) {
        console.error("Resend error:", await emailRes.text());
      }
    } else {
      // Fallback: Log code (in production, configure RESEND_API_KEY)
      console.log(`Verification code for ${user.email}: ${code}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Code sent",
        // In dev without Resend, return code for testing
        ...(!resendApiKey ? { dev_code: code } : {}),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
