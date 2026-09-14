import { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  BarChart3,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Building2,
  ExternalLink,
  Eye,
  Users,
  Percent,
  KeyRound,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from "recharts";

interface BrokerAnalyticsProps {
  userId: string;
}

interface SaleRecord {
  id: string;
  client_name: string;
  stage: string;
  commission_value: number | null;
  created_at: string;
  actual_close_date: string | null;
  expected_close_date: string | null;
  property_id: string | null;
}

interface PropertyRecord {
  id: string;
  price: number;
  status: string;
  listing_type: string;
  title: string;
  sold_price: number | null;
  sold_commission: number | null;
  created_at: string;
  sold_at: string | null;
  closed_price: number | null;
  view_count: number | null;
}

interface LeadRecord {
  id: string;
  created_at: string;
  request_type: string | null;
  status: string;
  property_id: string | null;
}

type PeriodKey = "30d" | "90d" | "12m" | "ytd";

const STAGE_ORDER = [
  "lead",
  "visit_scheduled",
  "visited",
  "proposal",
  "negotiation",
  "documentation",
  "closed_won",
  "closed_lost",
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#94a3b8",
  "#22c55e",
  "#ef4444",
];

const BrokerAnalytics = ({ userId }: BrokerAnalyticsProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const dateLocale = pt ? ptBR : undefined;

  const navigate = useNavigate();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailView, setDetailView] = useState<"vgv_ativo" | "vgv_realizado" | "commissions" | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("12m");

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    if (period === "30d") return { dateFrom: subDays(now, 30), dateTo: now };
    if (period === "90d") return { dateFrom: subDays(now, 90), dateTo: now };
    if (period === "ytd") return { dateFrom: startOfYear(now), dateTo: now };
    return { dateFrom: startOfMonth(subMonths(now, 11)), dateTo: endOfMonth(now) };
  }, [period]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [salesRes, propsRes, leadsRes] = await Promise.all([
        supabase
          .from("sales_pipeline")
          .select("id, client_name, stage, commission_value, created_at, actual_close_date, expected_close_date, property_id")
          .eq("broker_id", userId),
        supabase
          .from("properties")
          .select("id, price, status, listing_type, title, sold_price, sold_commission, created_at, sold_at, closed_price, view_count")
          .eq("user_id", userId),
        supabase
          .from("contact_requests")
          .select("id, created_at, request_type, status, property_id")
          .eq("broker_id", userId),
      ]);
      setSales((salesRes.data as SaleRecord[]) ?? []);
      setProperties((propsRes.data as PropertyRecord[]) ?? []);
      setLeads((leadsRes.data as LeadRecord[]) ?? []);
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const inPeriod = useCallback(
    (value: string | null) => {
      if (!value) return false;
      const d = new Date(value);
      return d >= dateFrom && d <= dateTo;
    },
    [dateFrom, dateTo]
  );

  const filteredSales = useMemo(() => sales.filter((s) => inPeriod(s.created_at)), [sales, inPeriod]);
  const filteredLeads = useMemo(() => leads.filter((l) => inPeriod(l.created_at)), [leads, inPeriod]);

  // Closings registered in the period
  const closedInPeriod = useMemo(
    () => properties.filter((p) => (p.status === "sold" || p.status === "rented") && inPeriod(p.sold_at)),
    [properties, inPeriod]
  );
  const closedValue = (p: PropertyRecord) => p.closed_price ?? p.sold_price ?? p.price;

  const vgvFechado = useMemo(() => closedInPeriod.reduce((sum, p) => sum + closedValue(p), 0), [closedInPeriod]);
  const soldCount = useMemo(() => closedInPeriod.filter((p) => p.status === "sold").length, [closedInPeriod]);
  const rentedCount = useMemo(() => closedInPeriod.filter((p) => p.status === "rented").length, [closedInPeriod]);

  const avgDaysToClosing = useMemo(() => {
    const withDates = closedInPeriod.filter((p) => p.sold_at);
    if (withDates.length === 0) return null;
    const total = withDates.reduce(
      (sum, p) => sum + Math.max(differenceInDays(new Date(p.sold_at!), new Date(p.created_at)), 0),
      0
    );
    return Math.round(total / withDates.length);
  }, [closedInPeriod]);

  const avgPriceGap = useMemo(() => {
    const valid = closedInPeriod.filter((p) => p.price > 0);
    if (valid.length === 0) return null;
    const total = valid.reduce((sum, p) => sum + ((closedValue(p) - p.price) / p.price) * 100, 0);
    return total / valid.length;
  }, [closedInPeriod]);

  // Conversion: lead -> deal, deal -> closing
  const leadToDeal = useMemo(() => {
    if (filteredLeads.length === 0) return null;
    const converted = filteredLeads.filter((l) => l.status === "converted").length;
    return Math.round((converted / filteredLeads.length) * 100);
  }, [filteredLeads]);

  const dealToClosing = useMemo(() => {
    if (filteredSales.length === 0) return null;
    const won = filteredSales.filter((s) => s.stage === "closed_won").length;
    return Math.round((won / filteredSales.length) * 100);
  }, [filteredSales]);

  const leadOrigin = useMemo(() => {
    const labels: Record<string, string> = pt
      ? { whatsapp: "WhatsApp", visit: "Pedido de visita", info: "Pedido de informação", form: "Formulário", other: "Outros" }
      : { whatsapp: "WhatsApp", visit: "Visit request", info: "Info request", form: "Form", other: "Other" };
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const key = l.request_type || "form";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ name: labels[k] ?? k, value: v }));
  }, [filteredLeads, pt]);

  // Monthly evolution: closings count + closed value + leads
  const monthlyEvolution = useMemo(() => {
    const months: Record<string, { closings: number; vgv: number; leads: number }> = {};
    const ensure = (key: string) => {
      if (!months[key]) months[key] = { closings: 0, vgv: 0, leads: 0 };
      return months[key];
    };
    closedInPeriod.forEach((p) => {
      const bucket = ensure(format(new Date(p.sold_at!), "yyyy-MM"));
      bucket.closings++;
      bucket.vgv += closedValue(p);
    });
    filteredLeads.forEach((l) => {
      ensure(format(new Date(l.created_at), "yyyy-MM")).leads++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: format(new Date(key + "-01"), "MMM yy", { locale: dateLocale }),
        ...val,
      }));
  }, [closedInPeriod, filteredLeads, dateLocale]);

  // Ranking (last 30 days for leads, total views)
  const ranking = useMemo(() => {
    const since = subDays(new Date(), 30);
    const leadsByProperty: Record<string, number> = {};
    leads.forEach((l) => {
      if (!l.property_id) return;
      if (new Date(l.created_at) < since) return;
      leadsByProperty[l.property_id] = (leadsByProperty[l.property_id] ?? 0) + 1;
    });
    return properties
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.id,
        title: p.title,
        views: p.view_count ?? 0,
        leads: leadsByProperty[p.id] ?? 0,
      }));
  }, [properties, leads]);

  const rankingByViews = useMemo(() => [...ranking].sort((a, b) => b.views - a.views).slice(0, 5), [ranking]);
  const rankingByLeads = useMemo(
    () => [...ranking].sort((a, b) => b.leads - a.leads || b.views - a.views).slice(0, 5),
    [ranking]
  );
  const stalledProperties = useMemo(
    () => ranking.filter((r) => r.leads === 0).sort((a, b) => a.views - b.views).slice(0, 5),
    [ranking]
  );

  // VGV Ativo: active properties for sale
  const activeForSale = useMemo(
    () => properties.filter((p) => p.status === "active" && p.listing_type === "sale"),
    [properties]
  );
  const vgvAtivo = useMemo(() => activeForSale.reduce((sum, p) => sum + p.price, 0), [activeForSale]);

  const soldProperties = useMemo(() => {
    const soldIds = new Set(
      sales.filter((s) => s.stage === "closed_won" && s.property_id).map((s) => s.property_id)
    );
    return properties.filter((p) => soldIds.has(p.id) || p.status === "sold");
  }, [properties, sales]);
  const vgvRealizado = useMemo(
    () => soldProperties.reduce((sum, p) => sum + closedValue(p), 0),
    [soldProperties]
  );

  const totalCommission = useMemo(() => {
    const pipelineCommission = filteredSales
      .filter((s) => s.stage === "closed_won")
      .reduce((sum, s) => sum + (s.commission_value ?? 0), 0);
    const pipelinePropIds = new Set(
      sales.filter((s) => s.stage === "closed_won" && s.property_id).map((s) => s.property_id)
    );
    const directSoldCommission = properties
      .filter((p) => p.status === "sold" && p.sold_commission && !pipelinePropIds.has(p.id))
      .reduce((sum, p) => sum + (p.sold_commission ?? 0), 0);
    return pipelineCommission + directSoldCommission;
  }, [filteredSales, properties, sales]);

  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGE_ORDER.forEach((s) => (counts[s] = 0));
    filteredSales.forEach((s) => {
      if (counts[s.stage] !== undefined) counts[s.stage]++;
    });
    const stageLabels: Record<string, string> = pt
      ? {
          lead: "Lead",
          visit_scheduled: "Visita Agendada",
          visited: "Visitado",
          proposal: "Proposta",
          negotiation: "Negociação",
          documentation: "Documentação",
          closed_won: "Fechado ✓",
          closed_lost: "Perdido ✗",
        }
      : {
          lead: "Lead",
          visit_scheduled: "Visit Scheduled",
          visited: "Visited",
          proposal: "Proposal",
          negotiation: "Negotiation",
          documentation: "Documentation",
          closed_won: "Won",
          closed_lost: "Lost",
        };
    return STAGE_ORDER.map((s) => ({ stage: stageLabels[s], count: counts[s] }));
  }, [filteredSales, pt]);

  const propertyStatusData = useMemo(() => {
    const counts: Record<string, number> = { active: 0, sold: 0, rented: 0, inactive: 0 };
    properties.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });
    const labels: Record<string, string> = pt
      ? { active: "Ativo", sold: "Vendido", rented: "Alugado", inactive: "Inativo" }
      : { active: "Active", sold: "Sold", rented: "Rented", inactive: "Inactive" };
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: labels[k], value: v }));
  }, [properties, pt]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const periodOptions: { key: PeriodKey; label: string }[] = [
    { key: "30d", label: pt ? "30 dias" : "30 days" },
    { key: "90d", label: pt ? "90 dias" : "90 days" },
    { key: "12m", label: pt ? "12 meses" : "12 months" },
    { key: "ytd", label: pt ? "Ano corrente" : "Year to date" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{pt ? "Período:" : "Period:"}</span>
          <div className="flex flex-wrap gap-1">
            {periodOptions.map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={period === opt.key ? "default" : "outline"}
                className="text-xs"
                onClick={() => setPeriod(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {format(dateFrom, "dd/MM/yyyy")} — {format(dateTo, "dd/MM/yyyy")}
          </span>
        </CardContent>
      </Card>

      {/* Closing KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "VGV Fechado" : "Closed GDV"}
              </span>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(vgvFechado)}</p>
            <p className="text-xs text-muted-foreground">
              {closedInPeriod.length} {pt ? "fechamentos no período" : "closings in period"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Vendidos / Alugados" : "Sold / Rented"}
              </span>
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {soldCount} / {rentedCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt ? "imóveis fechados no período" : "properties closed in period"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Tempo médio de fechamento" : "Avg. time to close"}
              </span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {avgDaysToClosing !== null ? `${avgDaysToClosing} ${pt ? "dias" : "days"}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt ? "da publicação ao fechamento" : "from listing to closing"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Anunciado vs. fechado" : "Listed vs. closed"}
              </span>
              <Percent className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">
              {avgPriceGap !== null ? `${avgPriceGap > 0 ? "+" : ""}${avgPriceGap.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {pt ? "diferença média de preço" : "average price difference"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion + origin */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Lead → Negociação" : "Lead → Deal"}
              </span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{leadToDeal !== null ? `${leadToDeal}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {filteredLeads.length} {pt ? "leads no período" : "leads in period"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Negociação → Fechamento" : "Deal → Closing"}
              </span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{dealToClosing !== null ? `${dealToClosing}%` : "—"}</p>
            <p className="text-xs text-muted-foreground">
              {filteredSales.length} {pt ? "negociações no período" : "deals in period"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              {pt ? "Origem dos Leads" : "Lead Sources"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadOrigin.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum lead no período" : "No leads in period"}
              </p>
            ) : (
              <div className="space-y-1.5">
                {leadOrigin.map((o, i) => (
                  <div key={o.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate">{o.name}</span>
                    <span className="font-semibold">{o.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly evolution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            {pt ? "Evolução Mensal" : "Monthly Evolution"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyEvolution.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {pt ? "Nenhum dado no período" : "No data in period"}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={monthlyEvolution} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) =>
                    name === (pt ? "VGV fechado" : "Closed GDV") ? formatCurrency(value) : value
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="closings"
                  name={pt ? "Fechamentos" : "Closings"}
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="leads"
                  name={pt ? "Leads" : "Leads"}
                  fill="hsl(var(--chart-3))"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vgv"
                  name={pt ? "VGV fechado" : "Closed GDV"}
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" />
              {pt ? "Mais visualizados" : "Most viewed"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {rankingByViews.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum imóvel ativo" : "No active properties"}
              </p>
            ) : (
              rankingByViews.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/imovel/${r.id}`)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{r.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.views}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              {pt ? "Mais leads (30 dias)" : "Most leads (30 days)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {rankingByLeads.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum imóvel ativo" : "No active properties"}
              </p>
            ) : (
              rankingByLeads.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/imovel/${r.id}`)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{r.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.leads}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4" />
              {pt ? "Parados (sem leads)" : "Stalled (no leads)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {stalledProperties.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {pt ? "Todos receberam leads" : "All received leads"}
              </p>
            ) : (
              stalledProperties.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/imovel/${r.id}`)}
                  className="flex w-full items-center gap-2 rounded px-1 py-1.5 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-1 truncate">{r.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.views} {pt ? "views" : "views"}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetailView("vgv_ativo")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "VGV Ativo" : "Active GDV"}
              </span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(vgvAtivo)}</p>
            <p className="text-xs text-muted-foreground">
              {activeForSale.length} {pt ? "imóveis à venda" : "properties for sale"}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetailView("vgv_realizado")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "VGV Realizado (total)" : "Realized GDV (total)"}
              </span>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(vgvRealizado)}</p>
            <p className="text-xs text-muted-foreground">
              {soldProperties.length} {pt ? "imóveis vendidos" : "properties sold"}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setDetailView("commissions")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Comissões" : "Commissions"}
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(totalCommission)}</p>
            <p className="text-xs text-muted-foreground">{pt ? "clique para detalhes" : "click for details"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpRight className="h-4 w-4" />
              {pt ? "Funil de Vendas" : "Sales Funnel"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSales.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum negócio no período" : "No deals in period"}
              </p>
            ) : (
              <div className="space-y-2">
                {funnelData.map((item, i) => {
                  const max = Math.max(...funnelData.map((d) => d.count), 1);
                  const pct = (item.count / max) * 100;
                  return (
                    <div key={item.stage} className="flex items-center gap-3">
                      <span className="w-32 text-xs font-medium text-right shrink-0">{item.stage}</span>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                            minWidth: item.count > 0 ? "24px" : "0",
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-8 text-right">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              {pt ? "Status dos Imóveis" : "Property Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {propertyStatusData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum imóvel" : "No properties"}
              </p>
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={propertyStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      paddingAngle={3}
                    >
                      {propertyStatusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-1">
                  {propertyStatusData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Closings table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            {pt ? "Fechamentos no Período" : "Closings in Period"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {closedInPeriod.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {pt ? "Nenhum fechamento no período" : "No closings in period"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">{pt ? "Imóvel" : "Property"}</th>
                    <th className="pb-2 pr-4">{pt ? "Tipo" : "Type"}</th>
                    <th className="pb-2 pr-4">{pt ? "Anunciado" : "Listed"}</th>
                    <th className="pb-2 pr-4">{pt ? "Fechado" : "Closed"}</th>
                    <th className="pb-2 pr-4">{pt ? "Data" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...closedInPeriod]
                    .sort((a, b) => new Date(b.sold_at!).getTime() - new Date(a.sold_at!).getTime())
                    .map((p) => (
                      <tr
                        key={p.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/imovel/${p.id}`)}
                      >
                        <td className="py-2.5 pr-4 font-medium max-w-[220px] truncate">{p.title}</td>
                        <td className="py-2.5 pr-4">
                          {p.status === "sold" ? (pt ? "Venda" : "Sale") : pt ? "Locação" : "Rental"}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatCurrency(p.price)}</td>
                        <td className="py-2.5 pr-4 font-semibold text-primary">{formatCurrency(closedValue(p))}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {format(new Date(p.sold_at!), "dd/MM/yyyy")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailView !== null} onOpenChange={(open) => !open && setDetailView(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailView === "vgv_ativo" && (pt ? "Imóveis à Venda (VGV Ativo)" : "Properties for Sale (Active GDV)")}
              {detailView === "vgv_realizado" && (pt ? "Imóveis Vendidos (VGV Realizado)" : "Sold Properties (Realized GDV)")}
              {detailView === "commissions" && (pt ? "Detalhamento de Comissões" : "Commission Breakdown")}
            </DialogTitle>
          </DialogHeader>

          {detailView === "vgv_ativo" && (
            <div className="space-y-2">
              {activeForSale.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{pt ? "Nenhum imóvel à venda" : "No properties for sale"}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {activeForSale.length} {pt ? "imóveis" : "properties"} • {pt ? "Total:" : "Total:"} {formatCurrency(vgvAtivo)}
                  </p>
                  {activeForSale.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/imovel/${p.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <Badge variant="secondary" className="text-[10px] mt-1">{pt ? "Ativo" : "Active"}</Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="text-sm font-bold text-primary">{formatCurrency(p.price)}</p>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {detailView === "vgv_realizado" && (
            <div className="space-y-2">
              {soldProperties.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{pt ? "Nenhum imóvel vendido" : "No sold properties"}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {soldProperties.length} {pt ? "imóveis" : "properties"} • {pt ? "Total:" : "Total:"} {formatCurrency(vgvRealizado)}
                  </p>
                  {soldProperties.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/imovel/${p.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {pt ? "Vendido" : "Sold"}
                          </Badge>
                          {p.sold_commission != null && p.sold_commission > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {pt ? "Comissão:" : "Commission:"} {formatCurrency(p.sold_commission)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">{formatCurrency(closedValue(p))}</p>
                          {closedValue(p) !== p.price && (
                            <p className="text-[10px] text-muted-foreground line-through">{formatCurrency(p.price)}</p>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {detailView === "commissions" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {pt ? "Total:" : "Total:"} <span className="font-bold text-foreground">{formatCurrency(totalCommission)}</span>
              </p>
              {filteredSales.filter((s) => s.stage === "closed_won" && (s.commission_value ?? 0) > 0).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{pt ? "Do Pipeline" : "From Pipeline"}</p>
                  {filteredSales
                    .filter((s) => s.stage === "closed_won" && (s.commission_value ?? 0) > 0)
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{s.client_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.actual_close_date ? format(new Date(s.actual_close_date), "dd/MM/yyyy") : "—"}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-primary">{formatCurrency(s.commission_value ?? 0)}</p>
                      </div>
                    ))}
                </div>
              )}
              {(() => {
                const pipelinePropIds = new Set(
                  sales.filter((s) => s.stage === "closed_won" && s.property_id).map((s) => s.property_id)
                );
                const directSold = properties.filter(
                  (p) => p.status === "sold" && p.sold_commission && !pipelinePropIds.has(p.id)
                );
                if (directSold.length === 0) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{pt ? "Vendas Diretas" : "Direct Sales"}</p>
                    {directSold.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                        onClick={() => navigate(`/imovel/${p.id}`)}
                      >
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-sm font-bold text-primary shrink-0 ml-2">{formatCurrency(p.sold_commission!)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {totalCommission === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{pt ? "Nenhuma comissão registrada" : "No commissions recorded"}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrokerAnalytics;
