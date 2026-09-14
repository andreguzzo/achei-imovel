import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Menu } from "lucide-react";
import DashboardSidebar, { useDashboardNav, type DashboardSection } from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardProperties from "@/components/dashboard/DashboardProperties";
import DashboardProfile from "@/components/dashboard/DashboardProfile";
const SalesPipeline = lazy(() => import("@/components/dashboard/SalesPipeline"));
import SalesContacts from "@/components/dashboard/SalesContacts";
import BrokerAgenda from "@/components/dashboard/BrokerAgenda";
import BrokerProposals from "@/components/dashboard/BrokerProposals";
const BrokerAnalytics = lazy(() => import("@/components/dashboard/BrokerAnalytics"));
import PropertyPartnerships from "@/components/dashboard/PropertyPartnerships";
import SubscriptionCard from "@/components/dashboard/SubscriptionCard";
import SupportForm from "@/components/dashboard/SupportForm";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import RentalContracts from "@/components/dashboard/rental/RentalContracts";
import RentalCharges from "@/components/dashboard/rental/RentalCharges";
import RentalInspections from "@/components/dashboard/rental/RentalInspections";
import RentalReports from "@/components/dashboard/rental/RentalReports";
import RentalBilling from "@/components/dashboard/rental/RentalBilling";
import IdentityVerification from "@/components/dashboard/IdentityVerification";
import AgencyTeam from "@/components/dashboard/AgencyTeam";
import type { Tables } from "@/integrations/supabase/types";

const VALID_SECTIONS: DashboardSection[] = [
  "inicio", "negociacoes", "contatos", "propostas", "agenda",
  "imoveis", "parcerias", "relatorios", "perfil", "assinatura", "suporte",
  "contratos", "alugueis", "vistorias", "relatorios_locacao", "cobranca_locacao",
  "verificacao", "equipe",
];

const ChartSkeleton = () => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-72 w-full rounded-lg" />
  </div>
);



const Dashboard = () => {
  const { locale } = useLanguage();
  const { user, loading: authLoading, accountType } = useAuth();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";

  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [isBroker, setIsBroker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newLeads, setNewLeads] = useState(0);

  const rawSection = searchParams.get("secao") as DashboardSection | null;
  const section: DashboardSection =
    rawSection && VALID_SECTIONS.includes(rawSection) ? rawSection : "inicio";

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    setProfile(data ?? null);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const load = async () => {
      setLoading(true);
      const [profileRes, brokerRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.rpc("has_role", { _user_id: user.id, _role: "broker" }),
      ]);
      setProfile(profileRes.data ?? null);
      setIsBroker(!!brokerRes.data);
      setLoading(false);
    };
    load();
  }, [user, authLoading, navigate]);

  const goToSection = useCallback((next: DashboardSection) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("secao", next);
      return params;
    });
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadLeads = async () => {
      const { count } = await supabase
        .from("contact_requests")
        .select("id", { count: "exact", head: true })
        .eq("broker_id", user.id)
        .eq("status", "new");
      if (!cancelled) setNewLeads(count ?? 0);
    };
    loadLeads();
    return () => { cancelled = true; };
  }, [user, section]);

  const badges = useMemo(() => ({ contatos: newLeads }), [newLeads]);
  const groups = useDashboardNav(badges);

  const activeLabel = useMemo(() => {
    for (const g of groups) {
      const found = g.items.find((i) => i.key === section);
      if (found) return found.label;
    }
    return "";
  }, [groups, section]);

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return null;

  // Non-brokers only get the general sections
  const effectiveSection: DashboardSection =
    !isBroker && [
      "negociacoes", "contatos", "propostas", "agenda", "parcerias", "relatorios",
      "contratos", "alugueis", "vistorias", "relatorios_locacao", "cobranca_locacao",
    ].includes(section)
      ? "imoveis"
      : section;

  const brokerInfo = {
    name: profile?.commercial_name || profile?.full_name || "",
    creci: profile?.creci ?? "",
    phone: profile?.whatsapp || profile?.phone || "",
  };

  const renderSection = () => {
    switch (effectiveSection) {
      case "inicio":
        return (
          <DashboardOverview
            userId={user.id}
            isBroker={isBroker}
            firstName={(profile?.full_name ?? "").split(" ")[0] ?? ""}
            onNavigate={goToSection}
          />
        );
      case "negociacoes":
        return (
          <Suspense fallback={<ChartSkeleton />}>
            <SalesPipeline userId={user.id} />
          </Suspense>
        );
      case "contatos":
        return <SalesContacts userId={user.id} />;
      case "propostas":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Propostas" : "Proposals"}
              description={pt ? "Registre e acompanhe propostas enviadas aos clientes." : "Create and track proposals sent to clients."}
            />
            <BrokerProposals userId={user.id} />
          </div>
        );
      case "agenda":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Visitas e compromissos" : "Visits & appointments"}
              description={pt ? "Organize suas visitas, reuniões e lembretes." : "Organize visits, meetings and reminders."}
            />
            <BrokerAgenda userId={user.id} />
          </div>
        );
      case "imoveis":
        return <DashboardProperties userId={user.id} isBroker={isBroker} broker={brokerInfo} />;
      case "parcerias":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Parcerias" : "Partnerships"}
              description={pt ? "Solicitações recebidas, enviadas e parcerias ativas por imóvel." : "Requests received, sent and active partnerships per property."}
            />
            <PropertyPartnerships userId={user.id} />
          </div>
        );
      case "contratos":
        return <RentalContracts userId={user.id} />;
      case "alugueis":
        return <RentalCharges userId={user.id} />;
      case "vistorias":
        return <RentalInspections userId={user.id} />;
      case "relatorios_locacao":
        return <RentalReports userId={user.id} />;
      case "cobranca_locacao":
        return <RentalBilling userId={user.id} />;
      case "relatorios":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Relatórios" : "Reports"}
              description={pt ? "VGV ativo, VGV realizado, comissões e desempenho dos anúncios." : "Active and closed sales volume, commissions and listing performance."}
            />
            <Suspense fallback={<ChartSkeleton />}>
              <BrokerAnalytics userId={user.id} />
            </Suspense>
          </div>
        );
      case "perfil":
        return (
          <DashboardProfile
            userId={user.id}
            email={user.email ?? ""}
            isBroker={isBroker}
            profile={profile}
            onProfileSaved={fetchProfile}
          />
        );
      case "assinatura":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Assinatura" : "Subscription"}
              description={pt ? "Seu plano atual, limites e forma de pagamento." : "Your current plan, limits and billing."}
            />
            <SubscriptionCard />
          </div>
        );
      case "suporte":
        return (
          <div className="space-y-6">
            <SectionHeader
              title={pt ? "Suporte" : "Support"}
              description={pt ? "Abra um chamado e acompanhe as respostas da equipe." : "Open a ticket and follow up with our team."}
            />
            <SupportForm />
          </div>
        );
      case "verificacao":
        return <IdentityVerification userId={user.id} />;
      case "equipe":
        return <AgencyTeam userId={user.id} />;
      default:
        return null;
    }
  };

  const sidebar = (mobile = false) => (
    <DashboardSidebar
      groups={groups}
      active={effectiveSection}
      onSelect={goToSection}
      isBroker={isBroker}
      isProfessional={accountType !== "owner"}
      isAgency={accountType === "agency"}
      collapsed={mobile ? false : collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
    />
  );

  return (
    <div className="container py-6">
      <div className="mb-4 flex items-center gap-3 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Menu className="h-4 w-4" /> {pt ? "Seções" : "Sections"}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <p className="mb-4 font-display text-lg font-semibold">{pt ? "Meu painel" : "My dashboard"}</p>
            {sidebar(true)}
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm text-muted-foreground">{activeLabel}</span>
      </div>

      <div className="flex gap-8">
        <aside className="hidden shrink-0 lg:block">
          <div className="sticky top-24">{sidebar()}</div>
        </aside>
        <main className="min-w-0 flex-1">{renderSection()}</main>
      </div>
    </div>
  );
};

export default Dashboard;
