import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, formatPlanPrice, type Plan } from "@/hooks/usePlans";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";

const Plans = () => {
  const { user, tier, planSlug, refreshSubscription } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";
  const { plans, loading } = usePlans();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // The webhook-backed plan slug wins; the legacy tier stays as fallback for old subscribers.
  const currentTier = planSlug ?? tier;
  const currentPlan = plans.find((p) => p.slug === currentTier);
  const currentIndex = plans.findIndex((p) => p.slug === currentTier);

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!plan.stripe_price_id) {
      toast({
        title: pt ? "Plano indisponível" : "Plan unavailable",
        description: pt ? "Este plano ainda não está configurado para pagamento." : "This plan is not set up for payment yet.",
        variant: "destructive",
      });
      return;
    }

    setLoadingPlan(plan.slug);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: plan.stripe_price_id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManage = async () => {
    setLoadingPlan("manage");
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <>
      <Seo
        title={pt ? "Planos para Corretores e Imobiliárias | Abitzo" : "Plans for Brokers and Agencies | Abitzo"}
        description={pt
          ? "Escolha o plano ideal para corretores e imobiliárias. Anúncios ilimitados, gestão de vendas, locação e muito mais."
          : "Choose the right plan for brokers and agencies. Unlimited listings, sales management, rentals and more."}
        canonical="/planos"
      />
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
              {pt ? `Plano atual: ${currentPlan?.name ?? currentTier}` : `Current plan: ${currentPlan?.name ?? currentTier}`}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleManage} disabled={loadingPlan === "manage"}>
              {loadingPlan === "manage" ? <Loader2 className="h-4 w-4 animate-spin" /> : pt ? "Gerenciar assinatura" : "Manage subscription"}
            </Button>
            <Button variant="ghost" size="sm" onClick={refreshSubscription}>
              {pt ? "Atualizar status" : "Refresh status"}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => {
            const isCurrent = currentTier === plan.slug;
            const isUpgrade = currentIndex === -1 ? plan.price_cents > 0 : i > currentIndex;
            const isFree = plan.price_cents === 0;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${isCurrent ? "border-primary ring-2 ring-primary/20" : ""} ${plan.highlighted ? "border-primary/50" : ""}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    {pt ? "Seu plano" : "Your plan"}
                  </Badge>
                )}
                {plan.highlighted && !isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                    {pt ? "Mais popular" : "Most popular"}
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-2xl font-bold text-foreground">
                    {formatPlanPrice(plan.price_cents, locale)}
                  </CardDescription>
                  {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="mb-6 flex-1 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {isFree ? (
                    <Button className="w-full" onClick={() => navigate("/cadastro")} disabled={isCurrent && !!user}>
                      {pt ? "Criar conta" : "Create account"}
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      {pt ? "Plano ativo" : "Active plan"}
                    </Button>
                  ) : isUpgrade ? (
                    <Button className="w-full" onClick={() => handleSubscribe(plan)} disabled={!!loadingPlan}>
                      {loadingPlan === plan.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : pt ? "Assinar" : "Subscribe"}
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
      )}
    </div>
  </>
  );
};

export default Plans;
