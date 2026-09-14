import type { Tables, Enums } from "@/integrations/supabase/types";

export type RentalContract = Tables<"rental_contracts">;
export type RentalCharge = Tables<"rental_charges">;
export type RentalInspection = Tables<"rental_inspections">;

export type ContractStatus = Enums<"rental_contract_status">;
export type ChargeStatus = Enums<"rental_charge_status">;
export type GuaranteeType = Enums<"rental_guarantee">;
export type RentalIndex = Enums<"rental_index">;
export type InspectionType = Enums<"rental_inspection_type">;

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export const brlShort = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

export const contractStatusLabel = (s: ContractStatus, pt: boolean) =>
  ({
    draft: pt ? "Rascunho" : "Draft",
    active: pt ? "Ativo" : "Active",
    notice: pt ? "Em aviso" : "Notice period",
    ended: pt ? "Encerrado" : "Ended",
  }[s]);

export const chargeStatusLabel = (s: ChargeStatus, pt: boolean) =>
  ({
    pending: pt ? "A receber" : "Due",
    paid: pt ? "Pago" : "Paid",
    overdue: pt ? "Atrasado" : "Overdue",
    cancelled: pt ? "Cancelado" : "Cancelled",
  }[s]);

export const guaranteeLabel = (g: GuaranteeType, pt: boolean) =>
  ({
    none: pt ? "Sem garantia" : "No guarantee",
    fiador: pt ? "Fiador" : "Guarantor",
    caucao: pt ? "Caução" : "Security deposit",
    seguro_fianca: pt ? "Seguro-fiança" : "Rent insurance",
    titulo_capitalizacao: pt ? "Título de capitalização" : "Capitalization bond",
  }[g]);

export const indexLabel = (i: RentalIndex, pt: boolean) =>
  ({
    none: pt ? "Sem reajuste" : "No adjustment",
    igpm: "IGP-M",
    ipca: "IPCA",
    inpc: "INPC",
  }[i]);

export const inspectionTypeLabel = (t: InspectionType, pt: boolean) =>
  ({ entrada: pt ? "Vistoria de entrada" : "Move-in inspection", saida: pt ? "Vistoria de saída" : "Move-out inspection" }[t]);

/** A pending charge whose due date has passed counts as overdue for display purposes. */
export const effectiveChargeStatus = (charge: Pick<RentalCharge, "status" | "due_date">): ChargeStatus => {
  if (charge.status !== "pending") return charge.status;
  const today = new Date().toISOString().slice(0, 10);
  return charge.due_date < today ? "overdue" : "pending";
};

export const chargeStatusClass = (s: ChargeStatus) =>
  ({
    pending: "bg-muted text-muted-foreground",
    paid: "bg-primary/10 text-primary",
    overdue: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground line-through",
  }[s]);

export const monthKey = (date: Date | string) => String(date).slice(0, 7);

export const formatCompetence = (competence: string, pt: boolean) => {
  const [y, m] = competence.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(pt ? "pt-BR" : "en-US", { month: "short", year: "numeric" });
};

export const formatDate = (value: string | null, pt: boolean) => {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return pt ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
};

/** Days between today and a date (negative = in the past). */
export const daysUntil = (value: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

export const adminFee = (rent: number, percent: number) =>
  Math.round(((rent || 0) * (percent || 0)) / 100 * 100) / 100;

export const chargeMessage = (
  charge: RentalCharge,
  contract: Pick<RentalContract, "tenant_name" | "property_label">,
  pt: boolean,
) => {
  const total = brl(Number(charge.total_amount));
  const due = formatDate(charge.due_date, pt);
  const link = charge.payment_link ? `\n${charge.payment_link}` : "";
  return pt
    ? `Olá, ${contract.tenant_name}! Segue a cobrança do aluguel de ${formatCompetence(charge.competence, true)}${
        contract.property_label ? ` — ${contract.property_label}` : ""
      }.\nValor: ${total}\nVencimento: ${due}${link}`
    : `Hi ${contract.tenant_name}! Here is your rent invoice for ${formatCompetence(charge.competence, false)}${
        contract.property_label ? ` — ${contract.property_label}` : ""
      }.\nAmount: ${total}\nDue: ${due}${link}`;
};

export const whatsappUrl = (phone: string, message: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
