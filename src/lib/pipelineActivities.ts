/** Interaction history helpers for the sales pipeline (broker-only data). */

export type ActivityTypeKey =
  | "ligacao"
  | "whatsapp"
  | "email"
  | "visita"
  | "proposta"
  | "observacao";

export const ACTIVITY_TYPES: { key: ActivityTypeKey; label: string; labelEn: string }[] = [
  { key: "ligacao", label: "Ligação", labelEn: "Call" },
  { key: "whatsapp", label: "WhatsApp", labelEn: "WhatsApp" },
  { key: "email", label: "E-mail", labelEn: "Email" },
  { key: "visita", label: "Visita", labelEn: "Visit" },
  { key: "proposta", label: "Proposta", labelEn: "Proposal" },
  { key: "observacao", label: "Observação", labelEn: "Note" },
];

export const activityLabel = (key: string, pt: boolean) => {
  const found = ACTIVITY_TYPES.find((a) => a.key === key);
  if (!found) return key;
  return pt ? found.label : found.labelEn;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const isoDaysFromNow = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/** Formats a timestamp as "12/03/2026 14:20" (pt) or locale default. */
export const formatDateTime = (value: string, pt: boolean) =>
  new Date(value).toLocaleString(pt ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDay = (value: string, pt: boolean) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(pt ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export type FollowUpGroup = "overdue" | "today" | "week" | "stalled";

/** Days since the given timestamp, or null when there is none. */
export const daysSince = (value: string | null) => {
  if (!value) return null;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
};
