import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PartnershipKind = Database["public"]["Enums"]["partnership_kind"];
export type MemberStatus = Database["public"]["Enums"]["member_status"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export const PARTNERSHIP_KINDS: PartnershipKind[] = [
  "co_listing",
  "sale_partnership",
  "non_exclusive",
];

export const partnershipKindLabel = (kind: PartnershipKind | null, pt: boolean): string => {
  const labels: Record<PartnershipKind, { pt: string; en: string }> = {
    co_listing: { pt: "Parceria na captação", en: "Co-listing partnership" },
    sale_partnership: { pt: "Parceria na venda", en: "Sale partnership" },
    non_exclusive: { pt: "Imóvel sem exclusividade", en: "Non-exclusive listing" },
  };
  if (!kind) return pt ? "Parceria" : "Partnership";
  return pt ? labels[kind].pt : labels[kind].en;
};

export const partnershipKindHint = (kind: PartnershipKind, pt: boolean): string => {
  const hints: Record<PartnershipKind, { pt: string; en: string }> = {
    co_listing: {
      pt: "Ambos captaram o imóvel junto ao proprietário.",
      en: "Both brokers captured the listing with the owner.",
    },
    sale_partnership: {
      pt: "Um corretor captou e o outro trabalha a venda.",
      en: "One broker captured it, the other works the sale.",
    },
    non_exclusive: {
      pt: "Imóvel sem exclusividade, com autorização do proprietário.",
      en: "Non-exclusive listing authorized by the owner.",
    },
  };
  return pt ? hints[kind].pt : hints[kind].en;
};

export const memberStatusLabel = (status: MemberStatus, pt: boolean): string => {
  const labels: Record<MemberStatus, { pt: string; en: string }> = {
    pending: { pt: "Pendente", en: "Pending" },
    approved: { pt: "Aprovada", en: "Approved" },
    declined: { pt: "Recusada", en: "Declined" },
  };
  return pt ? labels[status].pt : labels[status].en;
};

export interface GroupInfo {
  groupId: string;
  role: MemberRole;
  brokerCount: number;
  priceFrom: number;
  priceTo: number;
}

/**
 * Collapses a property list into one entry per consolidated listing (property group).
 * The captador's sub-listing represents the group; partner sub-listings are hidden
 * from the list but their prices feed the displayed price range.
 */
export async function dedupeByGroup<T extends { id: string; price: number }>(
  properties: T[],
): Promise<{ items: T[]; groupInfo: Map<string, GroupInfo> }> {
  const groupInfo = new Map<string, GroupInfo>();
  if (properties.length === 0) return { items: properties, groupInfo };

  const ids = properties.map((p) => p.id);
  const { data: members } = await supabase
    .from("property_group_members")
    .select("group_id, property_id, broker_id, role, status")
    .in("property_id", ids)
    .eq("status", "approved");

  if (!members || members.length === 0) return { items: properties, groupInfo };

  const byProperty = new Map(members.map((m) => [m.property_id, m]));
  const priceById = new Map(properties.map((p) => [p.id, p.price]));

  // Group all approved members (including sub-listings filtered out by search filters)
  const groupIds = Array.from(new Set(members.map((m) => m.group_id)));
  const { data: allMembers } = await supabase
    .from("property_group_members")
    .select("group_id, property_id, broker_id, role, status")
    .in("group_id", groupIds)
    .eq("status", "approved");

  const groups = new Map<string, { propertyIds: string[]; captadorPropertyId?: string }>();
  (allMembers ?? []).forEach((m) => {
    const g = groups.get(m.group_id) ?? { propertyIds: [] };
    g.propertyIds.push(m.property_id);
    if (m.role === "captador") g.captadorPropertyId = m.property_id;
    groups.set(m.group_id, g);
  });

  const { data: groupPrices } = await supabase
    .from("properties")
    .select("id, price")
    .in("id", Array.from(new Set((allMembers ?? []).map((m) => m.property_id))));
  (groupPrices ?? []).forEach((p) => {
    if (!priceById.has(p.id)) priceById.set(p.id, p.price);
  });

  const seenGroups = new Set<string>();
  const items: T[] = [];

  for (const prop of properties) {
    const member = byProperty.get(prop.id);
    if (!member) {
      items.push(prop);
      continue;
    }
    const group = groups.get(member.group_id);
    if (!group || group.propertyIds.length <= 1) {
      items.push(prop);
      continue;
    }
    if (seenGroups.has(member.group_id)) continue;

    // Prefer the captador's sub-listing as the representative, when it is in the result set
    const captadorProp = group.captadorPropertyId
      ? properties.find((p) => p.id === group.captadorPropertyId)
      : undefined;
    const representative = captadorProp ?? prop;

    seenGroups.add(member.group_id);
    const prices = group.propertyIds
      .map((pid) => priceById.get(pid))
      .filter((v): v is number => typeof v === "number" && v > 0);

    groupInfo.set(representative.id, {
      groupId: member.group_id,
      role: member.role,
      brokerCount: new Set(group.propertyIds).size,
      priceFrom: prices.length ? Math.min(...prices) : representative.price,
      priceTo: prices.length ? Math.max(...prices) : representative.price,
    });
    items.push(representative);
  }

  return { items, groupInfo };
}
