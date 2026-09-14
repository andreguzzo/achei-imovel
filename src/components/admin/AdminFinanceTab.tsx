import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  RefreshCw,
  Download,
  ExternalLink,
  TrendingUp,
  Users,
  AlertTriangle,
  Undo2,
} from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import EmptyState from "@/components/admin/EmptyState";

interface Transaction {
  id: string;
  email: string;
  plan_slug: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  receipt_url: string | null;
  payment_method: string | null;
  livemode: boolean;
  occurred_at: string;
}

interface SubscriptionRow {
  email: string;
  plan_slug: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface PlanRow {
  slug: string;
  name: string;
  price_cents: number;
}

interface Summary {
  revenue_month_cents: number;
  revenue_total_cents: number;
  mrr_cents: number;
  active_subscribers: number;
  pending: number;
  failed: number;
  refunded: number;
  by_plan: Record<string, number>;
  livemode: boolean;
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents ?? 0) / 100);

const statusLabel: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  failed: "Falhou",
  refunded: "Reembolsado",
  partially_refunded: "Reembolso parcial",
};

const statusVariant = (status: string) =>
  status === "paid"
    ? "default"
    : status === "pending"
      ? "secondary"
      : status === "failed"
        ? "destructive"
        : "outline";

const AdminFinanceTab = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTransactions(data.transactions ?? []);
      setSubscriptions(data.subscriptions ?? []);
      setPlans(data.plans ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      toast({
        title: "Erro ao carregar financeiro",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-financial", {
        body: { action: "sync" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Sincronização concluída",
        description: `${data.imported ?? 0} transações e ${data.subscriptions ?? 0} assinaturas atualizadas.`,
      });
      await load();
    } catch (err) {
      toast({
        title: "Erro na sincronização",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (planFilter !== "all" && (t.plan_slug ?? "") !== planFilter) return false;
      if (term && !(t.email ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [transactions, search, statusFilter, planFilter]);

  const planName = (slug: string | null) =>
    plans.find((p) => p.slug === slug)?.name ?? slug ?? "—";

  const exportCsv = () => {
    const header = ["Data", "E-mail", "Plano", "Valor", "Status", "Método", "Descrição"];
    const rows = filtered.map((t) => [
      new Date(t.occurred_at).toLocaleString("pt-BR"),
      t.email,
      planName(t.plan_slug),
      (t.amount_cents / 100).toFixed(2).replace(".", ","),
      statusLabel[t.status] ?? t.status,
      t.payment_method ?? "",
      (t.description ?? "").replace(/[\n;]/g, " "),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Financeiro"
        description="Todas as transações, assinaturas e receita da plataforma."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sincronizar
            </Button>
          </div>
        }
      />

      {summary && !summary.livemode && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Ambiente de teste: nenhuma cobrança real foi processada até agora.
        </div>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Receita no mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{brl(summary.revenue_month_cents)}</p>
              <p className="text-xs text-muted-foreground">Total: {brl(summary.revenue_total_cents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita recorrente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{brl(summary.mrr_cents)}</p>
              <p className="text-xs text-muted-foreground">por mês</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" /> Assinantes ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.active_subscribers}</p>
              <p className="text-xs text-muted-foreground">
                {Object.entries(summary.by_plan)
                  .map(([slug, count]) => `${planName(slug)}: ${count}`)
                  .join(" · ") || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Undo2 className="h-4 w-4" /> Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.pending}</p>
              <p className="text-xs text-muted-foreground">
                {summary.failed} falhas · {summary.refunded} reembolsos
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Buscar por e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Nenhuma transação"
              description="As cobranças aparecem aqui automaticamente após cada pagamento."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Recibo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(t.occurred_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{t.email || "—"}</TableCell>
                      <TableCell className="text-sm">{planName(t.plan_slug)}</TableCell>
                      <TableCell className="text-sm font-medium">{brl(t.amount_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(t.status)}>
                          {statusLabel[t.status] ?? t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.payment_method ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {t.receipt_url ? (
                          <a
                            href={t.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm text-primary hover:underline"
                          >
                            Abrir <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinaturas</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <EmptyState
              title="Nenhuma assinatura"
              description="Assinaturas ativas aparecem aqui após o primeiro pagamento."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Renova em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((s, i) => (
                    <TableRow key={`${s.email}-${i}`}>
                      <TableCell className="text-sm">{s.email || "—"}</TableCell>
                      <TableCell className="text-sm">{planName(s.plan_slug)}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>
                          {s.status}
                          {s.cancel_at_period_end ? " (cancela)" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {s.current_period_end
                          ? new Date(s.current_period_end).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinanceTab;
