import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface ClientIdentity {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export const normName = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export const normEmail = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

/** Two records belong to the same client when phone, e-mail or full name match. */
export const sameClient = (a: ClientIdentity, b: ClientIdentity) => {
  const pa = digits(a.phone), pb = digits(b.phone);
  if (pa.length >= 8 && pb.length >= 8) {
    if (pa.slice(-8) === pb.slice(-8)) return true;
  }
  const ea = normEmail(a.email), eb = normEmail(b.email);
  if (ea && eb && ea === eb) return true;
  const na = normName(a.name), nb = normName(b.name);
  return !!na && na === nb;
};

export type LeadRow = Tables<"contact_requests"> & { properties?: { title: string } | null };
export type PipelineRow = Tables<"sales_pipeline"> & { properties?: { title: string } | null };
export type AppointmentRow = Tables<"broker_appointments"> & { properties?: { title: string } | null };
export type ActivityRow = Tables<"pipeline_activities">;

export interface TimelineEntry {
  id: string;
  at: string;
  kind: "lead" | "activity" | "appointment" | "deal";
  title: string;
  detail?: string | null;
}

export interface ClientDossier {
  identity: ClientIdentity;
  leads: LeadRow[];
  deals: PipelineRow[];
  appointments: AppointmentRow[];
  activities: ActivityRow[];
  buyerLeads: Tables<"buyer_leads">[];
}

export async function fetchClientDossier(
  brokerId: string,
  identity: ClientIdentity,
): Promise<ClientDossier> {
  const [leadsRes, dealsRes, apptRes, buyersRes] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("*, properties:property_id(title)")
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("sales_pipeline")
      .select("*, properties:property_id(title)")
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("broker_appointments")
      .select("*, properties:property_id(title)")
      .eq("broker_id", brokerId)
      .order("appointment_date", { ascending: false })
      .limit(400),
    supabase
      .from("buyer_leads")
      .select("*")
      .eq("broker_id", brokerId)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const leads = ((leadsRes.data as unknown as LeadRow[]) ?? []).filter((r) =>
    sameClient(identity, { name: r.name, phone: r.phone, email: r.email }),
  );
  const deals = ((dealsRes.data as unknown as PipelineRow[]) ?? []).filter((r) =>
    sameClient(identity, { name: r.client_name, phone: r.client_phone, email: r.client_email }),
  );
  const appointments = ((apptRes.data as unknown as AppointmentRow[]) ?? []).filter(
    (r) =>
      sameClient(identity, { name: r.client_name ?? "", phone: r.client_phone }) ||
      (!!r.pipeline_id && deals.some((d) => d.id === r.pipeline_id)),
  );
  const buyerLeads = ((buyersRes.data as unknown as Tables<"buyer_leads">[]) ?? []).filter((r) =>
    sameClient(identity, { name: r.name, phone: r.phone, email: r.email }),
  );

  let activities: ActivityRow[] = [];
  if (deals.length) {
    const { data } = await supabase
      .from("pipeline_activities")
      .select("*")
      .in("pipeline_id", deals.map((d) => d.id))
      .order("occurred_at", { ascending: false })
      .limit(300);
    activities = (data as unknown as ActivityRow[]) ?? [];
  }

  return { identity, leads, deals, appointments, activities, buyerLeads };
}

export const activityTypeLabel = (v: string, pt: boolean) =>
  ({
    ligacao: pt ? "Ligação" : "Call",
    whatsapp: "WhatsApp",
    email: "E-mail",
    visita: pt ? "Visita" : "Visit",
    proposta: pt ? "Proposta" : "Proposal",
    observacao: pt ? "Observação" : "Note",
  } as Record<string, string>)[v] ?? v;

export const stageLabel = (v: string, pt: boolean) =>
  ({
    lead: "Lead",
    visit_scheduled: pt ? "Visita agendada" : "Visit scheduled",
    visited: pt ? "Visitou" : "Visited",
    proposal: pt ? "Proposta" : "Proposal",
    negotiation: pt ? "Negociação" : "Negotiation",
    documentation: pt ? "Documentação" : "Documentation",
    closed_won: pt ? "Fechado" : "Won",
    closed_lost: pt ? "Perdido" : "Lost",
  } as Record<string, string>)[v] ?? v;

export function buildTimeline(d: ClientDossier, pt: boolean): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  d.leads.forEach((l) =>
    entries.push({
      id: `lead-${l.id}`,
      at: l.created_at,
      kind: "lead",
      title: pt ? "Contato recebido pelo anúncio" : "Lead received from listing",
      detail: [l.properties?.title, l.message].filter(Boolean).join(" — ") || null,
    }),
  );

  d.deals.forEach((p) =>
    entries.push({
      id: `deal-${p.id}`,
      at: p.created_at,
      kind: "deal",
      title: pt ? "Negociação aberta" : "Deal opened",
      detail: [p.properties?.title, stageLabel(p.stage, pt)].filter(Boolean).join(" — ") || null,
    }),
  );

  d.activities.forEach((a) =>
    entries.push({
      id: `act-${a.id}`,
      at: a.occurred_at,
      kind: "activity",
      title: activityTypeLabel(a.activity_type, pt),
      detail: a.description,
    }),
  );

  d.appointments.forEach((a) =>
    entries.push({
      id: `appt-${a.id}`,
      at: `${a.appointment_date}T${a.start_time ?? "00:00:00"}`,
      kind: "appointment",
      title: `${pt ? "Compromisso" : "Appointment"}: ${a.title}`,
      detail: [a.properties?.title, a.location, a.completed ? (pt ? "Realizado" : "Done") : null]
        .filter(Boolean)
        .join(" — ") || null,
    }),
  );

  return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
