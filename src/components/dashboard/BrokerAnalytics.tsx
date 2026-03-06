import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  CalendarIcon,
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
} from "recharts";
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
}

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

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(subMonths(new Date(), 11)));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [salesRes, propsRes] = await Promise.all([
        supabase
          .from("sales_pipeline")
          .select("id, client_name, stage, commission_value, created_at, actual_close_date, expected_close_date, property_id")
          .eq("broker_id", userId),
        supabase
          .from("properties")
          .select("id, price, status, listing_type, title, sold_price, sold_commission")
          .eq("user_id", userId),
      ]);
      setSales((salesRes.data as SaleRecord[]) ?? []);
      setProperties((propsRes.data as PropertyRecord[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const d = new Date(s.created_at);
      return d >= dateFrom && d <= dateTo;
    });
  }, [sales, dateFrom, dateTo]);

  // VGV Ativo: sum of active property prices (for sale)
  const vgvAtivo = useMemo(() => {
    return properties
      .filter((p) => p.status === "active" && p.listing_type === "sale")
      .reduce((sum, p) => sum + p.price, 0);
  }, [properties]);

  // VGV Realizado: sum of sold properties (use sold_price when available)
  const vgvRealizado = useMemo(() => {
    const soldIds = new Set(
      sales.filter((s) => s.stage === "closed_won" && s.property_id).map((s) => s.property_id)
    );
    return properties
      .filter((p) => soldIds.has(p.id) || p.status === "sold")
      .reduce((sum, p) => sum + (p.sold_price ?? p.price), 0);
  }, [properties, sales]);

  // Commission totals: from sales pipeline + from properties marked as sold directly
  const totalCommission = useMemo(() => {
    const pipelineCommission = filteredSales
      .filter((s) => s.stage === "closed_won")
      .reduce((sum, s) => sum + (s.commission_value ?? 0), 0);
    // Add commissions from properties marked sold that aren't in the pipeline
    const pipelinePropIds = new Set(
      sales.filter((s) => s.stage === "closed_won" && s.property_id).map((s) => s.property_id)
    );
    const directSoldCommission = properties
      .filter((p) => p.status === "sold" && p.sold_commission && !pipelinePropIds.has(p.id))
      .reduce((sum, p) => sum + (p.sold_commission ?? 0), 0);
    return pipelineCommission + directSoldCommission;
  }, [filteredSales, properties, sales]);

  // Pipeline funnel
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

  // Conversion rate
  const conversionRate = useMemo(() => {
    const total = filteredSales.length;
    if (total === 0) return 0;
    const won = filteredSales.filter((s) => s.stage === "closed_won").length;
    return Math.round((won / total) * 100);
  }, [filteredSales]);

  // Average days to close
  const avgDaysToClose = useMemo(() => {
    const closed = filteredSales.filter((s) => s.stage === "closed_won" && s.actual_close_date);
    if (closed.length === 0) return null;
    const total = closed.reduce((sum, s) => {
      return sum + differenceInDays(new Date(s.actual_close_date!), new Date(s.created_at));
    }, 0);
    return Math.round(total / closed.length);
  }, [filteredSales]);

  // Monthly sales chart
  const monthlySales = useMemo(() => {
    const months: Record<string, { won: number; lost: number; revenue: number }> = {};
    filteredSales.forEach((s) => {
      const key = format(new Date(s.created_at), "yyyy-MM");
      if (!months[key]) months[key] = { won: 0, lost: 0, revenue: 0 };
      if (s.stage === "closed_won") {
        months[key].won++;
        months[key].revenue += s.commission_value ?? 0;
      }
      if (s.stage === "closed_lost") months[key].lost++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: format(new Date(key + "-01"), "MMM yy", { locale: dateLocale }),
        ...val,
      }));
  }, [filteredSales, dateLocale]);

  // Property status distribution
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{pt ? "Período:" : "Period:"}</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                locale={dateLocale}
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">{pt ? "até" : "to"}</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-1.5", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                locale={dateLocale}
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-1 ml-auto">
            {[3, 6, 12].map((m) => (
              <Button
                key={m}
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  setDateFrom(startOfMonth(subMonths(new Date(), m - 1)));
                  setDateTo(endOfMonth(new Date()));
                }}
              >
                {m}m
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "VGV Ativo" : "Active GDV"}
              </span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(vgvAtivo)}</p>
            <p className="text-xs text-muted-foreground">
              {properties.filter((p) => p.status === "active" && p.listing_type === "sale").length}{" "}
              {pt ? "imóveis à venda" : "properties for sale"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "VGV Realizado" : "Realized GDV"}
              </span>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(vgvRealizado)}</p>
            <p className="text-xs text-muted-foreground">
              {filteredSales.filter((s) => s.stage === "closed_won").length}{" "}
              {pt ? "vendas fechadas" : "closed sales"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Comissões" : "Commissions"}
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{formatCurrency(totalCommission)}</p>
            <p className="text-xs text-muted-foreground">{pt ? "no período selecionado" : "in selected period"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {pt ? "Taxa de Conversão" : "Conversion Rate"}
              </span>
              <Target className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-xl font-bold text-foreground">{conversionRate}%</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {avgDaysToClose !== null && (
                <>
                  <Clock className="h-3 w-3" />
                  {avgDaysToClose} {pt ? "dias p/ fechar" : "days to close"}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly Sales Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {pt ? "Vendas por Mês" : "Monthly Sales"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlySales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {pt ? "Nenhum dado no período" : "No data in period"}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlySales} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="won"
                    name={pt ? "Fechadas" : "Won"}
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="lost"
                    name={pt ? "Perdidas" : "Lost"}
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Property Status Pie */}
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

      {/* Pipeline Funnel */}
      <Card>
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

      {/* Sales History Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4" />
            {pt ? "Histórico de Vendas" : "Sales History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.filter((s) => s.stage === "closed_won" || s.stage === "closed_lost").length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {pt ? "Nenhuma venda concluída no período" : "No completed sales in period"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4">{pt ? "Cliente" : "Client"}</th>
                    <th className="pb-2 pr-4">{pt ? "Status" : "Status"}</th>
                    <th className="pb-2 pr-4">{pt ? "Comissão" : "Commission"}</th>
                    <th className="pb-2 pr-4">{pt ? "Data Fech." : "Close Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales
                    .filter((s) => s.stage === "closed_won" || s.stage === "closed_lost")
                    .sort((a, b) => new Date(b.actual_close_date ?? b.created_at).getTime() - new Date(a.actual_close_date ?? a.created_at).getTime())
                    .map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{s.client_name}</td>
                        <td className="py-2.5 pr-4">
                          {s.stage === "closed_won" ? (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {pt ? "Vendido" : "Won"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <XCircle className="h-3.5 w-3.5" />
                              {pt ? "Perdido" : "Lost"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {s.commission_value ? formatCurrency(s.commission_value) : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {s.actual_close_date
                            ? format(new Date(s.actual_close_date), "dd/MM/yyyy")
                            : format(new Date(s.created_at), "dd/MM/yyyy")}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrokerAnalytics;
