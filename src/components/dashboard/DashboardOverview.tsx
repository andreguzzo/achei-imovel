import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Users, CalendarDays, FileText, Handshake, Building2, DollarSign, Plus, ArrowRight, Clock, Mail,
  KeyRound, Receipt, TrendingUp,
} from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import type { DashboardSection } from "@/components/dashboard/DashboardSidebar";

interface Props {
  userId: string;
  isBroker: boolean;
  firstName: string;
  onNavigate: (section: DashboardSection) => void;
}

interface Appointment {
  id: string;
  title: string;
  start_time: string | null;
  client_name: string | null;
  client_phone: string | null;
  location: string | null;
}

interface Counts {
  leads: number;
  contacts: number;
  proposals: number;
  partnerships: number;
  activeListings: number;
  commission: number;
  rentalActive: number;
  rentalDueSoon: number;
  rentalOverdue: number;
  rentalOverdueAmount: number;
  rentalRevenue: number;
  contractsEnding: number;
  adjustmentsDue: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const DashboardOverview = ({ userId, isBroker, firstName, onNavigate }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({
    leads: 0, contacts: 0, proposals: 0, partnerships: 0, activeListings: 0, commission: 0,
    rentalActive: 0, rentalDueSoon: 0, rentalOverdue: 0, rentalOverdueAmount: 0,
    rentalRevenue: 0, contractsEnding: 0, adjustmentsDue: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [staleContacts, setStaleContacts] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const [pipelineRes, apptRes, contactsRes, propsRes, myMembersRes, contractsRes, chargesRes] = await Promise.all([
      supabase.from("sales_pipeline").select("id, stage, commission_value").eq("broker_id", userId),
      supabase
        .from("broker_appointments")
        .select("id, title, start_time, client_name, client_phone, location")
        .eq("broker_id", userId)
        .eq("appointment_date", today)
        .eq("completed", false)
        .order("start_time"),
      supabase
        .from("contact_requests")
        .select("id, created_at, properties:property_id!inner(user_id)")
        .eq("properties.user_id", userId)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("properties").select("id, status, sold_commission").eq("user_id", userId),
      isBroker
        ? supabase.from("property_group_members").select("group_id, role").eq("broker_id", userId)
        : Promise.resolve({ data: [] as { group_id: string; role: string }[] }),
      isBroker
        ? supabase
            .from("rental_contracts")
            .select("id, status, end_date, next_adjustment_date, rent_amount, admin_fee_percent")
            .eq("broker_id", userId)
        : Promise.resolve({ data: [] as null }),
      isBroker
        ? supabase
            .from("rental_charges")
            .select("id, status, due_date, total_amount")
            .eq("broker_id", userId)
            .eq("status", "pending")
        : Promise.resolve({ data: [] as null }),
    ]);

    const pipeline = pipelineRes.data ?? [];
    const props = propsRes.data ?? [];
    const contacts = contactsRes.data ?? [];

    let partnerships = 0;
    const captadorGroups = (myMembersRes.data ?? [])
      .filter((m) => m.role === "captador")
      .map((m) => m.group_id);
    if (captadorGroups.length > 0) {
      const { data: pending } = await supabase
        .from("property_group_members")
        .select("id, broker_id, status")
        .in("group_id", captadorGroups)
        .eq("status", "pending");
      partnerships = (pending ?? []).filter((p) => p.broker_id !== userId).length;
    }

    const soldCommission = props
      .filter((p) => p.status === "sold")
      .reduce((acc, p) => acc + (p.sold_commission ?? 0), 0);
    const pipelineCommission = pipeline
      .filter((p) => p.stage === "closed_won")
      .reduce((acc, p) => acc + (p.commission_value ?? 0), 0);

    setCounts({
      leads: pipeline.filter((p) => p.stage === "lead").length,
      contacts: contacts.length,
      proposals: pipeline.filter((p) => ["proposal", "negotiation"].includes(p.stage)).length,
      partnerships,
      activeListings: props.filter((p) => p.status === "active").length,
      commission: soldCommission + pipelineCommission,
    });
    setStaleContacts(contacts.filter((c) => c.created_at >= weekAgo).length);
    setTodayAppointments((apptRes.data as Appointment[]) ?? []);
    setLoading(false);
  }, [userId, isBroker]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const kpis: { label: string; value: string | number; icon: typeof Users; section: DashboardSection }[] = [
    { label: pt ? "Leads novos" : "New leads", value: counts.leads, icon: Users, section: "negociacoes" },
    { label: pt ? "Visitas hoje" : "Visits today", value: todayAppointments.length, icon: CalendarDays, section: "agenda" },
    { label: pt ? "Propostas em aberto" : "Open proposals", value: counts.proposals, icon: FileText, section: "propostas" },
    { label: pt ? "Parcerias pendentes" : "Pending partnerships", value: counts.partnerships, icon: Handshake, section: "parcerias" },
    { label: pt ? "Anúncios ativos" : "Active listings", value: counts.activeListings, icon: Building2, section: "imoveis" },
    { label: pt ? "Comissão realizada" : "Earned commission", value: brl(counts.commission), icon: DollarSign, section: "relatorios" },
  ];

  const visibleKpis = isBroker ? kpis : kpis.filter((k) => k.section === "imoveis");

  const attention = [
    counts.contacts > 0 && {
      label: pt ? `${counts.contacts} contatos recebidos` : `${counts.contacts} contacts received`,
      hint: pt
        ? staleContacts > 0 ? `${staleContacts} nos últimos 7 dias` : undefined
        : staleContacts > 0 ? `${staleContacts} in the last 7 days` : undefined,
      section: "contatos" as DashboardSection,
      icon: Mail,
    },
    counts.proposals > 0 && {
      label: pt ? `${counts.proposals} propostas aguardando resposta` : `${counts.proposals} proposals awaiting reply`,
      section: "propostas" as DashboardSection,
      icon: FileText,
    },
    counts.partnerships > 0 && {
      label: pt ? `${counts.partnerships} solicitações de parceria para aprovar` : `${counts.partnerships} partnership requests to approve`,
      section: "parcerias" as DashboardSection,
      icon: Handshake,
    },
  ].filter(Boolean) as { label: string; hint?: string; section: DashboardSection; icon: typeof Mail }[];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? `Olá${firstName ? `, ${firstName}` : ""}` : `Hello${firstName ? `, ${firstName}` : ""}`}
        description={pt ? "Este é o resumo do seu dia." : "Here is your day at a glance."}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/anunciar">
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Anunciar imóvel" : "List property"}</Button>
            </Link>
            {isBroker && (
              <>
                <Button size="sm" variant="outline" onClick={() => onNavigate("negociacoes")}>
                  {pt ? "Novo lead" : "New lead"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => onNavigate("agenda")}>
                  {pt ? "Agendar visita" : "Schedule visit"}
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleKpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.section)}
            className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <div className="flex items-center gap-2">
                <kpi.icon className="h-4 w-4" />
                <p className="text-xs">{kpi.label}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">{kpi.value}</p>
          </button>
        ))}
      </div>

      {isBroker && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{pt ? "Sua agenda de hoje" : "Today's schedule"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("agenda")}>
                {pt ? "Ver agenda" : "Open calendar"}
              </Button>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-7 w-7" />}
                  title={pt ? "Nenhum compromisso para hoje" : "Nothing scheduled today"}
                  action={
                    <Button size="sm" variant="outline" onClick={() => onNavigate("agenda")}>
                      {pt ? "Agendar visita" : "Schedule visit"}
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-border">
                  {todayAppointments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 py-3">
                      <div className="flex w-16 shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        {a.start_time?.slice(0, 5) ?? "--:--"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[a.client_name, a.location].filter(Boolean).join(" • ") || "—"}
                        </p>
                      </div>
                      {a.client_phone && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={`https://wa.me/${a.client_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{pt ? "Precisa de atenção" : "Needs attention"}</CardTitle>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <EmptyState
                  title={pt ? "Tudo em ordem" : "All clear"}
                  description={pt ? "Nenhuma pendência no momento." : "Nothing pending right now."}
                />
              ) : (
                <div className="divide-y divide-border">
                  {attention.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => onNavigate(a.section)}
                      className="flex w-full items-center gap-3 py-3 text-left hover:text-primary"
                    >
                      <a.icon className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.label}</p>
                        {a.hint && <p className="text-xs text-muted-foreground">{a.hint}</p>}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
