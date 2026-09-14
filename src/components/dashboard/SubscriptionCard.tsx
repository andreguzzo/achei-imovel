import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIERS, type TierKey } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Crown, CreditCard, ArrowUpRight, RefreshCw, Loader2, Sparkles, Receipt, CalendarClock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const tierDetails: Record<TierKey, { name: string; priceLabel: string; color: string }> = {
  free: { name: "Gratuito", priceLabel: "R$ 0/mês", color: "bg-muted text-muted-foreground" },
  basic: { name: TIERS.basic.name, priceLabel: TIERS.basic.priceLabel, color: "bg-blue-100 text-blue-800" },
  pro: { name: TIERS.pro.name, priceLabel: TIERS.pro.priceLabel, color: "bg-purple-100 text-purple-800" },
  premium: { name: TIERS.premium.name, priceLabel: TIERS.premium.priceLabel, color: "bg-amber-100 text-amber-800" },
};

interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  invoice_url: string | null;
  description: string | null;
}

interface UpcomingInvoice {
  amount: number;
  currency: string;
  due_date: string;
}

const SubscriptionCard = () => {
  const { tier, planSlug, subscribed, subscriptionEnd, refreshSubscription, checkingSubscription } = useAuth();
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [upcomingInvoice, setUpcomingInvoice] = useState<UpcomingInvoice | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const planDetails: Record<string, { name: string; priceLabel: string; color: string }> = {
    ...tierDetails,
    corretor: { name: "Corretor", priceLabel: "R$ 79,90/mês", color: "bg-blue-100 text-blue-800" },
    imobiliaria: { name: "Imobiliária", priceLabel: "R$ 159,90/mês", color: "bg-amber-100 text-amber-800" },
  };
  const activeSlug = planSlug ?? tier;
  const details = planDetails[activeSlug] ?? tierDetails.free;
  const isPaid = subscribed && activeSlug !== "free";

  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const dateFmt = (iso: string) =>
    new Date(iso).toLocaleDateString(pt ? "pt-BR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  // Fetch payment history on mount (for paid users)
  useEffect(() => {
    if (!isPaid) return;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data) {
          setPaymentHistory(data.payment_history ?? []);
          setUpcomingInvoice(data.upcoming_invoice ?? null);
        }
      } catch (_) {
        // Silently fail, main subscription data is already loaded via auth
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [isPaid]);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: unknown) {
      toast({ title: pt ? "Erro" : "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setLoadingPortal(false);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      paid: { label: pt ? "Pago" : "Paid", className: "bg-green-100 text-green-800" },
      open: { label: pt ? "Aberto" : "Open", className: "bg-yellow-100 text-yellow-800" },
      void: { label: pt ? "Cancelado" : "Voided", className: "bg-muted text-muted-foreground" },
      uncollectible: { label: pt ? "Não cobrado" : "Uncollectible", className: "bg-red-100 text-red-800" },
      draft: { label: pt ? "Rascunho" : "Draft", className: "bg-muted text-muted-foreground" },
    };
    return map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  };

  const visiblePayments = showAllPayments ? paymentHistory : paymentHistory.slice(0, 3);

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

        {/* Upcoming invoice / Next due date */}
        {isPaid && (upcomingInvoice || subscriptionEnd) && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <CalendarClock className="h-3.5 w-3.5" />
              {pt ? "Próximo Vencimento" : "Next Due Date"}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {dateFmt(upcomingInvoice?.due_date ?? subscriptionEnd!)}
              </p>
              {upcomingInvoice && (
                <p className="text-sm font-bold text-foreground">
                  {fmt.format(upcomingInvoice.amount)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment History */}
        {isPaid && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  {pt ? "Histórico de Pagamentos" : "Payment History"}
                </h3>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {pt ? "Nenhum pagamento registrado." : "No payments recorded."}
                </p>
              ) : (
                <div className="space-y-2">
                  {visiblePayments.map((payment) => {
                    const s = statusLabel(payment.status ?? "");
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">
                              {fmt.format(payment.amount)}
                            </p>
                            <Badge className={`text-[10px] shrink-0 ${s.className}`}>
                              {s.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {dateFmt(payment.date)}
                            {payment.description && ` · ${payment.description}`}
                          </p>
                        </div>
                        {payment.invoice_url && (
                          <a
                            href={payment.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 ml-2"
                          >
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </a>
                        )}
                      </div>
                    );
                  })}

                  {paymentHistory.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs gap-1"
                      onClick={() => setShowAllPayments(!showAllPayments)}
                    >
                      {showAllPayments
                        ? (pt ? "Ver menos" : "Show less")
                        : (pt ? `Ver todos (${paymentHistory.length})` : `Show all (${paymentHistory.length})`)}
                      {showAllPayments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
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
