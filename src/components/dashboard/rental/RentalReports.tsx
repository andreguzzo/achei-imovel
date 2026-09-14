import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, TrendingUp } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import {
  brl, effectiveChargeStatus, formatCompetence, formatDate, monthKey,
  type RentalCharge, type RentalContract,
} from "@/lib/rentals";

interface Props {
  userId: string;
}

const RentalReports = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [charges, setCharges] = useState<RentalCharge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [contractRes, chargeRes] = await Promise.all([
        supabase.from("rental_contracts").select("*").eq("broker_id", userId),
        supabase.from("rental_charges").select("*").eq("broker_id", userId),
      ]);
      if (!active) return;
      setContracts(contractRes.data ?? []);
      setCharges(chargeRes.data ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === "active" || c.status === "notice");
    const mrr = active.reduce((sum, c) => sum + Number(c.rent_amount), 0);
    const feeRevenue = active.reduce(
      (sum, c) => sum + (Number(c.rent_amount) * Number(c.admin_fee_percent)) / 100,
      0,
    );
    const current = monthKey(new Date());
    const monthCharges = charges.filter((c) => c.competence === current);
    const received = monthCharges
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + Number(c.paid_amount ?? c.total_amount), 0);
    const overdueList = charges.filter((c) => effectiveChargeStatus(c) === "overdue");
    const overdue = overdueList.reduce((s, c) => s + Number(c.total_amount), 0);
    const expectedMonth = monthCharges
      .filter((c) => c.status !== "cancelled")
      .reduce((s, c) => s + Number(c.total_amount), 0);
    const delinquency = expectedMonth > 0 ? (overdue / expectedMonth) * 100 : 0;

    const byMonth = new Map<string, { expected: number; received: number; fees: number }>();
    charges.forEach((c) => {
      if (c.status === "cancelled") return;
      const entry = byMonth.get(c.competence) ?? { expected: 0, received: 0, fees: 0 };
      entry.expected += Number(c.total_amount);
      entry.fees += Number(c.admin_fee_amount);
      if (c.status === "paid") entry.received += Number(c.paid_amount ?? c.total_amount);
      byMonth.set(c.competence, entry);
    });
    const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

    const byContract = new Map<string, number>();
    charges.forEach((c) => {
      if (c.status !== "paid") return;
      byContract.set(c.contract_id, (byContract.get(c.contract_id) ?? 0) + Number(c.admin_fee_amount));
    });
    const topContracts = contracts
      .map((c) => ({ contract: c, fees: byContract.get(c.id) ?? 0 }))
      .sort((a, b) => b.fees - a.fees)
      .slice(0, 5);

    return { active: active.length, mrr, feeRevenue, received, overdue, overdueCount: overdueList.length, delinquency, months, topContracts };
  }, [contracts, charges]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (contracts.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader title={pt ? "Relatórios de locação" : "Rental reports"} />
        <EmptyState
          icon={<TrendingUp className="h-7 w-7" />}
          title={pt ? "Sem dados de locação" : "No rental data"}
          description={pt
            ? "Os relatórios aparecem quando você cadastra contratos e registra os aluguéis."
            : "Reports appear once you add contracts and record charges."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Relatórios de locação" : "Rental reports"}
        description={pt
          ? "Receita recorrente, taxa de administração e inadimplência da sua carteira."
          : "Recurring revenue, management fees and delinquency across your portfolio."}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: pt ? "Contratos ativos" : "Active contracts", value: String(stats.active) },
          { label: pt ? "Aluguel administrado / mês" : "Managed rent / month", value: brl(stats.mrr) },
          { label: pt ? "Sua receita / mês" : "Your revenue / month", value: brl(stats.feeRevenue) },
          { label: pt ? "Recebido no mês" : "Received this month", value: brl(stats.received) },
          { label: pt ? "Em atraso" : "Overdue", value: `${brl(stats.overdue)} (${stats.overdueCount})` },
          { label: pt ? "Inadimplência do mês" : "Delinquency this month", value: `${stats.delinquency.toFixed(1)}%` },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-xl font-semibold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-3 font-medium">{pt ? "Histórico mensal" : "Monthly history"}</p>
          <div className="space-y-2">
            {stats.months.map(([month, v]) => {
              const pct = v.expected > 0 ? (v.received / v.expected) * 100 : 0;
              return (
                <div key={month} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 capitalize text-muted-foreground">{formatCompetence(month, pt)}</span>
                  <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="w-40 shrink-0 text-right">
                    {brl(v.received)} / {brl(v.expected)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-muted-foreground">
                    {pt ? "taxa " : "fee "}{brl(v.fees)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-3 font-medium">{pt ? "Contratos que mais geram receita" : "Top revenue contracts"}</p>
          <div className="space-y-2">
            {stats.topContracts.map(({ contract, fees }) => (
              <div key={contract.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{contract.tenant_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contract.property_label || "—"} • {pt ? "até " : "until "}{formatDate(contract.end_date, pt)}
                  </p>
                </div>
                <span className="font-medium">{brl(fees)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RentalReports;
