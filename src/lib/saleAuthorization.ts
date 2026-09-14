/**
 * Sale authorization (autorização de venda) helpers.
 * These data live in property_private_data and are PRIVATE to the broker —
 * never render them on public pages.
 */

export type AuthorizationType = "exclusiva" | "simples" | "sem_autorizacao";

export interface AuthorizationData {
  authorization_type: AuthorizationType | "";
  authorization_start: string;
  authorization_end: string;
  commission_percent: string;
  authorization_file_path: string;
  owner_email: string;
  owner_notes: string;
}

export const emptyAuthorization = (): AuthorizationData => ({
  authorization_type: "",
  authorization_start: "",
  authorization_end: "",
  commission_percent: "",
  authorization_file_path: "",
  owner_email: "",
  owner_notes: "",
});

export const AUTHORIZATION_OPTIONS: { value: AuthorizationType; pt: string; en: string }[] = [
  { value: "exclusiva", pt: "Exclusiva", en: "Exclusive" },
  { value: "simples", pt: "Simples (sem exclusividade)", en: "Simple (non-exclusive)" },
  { value: "sem_autorizacao", pt: "Sem autorização", en: "No authorization" },
];

export const authorizationLabel = (value: string | null | undefined, pt: boolean): string => {
  const opt = AUTHORIZATION_OPTIONS.find((o) => o.value === value);
  if (!opt) return value ?? "";
  return pt ? opt.pt : opt.en;
};

export type AuthorizationStatus = "none" | "ok" | "expiring" | "expired";

/** Days left until the authorization expires (negative when already expired). */
export const daysUntil = (isoDate: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${isoDate}T00:00:00`);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
};

export const authorizationStatus = (
  endDate: string | null | undefined,
): { status: AuthorizationStatus; days: number } => {
  if (!endDate) return { status: "none", days: 0 };
  const days = daysUntil(endDate);
  if (days < 0) return { status: "expired", days };
  if (days <= 30) return { status: "expiring", days };
  return { status: "ok", days };
};

export const authorizationBadgeText = (
  status: AuthorizationStatus,
  days: number,
  pt: boolean,
): string | null => {
  if (status === "expired") {
    return pt ? "Autorização vencida" : "Authorization expired";
  }
  if (status === "expiring") {
    if (days === 0) return pt ? "Autorização vence hoje" : "Authorization expires today";
    return pt
      ? `Autorização vence em ${days} ${days === 1 ? "dia" : "dias"}`
      : `Authorization expires in ${days} ${days === 1 ? "day" : "days"}`;
  }
  return null;
};

export const formatDateBr = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
