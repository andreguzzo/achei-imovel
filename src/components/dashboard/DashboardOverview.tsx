import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, Users, CalendarDays, FileText, Handshake, Building2, DollarSign, Plus, ArrowRight, Clock, Mail,
  KeyRound, Receipt, TrendingUp, ShieldAlert,
} from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import {
  authorizationLabel,
  authorizationStatus,
  authorizationBadgeText,
  formatDateBr,
} from "@/lib/saleAuthorization";
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

interface RentalContractRow {
  id: string;
  status: string;
  end_date: string;
  next_adjustment_date: string | null;
  rent_amount: number;
  admin_fee_percent: number;
}

interface RentalChargeRow {
  id: string;
  status: string;
  due_date: string;
  total_amount: number;
}

interface FollowUpDeal {
  id: string;
  client_name: string;
  next_action: string | null;
  next_action_date: string | null;
  last_activity_at: string | null;
  created_at: string;
}

interface FollowUps {
  overdue: FollowUpDeal[];
  today: FollowUpDeal[];
  week: FollowUpDeal[];
  stalled: FollowUpDeal[];
}

interface ExpiringAuth {
  property_id: string;
  title: string;
  reference_code: string | null;
  authorization_type: string | null;
  authorization_end: string;
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
  const [expiringAuths, setExpiringAuths] = useState<ExpiringAuth[]>([]);
  const [followUps, setFollowUps] = useState<FollowUps>({ overdue: [], today: [], week: [], stalled: [] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const [pipelineRes, apptRes, contactsRes, propsRes, myMembersRes, contractsRes, chargesRes] = await Promise.all([
      supabase
        .from("sales_pipeline")
        .select("id, stage, commission_value, client_name, next_action, next_action_date, last_activity_at, created_at")
        .eq("broker_id", userId),
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
        : Promise.resolve({ data: [] as RentalContractRow[] }),
      isBroker
        ? supabase
            .from("rental_charges")
            .select("id, status, due_date, total_amount")
            .eq("broker_id", userId)
            .eq("status", "pending")
        : Promise.resolve({ data: [] as RentalChargeRow[] }),
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

    const rentalContracts = (contractsRes.data ?? []) as RentalContractRow[];
    const pendingCharges = (chargesRes.data ?? []) as RentalChargeRow[];
    const runningContracts = rentalContracts.filter((c) => c.status === "active" || c.status === "notice");
    const overdueCharges = pendingCharges.filter((c) => c.due_date < today);

    setCounts({
      leads: pipeline.filter((p) => p.stage === "lead").length,
      contacts: contacts.length,
      proposals: pipeline.filter((p) => ["proposal", "negotiation"].includes(p.stage)).length,
      partnerships,
      activeListings: props.filter((p) => p.status === "active").length,
      commission: soldCommission + pipelineCommission,
      rentalActive: runningContracts.length,
      rentalDueSoon: pendingCharges.filter((c) => c.due_date >= today && c.due_date <= in30).length,
      rentalOverdue: overdueCharges.length,
      rentalOverdueAmount: overdueCharges.reduce((acc, c) => acc + Number(c.total_amount), 0),
      rentalRevenue: runningContracts.reduce(
        (acc, c) => acc + (Number(c.rent_amount) * Number(c.admin_fee_percent)) / 100,
        0,
      ),
      contractsEnding: runningContracts.filter((c) => c.end_date <= in90).length,
      adjustmentsDue: runningContracts.filter(
        (c) => c.next_adjustment_date && c.next_adjustment_date <= in30,
      ).length,
    });
    // Private sale authorizations expiring soon (broker-only data)
    const { data: authRows } = await supabase
      .from("property_private_data")
      .select("property_id, authorization_type, authorization_end, properties:property_id!inner(title, reference_code, user_id)")
      .eq("properties.user_id", userId)
      .not("authorization_end", "is", null)
      .lte("authorization_end", in30)
      .order("authorization_end", { ascending: true })
      .limit(10);

    setExpiringAuths(
      (authRows ?? []).map((r) => {
        const prop = r.properties as unknown as { title: string; reference_code: string | null };
        return {
          property_id: r.property_id,
          title: prop?.title ?? "",
          reference_code: prop?.reference_code ?? null,
          authorization_type: r.authorization_type,
          authorization_end: r.authorization_end as string,
        };
      }),
    );

    // Follow-ups: open deals grouped by next action date, plus stalled ones
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const stalledLimit = new Date(Date.now() - 15 * 86400000).toISOString();
    const openDeals: FollowUpDeal[] = pipeline
      .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
      .map((d) => ({
        id: d.id,
        client_name: d.client_name,
        next_action: d.next_action,
        next_action_date: d.next_action_date,
        last_activity_at: d.last_activity_at,
        created_at: d.created_at,
      }));
    const byDate = (a: FollowUpDeal, b: FollowUpDeal) =>
      (a.next_action_date ?? "").localeCompare(b.next_action_date ?? "");

    setFollowUps({
      overdue: openDeals.filter((d) => d.next_action_date && d.next_action_date < today).sort(byDate),
      today: openDeals.filter((d) => d.next_action_date === today),
      week: openDeals
        .filter((d) => d.next_action_date && d.next_action_date > today && d.next_action_date <= in7)
        .sort(byDate),
      stalled: openDeals.filter((d) => (d.last_activity_at ?? d.created_at) < stalledLimit).slice(0, 10),
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
    { label: pt ? "Propostas em aberto" : "Open proposals", value: counts.proposals, icon: FileText, section: "negociacoes" },
    { label: pt ? "Parcerias pendentes" : "Pending partnerships", value: counts.partnerships, icon: Handshake, section: "parcerias" },
    { label: pt ? "Anúncios ativos" : "Active listings", value: counts.activeListings, icon: Building2, section: "imoveis" },
    { label: pt ? "Comissão realizada" : "Earned commission", value: brl(counts.commission), icon: DollarSign, section: "relatorios" },
    { label: pt ? "Locações administradas" : "Managed rentals", value: counts.rentalActive, icon: KeyRound, section: "contratos" },
    { label: pt ? "Aluguéis a vencer (30 dias)" : "Rent due (30 days)", value: counts.rentalDueSoon, icon: Receipt, section: "alugueis" },
    { label: pt ? "Receita de administração / mês" : "Management revenue / month", value: brl(counts.rentalRevenue), icon: TrendingUp, section: "relatorios_locacao" },
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
    counts.rentalOverdue > 0 && {
      label: pt
        ? `${counts.rentalOverdue} aluguéis em atraso`
        : `${counts.rentalOverdue} rent charges overdue`,
      hint: pt ? `Total de ${brl(counts.rentalOverdueAmount)}` : `${brl(counts.rentalOverdueAmount)} total`,
      section: "alugueis" as DashboardSection,
      icon: Receipt,
    },
    counts.contractsEnding > 0 && {
      label: pt
        ? `${counts.contractsEnding} contratos vencendo em 90 dias`
        : `${counts.contractsEnding} contracts ending within 90 days`,
      hint: pt ? "Fale com inquilino e proprietário sobre a renovação." : "Talk to tenant and owner about renewal.",
      section: "contratos" as DashboardSection,
      icon: KeyRound,
    },
    counts.adjustmentsDue > 0 && {
      label: pt
        ? `${counts.adjustmentsDue} reajustes a aplicar`
        : `${counts.adjustmentsDue} rent adjustments to apply`,
      section: "contratos" as DashboardSection,
      icon: TrendingUp,
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

      {isBroker && (followUps.overdue.length + followUps.today.length + followUps.week.length + followUps.stalled.length) > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" />
              Follow-ups
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("negociacoes")}>
              {pt ? "Ver negociações" : "View deals"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {([
              { key: "overdue", title: pt ? "Atrasados" : "Overdue", tone: "text-destructive", list: followUps.overdue },
              { key: "today", title: pt ? "Hoje" : "Today", tone: "text-primary", list: followUps.today },
              { key: "week", title: pt ? "Próximos 7 dias" : "Next 7 days", tone: "text-foreground", list: followUps.week },
              { key: "stalled", title: pt ? "Paradas (15+ dias sem contato)" : "Stalled (15+ days no contact)", tone: "text-amber-600", list: followUps.stalled },
            ] as const)
              .filter((g) => g.list.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${g.tone}`}>
                    {g.title} · {g.list.length}
                  </p>
                  <div className="divide-y divide-border">
                    {g.list.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{d.client_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {g.key === "stalled"
                              ? pt
                                ? `Sem interação desde ${formatDateBr((d.last_activity_at ?? d.created_at).slice(0, 10))}`
                                : `No interaction since ${formatDateBr((d.last_activity_at ?? d.created_at).slice(0, 10))}`
                              : [d.next_action, d.next_action_date ? formatDateBr(d.next_action_date) : null]
                                  .filter(Boolean)
                                  .join(" • ") || (pt ? "Sem descrição" : "No description")}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onNavigate("negociacoes")}>
                          {pt ? "Abrir" : "Open"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {isBroker && expiringAuths.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              {pt ? "Autorizações a vencer" : "Authorizations expiring"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("imoveis")}>
              {pt ? "Ver anúncios" : "View listings"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {expiringAuths.map((a) => {
                const { status, days } = authorizationStatus(a.authorization_end);
                const badge = authorizationBadgeText(status, days, pt);
                return (
                  <div key={a.property_id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          a.reference_code ? `${pt ? "Cód." : "Ref."} ${a.reference_code}` : null,
                          a.authorization_type ? authorizationLabel(a.authorization_type, pt) : null,
                          `${pt ? "até" : "until"} ${formatDateBr(a.authorization_end)}`,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        status === "expired"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      }`}
                    >
                      {badge}
                    </span>
                    <Link to={`/editar/${a.property_id}`}>
                      <Button size="sm" variant="outline">{pt ? "Abrir" : "Open"}</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardOverview;
