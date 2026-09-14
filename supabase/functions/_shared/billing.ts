import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export type PlanRef = {
  slug: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

/** Resolves a plan slug from a Stripe price or product id. */
export async function resolvePlanSlug(
  db: SupabaseClient,
  opts: { priceId?: string | null; productId?: string | null },
): Promise<string | null> {
  const { data } = await db
    .from("subscription_plans")
    .select("slug, stripe_product_id, stripe_price_id");
  const plans = (data ?? []) as PlanRef[];
  if (opts.priceId) {
    const byPrice = plans.find((p) => p.stripe_price_id === opts.priceId);
    if (byPrice) return byPrice.slug;
  }
  if (opts.productId) {
    const byProduct = plans.find((p) => p.stripe_product_id === opts.productId);
    if (byProduct) return byProduct.slug;
  }
  return null;
}

/** Account type granted by each paid plan. */
export function accountTypeForSlug(slug: string | null): "owner" | "broker" | "agency" | null {
  if (slug === "corretor") return "broker";
  if (slug === "imobiliaria") return "agency";
  if (slug === "owner") return "owner";
  return null;
}

/** Finds the app user id for a Stripe customer e-mail. */
export async function findUserIdByEmail(db: SupabaseClient, email: string | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

/** Applies the plan to the user profile so access is released immediately. */
export async function applyPlanToProfile(
  db: SupabaseClient,
  userId: string | null,
  slug: string | null,
  active: boolean,
) {
  if (!userId) return;
  const accountType = accountTypeForSlug(slug);
  if (!active || !accountType || accountType === "owner") return;
  const { data: profile } = await db
    .from("profiles")
    .select("account_type")
    .eq("user_id", userId)
    .maybeSingle();
  // Only upgrade: never downgrade an agency to broker because of a webhook race.
  if (profile?.account_type === "agency" && accountType === "broker") return;
  await db.from("profiles").update({ account_type: accountType }).eq("user_id", userId);
}
