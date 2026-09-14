import { buildWhatsAppUrl } from "@/lib/phone";

export interface OwnerReportComparison {
  sample_count: number;
  avg_price: number | null;
  median_price: number | null;
  avg_price_per_area: number | null;
  /** difference of the property price vs the sample average, in percent */
  diff_percent: number | null;
}

export interface OwnerReportMetrics {
  property: {
    id: string;
    title: string;
    reference_code: string | null;
    property_type: string;
    listing_type: string;
    status: string;
    price: number;
    area: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    suites: number | null;
    parking_spots: number | null;
    neighborhood: string | null;
    city: string;
    state: string;
    published_at: string;
    cover_url: string | null;
  };
  broker: { name: string; creci: string | null; phone: string | null };
  views: number;
  leads: number;
  visits_scheduled: number;
  visits_done: number;
  channels: string[];
  comparison: OwnerReportComparison | null;
}

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export const reportDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export const buildReportUrl = (token: string) => `${window.location.origin}/relatorio/${token}`;

export { onlyDigits } from "@/lib/phone";

/** @deprecated use buildWhatsAppUrl from "@/lib/phone" */
export const whatsappLink = buildWhatsAppUrl;
