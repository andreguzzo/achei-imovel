import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIERS, type TierKey } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Crown, CreditCard, ArrowUpRight, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const tierDetails: Record<TierKey, { name: string; priceLabel: string; color: string }> = {
  free: { name: "Gratuito", priceLabel: "R$ 0/mês", color: "bg-muted text-muted-foreground" },
  basic: { name: TIERS.basic.name, priceLabel: TIERS.basic.priceLabel, color: "bg-blue-100 text-blue-800" },
  pro: { name: TIERS.pro.name, priceLabel: TIERS.pro.priceLabel, color: "bg-purple-100 text-purple-800" },
  premium: { name: TIERS.premium.name, priceLabel: TIERS.premium.priceLabel, color: "bg-amber-100 text-amber-800" },
};

const SubscriptionCard = () => {
  const { tier, subscriptionEnd, refreshSubscription, checkingSubscription } = useAuth();
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loadingPortal, setLoadingPortal] = useState(false);

  const details = tierDetails[tier];
  const isPaid = tier !== "free";

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: pt ? "Erro" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          {pt ? "Meu Plano" : "My Plan"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current plan */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground">{details.name}</p>
                <Badge className={`text-[10px] ${details.color}`}>
                  {isPaid ? (pt ? "Ativo" : "Active") : (pt ? "Gratuito" : "Free")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{details.priceLabel}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshSubscription}
            disabled={checkingSubscription}
            title={pt ? "Atualizar status" : "Refresh status"}
          >
            <RefreshCw className={`h-4 w-4 ${checkingSubscription ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Subscription end date */}
        {isPaid && subscriptionEnd && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              {pt ? "Próxima renovação" : "Next renewal"}
            </p>
            <p className="text-sm font-medium text-foreground">
              {new Date(subscriptionEnd).toLocaleDateString(pt ? "pt-BR" : "en-US", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isPaid ? (
            <>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  {pt ? "Gerenciar assinatura" : "Manage subscription"}
                </span>
                {loadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                {pt
                  ? "Alterar plano, método de pagamento, ver faturas e cancelar"
                  : "Change plan, payment method, view invoices, and cancel"}
              </p>
            </>
          ) : (
            <Link to="/planos" className="w-full">
              <Button className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                {pt ? "Fazer upgrade" : "Upgrade plan"}
              </Button>
            </Link>
          )}

          <Link to="/planos" className="w-full">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              {pt ? "Ver todos os planos" : "View all plans"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionCard;
