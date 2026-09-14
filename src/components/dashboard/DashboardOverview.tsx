import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, CalendarDays, Plus, ArrowRight, Clock, Mail,
  Receipt, ShieldAlert, CheckCircle2, MessageCircle,
} from "lucide-react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import {
  authorizationLabel,
  authorizationStatus,
  authorizationBadgeText,
  formatDateBr,
} from "@/lib/saleAuthorization";
import type { DashboardSection } from "@/components/dashboard/DashboardSidebar";
import { buildWhatsAppUrl } from "@/lib/phone";

interface Props {
  userId: string;
  isBroker: boolean;
  firstName: string;
  onNavigate: (section: DashboardSection) => void;
}

interface Appointment {
  id: string;
  title: string;
  appointment_date: string;
  start_time: string | null;
  client_name: string | null;
  client_phone: string | null;
  location: string | null;
  completed: boolean;
}

interface LeadRow {
  id: string;
  name: string;
  phone: string;
  status: string;
  created_at: string;
}

interface DealRow {
  id: string;
  stage: string;
  client_name: string;
  client_phone: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

interface PropertyRow {
  id: string;
  status: string;
  price: number;
  sold_at: string | null;
  closed_price: number | null;
}

interface ChargeRow {
  id: string;
  due_date: string;
  total_amount: number;
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

const waLink = (phone: string | null | undefined) => buildWhatsAppUrl(phone);

const DashboardOverview = ({ userId, isBroker, firstName, onNavigate }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [weekAppointments, setWeekAppointments] = useState<Appointment[]>([]);
  const [expiringAuths, setExpiringAuths] = useState<ExpiringAuth[]>([]);
  const [dueCharges, setDueCharges] = useState<ChargeRow[]>([]);
  const [monthStats, setMonthStats] = useState({ leads: 0, openDeals: 0, closings: 0, vgv: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [leadsRes, pipelineRes, apptRes, propsRes, chargesRes, authRes] = await Promise.all([
      supabase
        .from("contact_requests")
        .select("id, name, phone, status, created_at, properties:property_id!inner(user_id)")
        .eq("properties.user_id", userId)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("sales_pipeline")
        .select("id, stage, client_name, client_phone, next_action, next_action_date, created_at")
        .eq("broker_id", userId),
      supabase
        .from("broker_appointments")
        .select("id, title, appointment_date, start_time, client_name, client_phone, location, completed")
        .eq("broker_id", userId)
        .gte("appointment_date", today)
        .lte("appointment_date", in7)
        .order("appointment_date")
        .order("start_time"),
      supabase
        .from("properties")
        .select("id, status, price, sold_at, closed_price")
        .eq("user_id", userId),
      isBroker
        ? supabase
            .from("rental_charges")
            .select("id, due_date, total_amount")
            .eq("broker_id", userId)
            .eq("status", "pending")
            .gte("due_date", today)
            .lte("due_date", in7)
            .order("due_date")
        : Promise.resolve({ data: [] as ChargeRow[] }),
      isBroker
        ? supabase
            .from("property_private_data")
            .select("property_id, authorization_type, authorization_end, properties:property_id!inner(title, reference_code, user_id)")
            .eq("properties.user_id", userId)
            .not("authorization_end", "is", null)
            .gte("authorization_end", today)
            .lte("authorization_end", in30)
            .order("authorization_end", { ascending: true })
            .limit(10)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const leadRows = (leadsRes.data ?? []) as unknown as LeadRow[];
    const dealRows = (pipelineRes.data ?? []) as DealRow[];
    const propRows = (propsRes.data ?? []) as PropertyRow[];

    setLeads(leadRows);
    setDeals(dealRows);
    setWeekAppointments((apptRes.data as Appointment[]) ?? []);
    setDueCharges((chargesRes.data ?? []) as ChargeRow[]);
    setExpiringAuths(
      ((authRes.data ?? []) as {
        property_id: string;
        authorization_type: string | null;
        authorization_end: string;
        properties: { title: string; reference_code: string | null };
      }[]).map((r) => ({
        property_id: r.property_id,
        title: r.properties?.title ?? "",
        reference_code: r.properties?.reference_code ?? null,
        authorization_type: r.authorization_type,
        authorization_end: r.authorization_end,
      })),
    );

    const closedThisMonth = propRows.filter(
      (p) => (p.status === "sold" || p.status === "rented") && p.sold_at && p.sold_at.slice(0, 10) >= monthStart,
    );
    setMonthStats({
      leads: leadRows.filter((l) => l.created_at.slice(0, 10) >= monthStart).length,
      openDeals: dealRows.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length,
      closings: closedThisMonth.length,
      vgv: closedThisMonth.reduce((acc, p) => acc + Number(p.closed_price ?? p.price ?? 0), 0),
    });
    setLoading(false);
  }, [userId, isBroker]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const unansweredLeads = leads.filter((l) => l.status === "new" || l.status === "contacted");
  const overdueFollowUps = deals
    .filter((d) => !["closed_won", "closed_lost"].includes(d.stage) && d.next_action_date && d.next_action_date < today)
    .sort((a, b) => (a.next_action_date ?? "").localeCompare(b.next_action_date ?? ""));
  const todayAppointments = weekAppointments.filter((a) => a.appointment_date === today);
  const unconfirmedToday = todayAppointments.filter((a) => !a.completed);
  const weekFollowUps = deals
    .filter(
      (d) =>
        !["closed_won", "closed_lost"].includes(d.stage) &&
        d.next_action_date &&
        d.next_action_date >= today &&
        d.next_action_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    )
    .sort((a, b) => (a.next_action_date ?? "").localeCompare(b.next_action_date ?? ""));
  const futureAppointments = weekAppointments.filter((a) => a.appointment_date > today);

  const needsNow = unansweredLeads.length + overdueFollowUps.length + unconfirmedToday.length > 0;
  const hasWeek =
    weekFollowUps.length + futureAppointments.length + expiringAuths.length + dueCharges.length > 0;

  const monthKpis: { label: string; value: string | number; section: DashboardSection }[] = [
    { label: pt ? "Leads recebidos" : "Leads received", value: monthStats.leads, section: "atendimentos" },
    { label: pt ? "Negociações abertas" : "Open deals", value: monthStats.openDeals, section: "atendimentos" },
    { label: pt ? "Fechamentos" : "Closings", value: monthStats.closings, section: "desempenho" },
    { label: pt ? "VGV" : "Sales volume", value: brl(monthStats.vgv), section: "desempenho" },
  ];

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
                <Button size="sm" variant="outline" onClick={() => onNavigate("atendimentos")}>
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

      {/* 1. Precisa de você agora */}
      {isBroker && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {pt ? "Precisa de você agora" : "Needs you now"}
          </h2>
          {!needsNow ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {pt ? "Tudo em dia por aqui." : "You're all caught up."}
            </p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0 px-4">
                {unansweredLeads.map((l) => (
                  <div key={`lead-${l.id}`} className="flex items-center gap-3 py-3">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pt ? "Lead aguardando resposta" : "Lead awaiting reply"} · {formatDateBr(l.created_at.slice(0, 10))}
                      </p>
                    </div>
                    {waLink(l.phone) && (
                      <Button asChild size="sm" variant="ghost" className="gap-1">
                        <a href={waLink(l.phone)!} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onNavigate("atendimentos")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
                {overdueFollowUps.map((d) => (
                  <div key={`deal-${d.id}`} className="flex items-center gap-3 py-3">
                    <Clock className="h-4 w-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{d.client_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[d.next_action, d.next_action_date ? formatDateBr(d.next_action_date) : null]
                          .filter(Boolean)
                          .join(" • ") || (pt ? "Follow-up atrasado" : "Overdue follow-up")}
                      </p>
                    </div>
                    {waLink(d.client_phone) && (
                      <Button asChild size="sm" variant="ghost" className="gap-1">
                        <a href={waLink(d.client_phone)!} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onNavigate("atendimentos")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
                {unconfirmedToday.map((a) => (
                  <div key={`appt-${a.id}`} className="flex items-center gap-3 py-3">
                    <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.start_time?.slice(0, 5) ?? "--:--"} · {a.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pt ? "Visita de hoje não confirmada" : "Today's visit not confirmed"}
                        {a.client_name ? ` · ${a.client_name}` : ""}
                      </p>
                    </div>
                    {waLink(a.client_phone) && (
                      <Button asChild size="sm" variant="ghost" className="gap-1">
                        <a href={waLink(a.client_phone)!} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onNavigate("agenda")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* 2. Hoje */}
      {isBroker && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {pt ? "Hoje" : "Today"}
          </h2>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {pt ? "Nenhum compromisso para hoje." : "Nothing scheduled for today."}
            </p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0 px-4">
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
                    {waLink(a.client_phone) && (
                      <Button asChild size="sm" variant="ghost">
                        <a href={waLink(a.client_phone)!} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* 3. Esta semana */}
      {isBroker && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {pt ? "Esta semana" : "This week"}
          </h2>
          {!hasWeek ? (
            <p className="text-sm text-muted-foreground">
              {pt ? "Nada programado para os próximos dias." : "Nothing scheduled for the next few days."}
            </p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0 px-4">
                {weekFollowUps.map((d) => (
                  <div key={`wf-${d.id}`} className="flex items-center gap-3 py-3">
                    <Clock className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{d.client_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(pt ? "Follow-up" : "Follow-up") +
                          " · " +
                          [d.next_action, d.next_action_date ? formatDateBr(d.next_action_date) : null]
                            .filter(Boolean)
                            .join(" • ")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onNavigate("atendimentos")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
                {futureAppointments.map((a) => (
                  <div key={`wa-${a.id}`} className="flex items-center gap-3 py-3">
                    <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[formatDateBr(a.appointment_date), a.start_time?.slice(0, 5), a.client_name]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onNavigate("agenda")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
                {expiringAuths.map((a) => {
                  const { status, days } = authorizationStatus(a.authorization_end);
                  const badge = authorizationBadgeText(status, days, pt);
                  return (
                    <div key={`auth-${a.property_id}`} className="flex items-center gap-3 py-3">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            pt ? "Autorização de venda" : "Sale authorization",
                            a.reference_code ? `${pt ? "Cód." : "Ref."} ${a.reference_code}` : null,
                            a.authorization_type ? authorizationLabel(a.authorization_type, pt) : null,
                            `${pt ? "até" : "until"} ${formatDateBr(a.authorization_end)}`,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        {badge}
                      </span>
                      <Link to={`/editar/${a.property_id}`}>
                        <Button size="sm" variant="outline">{pt ? "Abrir" : "Open"}</Button>
                      </Link>
                    </div>
                  );
                })}
                {dueCharges.map((c) => (
                  <div key={`charge-${c.id}`} className="flex items-center gap-3 py-3">
                    <Receipt className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {pt ? "Aluguel a vencer" : "Rent due"} · {brl(Number(c.total_amount))}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pt ? "Vencimento" : "Due"} {formatDateBr(c.due_date)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onNavigate("locacao")}>
                      {pt ? "Abrir" : "Open"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* 4. Indicadores do mês */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {pt ? "Indicadores do mês" : "This month's numbers"}
        </h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {monthKpis.map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.section)}
              className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <p className="text-xs">{kpi.label}</p>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{kpi.value}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardOverview;
