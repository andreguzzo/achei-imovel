import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  max_properties: number | null;
  features: string[];
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  sort_order: number;
  highlighted: boolean;
  active: boolean;
};

function normalize(row: Record<string, unknown>): Plan {
  const features = Array.isArray(row.features) ? (row.features as unknown[]).map(String) : [];
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string) ?? null,
    price_cents: Number(row.price_cents ?? 0),
    max_properties: row.max_properties === null || row.max_properties === undefined ? null : Number(row.max_properties),
    features,
    stripe_product_id: (row.stripe_product_id as string) ?? null,
    stripe_price_id: (row.stripe_price_id as string) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    highlighted: !!row.highlighted,
    active: !!row.active,
  };
}

export function formatPlanPrice(cents: number, locale = "pt-BR") {
  if (cents === 0) return locale === "pt-BR" ? "R$ 0" : "$0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Reads the editable plans catalogue. `includeInactive` requires admin rights. */
export function usePlans(includeInactive = false) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("subscription_plans").select("*").order("sort_order");
    if (!includeInactive) query = query.eq("active", true);
    const { data } = await query;
    setPlans((data ?? []).map((row) => normalize(row as Record<string, unknown>)));
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  return { plans, loading, refetch: fetchPlans };
}
