import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, TIERS, getMaxProperties, type TierKey } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const tierOrder: TierKey[] = ["free", "basic", "pro", "premium"];

const tierDetails = {
  free: {
    name: "Gratuito",
    price: "R$ 0",
    features: ["Até 3 imóveis ativos", "Dashboard básico", "Agenda de compromissos"],
  },
  basic: {
    name: TIERS.basic.name,
    price: TIERS.basic.priceLabel,
    features: ["Até 10 imóveis ativos", "Dashboard completo", "Pipeline de vendas", "Relatórios"],
  },
  pro: {
    name: TIERS.pro.name,
    price: TIERS.pro.priceLabel,
    features: ["Até 50 imóveis ativos", "Tudo do Básico", "Parcerias entre corretores", "Prioridade no suporte"],
  },
  premium: {
    name: TIERS.premium.name,
    price: TIERS.premium.priceLabel,
    features: ["Imóveis ilimitados", "Tudo do Pro", "Destaques nas buscas", "Suporte prioritário 24h"],
  },
};

const Plans = () => {
  const { user, tier: currentTier, subscriptionEnd, refreshSubscription } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tierKey: TierKey) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (tierKey === "free") return;

    setLoadingTier(tierKey);
    try {
      const priceId = TIERS[tierKey].price_id;
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    setLoadingTier("manage");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="container max-w-5xl py-12">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-bold text-foreground">
          {pt ? "Planos para Corretores" : "Broker Plans"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {pt ? "Escolha o plano ideal para o seu negócio" : "Choose the best plan for your business"}
        </p>
        {currentTier !== "free" && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm">
              <Crown className="mr-1 h-3 w-3" />
              {pt ? `Plano atual: ${tierDetails[currentTier]?.name}` : `Current plan: ${tierDetails[currentTier]?.name}`}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleManage} disabled={loadingTier === "manage"}>
              {loadingTier === "manage" ? <Loader2 className="h-4 w-4 animate-spin" /> : pt ? "Gerenciar assinatura" : "Manage subscription"}
            </Button>
            <Button variant="ghost" size="sm" onClick={refreshSubscription}>
              {pt ? "Atualizar status" : "Refresh status"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tierOrder.map((tierKey) => {
          const details = tierDetails[tierKey];
          const isCurrent = currentTier === tierKey;
          const isUpgrade = tierOrder.indexOf(tierKey) > tierOrder.indexOf(currentTier);

          return (
            <Card
              key={tierKey}
              className={`relative flex flex-col ${isCurrent ? "border-primary ring-2 ring-primary/20" : ""} ${tierKey === "pro" ? "border-primary/50" : ""}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  {pt ? "Seu plano" : "Your plan"}
                </Badge>
              )}
              {tierKey === "pro" && !isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                  {pt ? "Mais popular" : "Most popular"}
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{details.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-foreground">
                  {details.price}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-6 flex-1 space-y-2">
                  {details.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {tierKey === "free" ? (
                  <Button variant="outline" disabled className="w-full">
                    {pt ? "Plano atual" : "Current plan"}
                  </Button>
                ) : isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    {pt ? "Plano ativo" : "Active plan"}
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(tierKey)}
                    disabled={!!loadingTier}
                  >
                    {loadingTier === tierKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      pt ? "Assinar" : "Subscribe"
                    )}
                  </Button>
                ) : (
                  <Button variant="outline" disabled className="w-full">
                    {pt ? "Plano inferior" : "Lower plan"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Plans;
