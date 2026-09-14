import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { featureLabel } from "@/lib/propertyFeatures";
import { buildWhatsAppUrl } from "@/lib/phone";

export type BuyerLead = Tables<"buyer_leads">;

export interface BuyerCriteria {
  city?: string | null;
  neighborhoods?: string[];
  property_types?: Enums<"property_type">[];
  listing_type?: Enums<"listing_type"> | null;
  price_min?: number | null;
  price_max?: number | null;
  bedrooms_min?: number | null;
  area_min?: number | null;
  features?: string[];
}

export const BUYER_STATUSES = ["ativo", "pausado", "atendido", "perdido"] as const;
export const BUYER_URGENCIES = ["imediata", "3_meses", "6_meses", "pesquisando"] as const;
export const FINANCING_TYPES = ["a_vista", "financiado", "fgts", "permuta"] as const;

export const statusLabel = (v: string, pt: boolean) =>
  ({
    ativo: pt ? "Ativo" : "Active",
    pausado: pt ? "Pausado" : "Paused",
    atendido: pt ? "Atendido" : "Served",
    perdido: pt ? "Perdido" : "Lost",
  } as Record<string, string>)[v] ?? v;

export const urgencyLabel = (v: string, pt: boolean) =>
  ({
    imediata: pt ? "Imediata" : "Immediate",
    "3_meses": pt ? "Em até 3 meses" : "Within 3 months",
    "6_meses": pt ? "Em até 6 meses" : "Within 6 months",
    pesquisando: pt ? "Só pesquisando" : "Just browsing",
  } as Record<string, string>)[v] ?? v;

export const financingLabel = (v: string | null, pt: boolean) =>
  !v
    ? "—"
    : (({
        a_vista: pt ? "À vista" : "Cash",
        financiado: pt ? "Financiado" : "Financed",
        fgts: "FGTS",
        permuta: pt ? "Permuta" : "Trade-in",
      } as Record<string, string>)[v] ?? v);

export const parseCriteria = (raw: unknown): BuyerCriteria =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as BuyerCriteria) : {};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export type MatchableProperty = Pick<
  Tables<"properties">,
  | "id"
  | "title"
  | "price"
  | "city"
  | "state"
  | "neighborhood"
  | "property_type"
  | "listing_type"
  | "status"
  | "bedrooms"
  | "area"
  | "features"
  | "reference_code"
>;

/** True when a property satisfies every criterion the broker filled for this buyer. */
export function propertyMatchesLead(
  property: MatchableProperty,
  lead: Pick<BuyerLead, "criteria" | "budget_min" | "budget_max">,
): boolean {
  const c = parseCriteria(lead.criteria);

  if (property.status !== "active") return false;
  if (c.city && norm(c.city) !== norm(property.city ?? "")) return false;

  if (c.neighborhoods?.length) {
    const target = norm(property.neighborhood ?? "");
    if (!target || !c.neighborhoods.some((n) => norm(n) && target.includes(norm(n)))) return false;
  }

  if (c.property_types?.length && !c.property_types.includes(property.property_type)) return false;
  if (c.listing_type && c.listing_type !== property.listing_type) return false;

  const min = c.price_min ?? lead.budget_min;
  const max = c.price_max ?? lead.budget_max;
  if (min != null && property.price < Number(min)) return false;
  if (max != null && property.price > Number(max)) return false;

  if (c.bedrooms_min != null && (property.bedrooms ?? 0) < Number(c.bedrooms_min)) return false;
  if (c.area_min != null && Number(property.area ?? 0) < Number(c.area_min)) return false;

  if (c.features?.length) {
    const owned = new Set(property.features ?? []);
    if (!c.features.every((f) => owned.has(f))) return false;
  }

  return true;
}

const PROPERTY_FIELDS =
  "id, title, price, city, state, neighborhood, property_type, listing_type, status, bedrooms, area, features, reference_code";

/**
 * Stock the broker can offer: own listings, the agency's listings and listings
 * from consolidated groups where the broker is an approved member (partners).
 */
export async function fetchAvailableStock(
  brokerId: string,
  agencyId?: string | null,
): Promise<MatchableProperty[]> {
  const byId = new Map<string, MatchableProperty>();

  const own = await supabase
    .from("properties")
    .select(PROPERTY_FIELDS)
    .eq("user_id", brokerId)
    .eq("status", "active");
  (own.data ?? []).forEach((p) => byId.set(p.id, p as MatchableProperty));

  if (agencyId) {
    const agency = await supabase
      .from("properties")
      .select(PROPERTY_FIELDS)
      .eq("agency_id", agencyId)
      .eq("status", "active");
    (agency.data ?? []).forEach((p) => byId.set(p.id, p as MatchableProperty));
  }

  // Approved partnership groups the broker participates in
  const { data: myGroups } = await supabase
    .from("property_group_members")
    .select("group_id")
    .eq("broker_id", brokerId)
    .eq("status", "approved");

  const groupIds = Array.from(new Set((myGroups ?? []).map((g) => g.group_id)));
  if (groupIds.length) {
    const { data: partnerMembers } = await supabase
      .from("property_group_members")
      .select("property_id")
      .in("group_id", groupIds)
      .eq("status", "approved");
    const partnerIds = Array.from(
      new Set((partnerMembers ?? []).map((m) => m.property_id).filter((id) => !byId.has(id))),
    );
    if (partnerIds.length) {
      const { data: partnerProps } = await supabase
        .from("properties")
        .select(PROPERTY_FIELDS)
        .in("id", partnerIds)
        .eq("status", "active");
      (partnerProps ?? []).forEach((p) => byId.set(p.id, p as MatchableProperty));
    }
  }

  return Array.from(byId.values());
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export function propertyPublicUrl(propertyId: string) {
  return `${window.location.origin}/imovel/${propertyId}`;
}

export function buildPropertyMessage(property: MatchableProperty, leadName: string, pt: boolean) {
  const highlights = [
    property.bedrooms ? `${property.bedrooms} ${pt ? "quartos" : "bedrooms"}` : null,
    property.area ? `${property.area} m²` : null,
    ...(property.features ?? []).slice(0, 3).map((f) => featureLabel(f, pt)),
  ].filter(Boolean);

  const lines = [
    pt ? `Olá ${leadName}! Encontrei um imóvel que combina com o que você procura:` : `Hi ${leadName}! I found a property matching your search:`,
    "",
    `*${property.title}*`,
    property.reference_code ? `${pt ? "Código" : "Ref"}: ${property.reference_code}` : null,
    `${property.neighborhood ? `${property.neighborhood}, ` : ""}${property.city} - ${property.state}`,
    `${pt ? "Valor" : "Price"}: ${brl(property.price)}`,
    highlights.length ? highlights.join(" • ") : null,
    "",
    propertyPublicUrl(property.id),
  ].filter((l): l is string => l !== null);

  return lines.join("\n");
}

/** @deprecated use buildWhatsAppUrl from "@/lib/phone" */
export const whatsappLink = buildWhatsAppUrl;
