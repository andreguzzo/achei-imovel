import { corsHeaders, json, requireAdmin } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supabaseAdmin } = await requireAdmin(req);

    const users: {
      user_id: string;
      email: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      banned_until: string | null;
      email_confirmed: boolean;
    }[] = [];

    let page = 1;
    const perPage = 200;
    // Cap at 20 pages (4000 users) to keep the response bounded.
    while (page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      const batch = data?.users ?? [];
      for (const u of batch) {
        users.push({
          user_id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          banned_until: (u as unknown as { banned_until?: string }).banned_until ?? null,
          email_confirmed: !!u.email_confirmed_at,
        });
      }
      if (batch.length < perPage) break;
      page++;
    }

    return json({ users });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
