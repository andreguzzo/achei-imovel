import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, MessageCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  buildPropertyMessage,
  propertyMatchesLead,
  statusLabel,
  urgencyLabel,
  whatsappLink,
  type BuyerLead,
  type MatchableProperty,
} from "@/lib/buyerLeads";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerId: string;
  property: MatchableProperty | null;
}

/** Reverse match: which buyer leads in the broker's book fit this property. */
const PropertyMatchingLeads = ({ open, onOpenChange, brokerId, property }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<BuyerLead[]>([]);

  useEffect(() => {
    if (!open || !property) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("buyer_leads")
      .select("*")
      .eq("broker_id", brokerId)
      .eq("status", "ativo")
      .then(({ data }) => {
        if (cancelled) return;
        setMatches((data ?? []).filter((l) => propertyMatchesLead(property, l)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, property, brokerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pt ? "Clientes compatíveis" : "Matching buyers"}</DialogTitle>
          <DialogDescription className="truncate">{property?.title}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : matches.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {pt ? "Nenhum cliente da sua carteira bate com este imóvel." : "No buyer in your book matches this property."}
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(l.status, pt)} • {urgencyLabel(l.urgency, pt)}
                  </p>
                </div>
                {l.phone ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      property &&
                      window.open(whatsappLink(l.phone, buildPropertyMessage(property, l.name, pt)), "_blank")
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                    {pt ? "Enviar" : "Send"}
                  </Button>
                ) : (
                  <Badge variant="secondary">{pt ? "Sem telefone" : "No phone"}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PropertyMatchingLeads;
