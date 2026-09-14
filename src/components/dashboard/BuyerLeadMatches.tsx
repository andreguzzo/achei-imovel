import { useEffect, useMemo, useState } from "react";
import { buildWhatsAppUrl, formatBrPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { featureLabel } from "@/lib/propertyFeatures";
import {
  buildPropertyMessage,
  fetchAvailableStock,
  propertyMatchesLead,
  // whatsappLink replaced by buildWhatsAppUrl
  type BuyerLead,
  type MatchableProperty,
} from "@/lib/buyerLeads";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  lead: BuyerLead;
  brokerId: string;
  agencyId?: string | null;
  stock?: MatchableProperty[];
}

const BuyerLeadMatches = ({ lead, brokerId, agencyId, stock }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loaded, setLoaded] = useState<MatchableProperty[] | null>(stock ?? null);

  useEffect(() => {
    if (stock) { setLoaded(stock); return; }
    let cancelled = false;
    fetchAvailableStock(brokerId, agencyId).then((rows) => {
      if (!cancelled) setLoaded(rows);
    });
    return () => { cancelled = true; };
  }, [stock, brokerId, agencyId]);

  const matches = useMemo(
    () => (loaded ?? []).filter((p) => propertyMatchesLead(p, lead)),
    [loaded, lead],
  );

  if (!loaded) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {pt
          ? "Nenhum imóvel do seu estoque, da imobiliária ou de parceiros bate com esses critérios hoje."
          : "No property from your stock, agency or partners matches these criteria today."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-foreground">{p.title}</p>
              {p.reference_code && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">{p.reference_code}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {p.neighborhood ? `${p.neighborhood}, ` : ""}{p.city} - {p.state}
              {p.bedrooms ? ` • ${p.bedrooms} ${pt ? "quartos" : "bd"}` : ""}
              {p.area ? ` • ${p.area} m²` : ""}
            </p>
            <p className="text-sm font-semibold text-primary">{brl(p.price)}</p>
            {!!p.features?.length && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {p.features.slice(0, 4).map((f) => featureLabel(f, pt)).join(" • ")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Link to={`/imovel/${p.id}`} target="_blank" rel="noreferrer">
              <Button size="icon" variant="ghost" title={pt ? "Abrir imóvel" : "Open property"}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            {buildWhatsAppUrl(lead.phone) ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  const url = buildWhatsAppUrl(lead.phone, buildPropertyMessage(p, lead.name, pt));
                  if (url) window.open(url, "_blank");
                }}
              >
                <MessageCircle className="h-4 w-4" />
                {pt ? "Enviar por WhatsApp" : "Send on WhatsApp"}
              </Button>
            ) : (
              <span className="self-center text-xs text-muted-foreground">
                {lead.phone ? formatBrPhone(lead.phone) : ""} —{" "}
                {pt ? "sem WhatsApp válido" : "no valid WhatsApp"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BuyerLeadMatches;
