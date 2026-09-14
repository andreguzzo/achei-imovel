import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Wallet } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import { brl } from "@/lib/rentals";
import { useAgency } from "@/hooks/useAgency";
import { ClientLink } from "@/components/dashboard/ClientSheet";

interface Props {
  userId: string;
}

type PeriodKey = "30d" | "90d" | "12m" | "ytd";

interface Row {
  kind: "forecast" | "closed" | "rental";
  date: string;
  label: string;
  clientName?: string | null;
  gross: number;
  partnerCut: number;
  agencyCut: number;
  net: number;
}

const AGENCY_SHARE_STORAGE_KEY = "abitzo:finance:agency-share";

const periodStart = (key: PeriodKey) => {
  const now = new Date();
  if (key === "ytd") return new Date(now.getFullYear(), 0, 1);
  const d = new Date(now);
  if (key === "30d") d.setDate(d.getDate() - 30);
  if (key === "90d") d.setDate(d.getDate() - 90);
  if (key === "12m") d.setMonth(d.getMonth() - 12);
  return d;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

const DashboardFinance = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const { agency, isOwner } = useAgency(userId);

  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [loading, setLoading] = useState(true);
  const [agencyShare, setAgencyShare] = useState<number>(() => {
    const stored = Number(localStorage.getItem(AGENCY_SHARE_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 20;
  });

  const [deals, setDeals] = useState<
    { id: string; client_name: string; stage: string; property_id: string | null; commission_value: number | null; expected_close_date: string | null; actual_close_date: string | null; updated_at: string }[]
  >([]);
  const [charges, setCharges] = useState<{ id: string; competence: string; paid_at: string | null; admin_fee_amount: number }[]>([]);
  const [groupByProperty, setGroupByProperty] = useState<Record<string, string>>({});
  const [splitByGroup, setSplitByGroup] = useState<Record<string, number>>({});

  useEffect(() => {
    localStorage.setItem(AGENCY_SHARE_STORAGE_KEY, String(agencyShare));
  }, [agencyShare]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [dealRes, chargeRes, memberRes, partnerRes] = await Promise.all([
        supabase
          .from("sales_pipeline")
          .select("id, client_name, stage, property_id, commission_value, expected_close_date, actual_close_date, updated_at")
          .eq("broker_id", userId),
        supabase
          .from("rental_charges")
          .select("id, competence, paid_at, admin_fee_amount")
          .eq("broker_id", userId)
          .eq("status", "paid"),
        supabase.from("property_group_members").select("property_id, group_id").eq("broker_id", userId),
        supabase
          .from("broker_partnerships")
          .select("group_id, commission_split, status, broker_a_id, broker_b_id")
          .eq("status", "active"),
      ]);
      if (!active) return;
      setDeals(dealRes.data ?? []);
      setCharges(chargeRes.data ?? []);

      const gmap: Record<string, string> = {};
      (memberRes.data ?? []).forEach((m) => { if (m.property_id) gmap[m.property_id] = m.group_id; });
      setGroupByProperty(gmap);

      const smap: Record<string, number> = {};
      (partnerRes.data ?? []).forEach((p) => {
        if (p.commission_split == null) return;
        if (p.broker_a_id !== userId && p.broker_b_id !== userId) return;
        smap[p.group_id] = Number(p.commission_split);
      });
      setSplitByGroup(smap);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  const agencyPct = agency && !isOwner ? agencyShare : 0;

  const rows = useMemo<Row[]>(() => {
    const start = periodStart(period);
    const startIso = iso(start);
    const todayIso = iso(new Date());
    const out: Row[] = [];

    const split = (gross: number, propertyId: string | null) => {
      const groupId = propertyId ? groupByProperty[propertyId] : undefined;
      const partnerPct = groupId ? (splitByGroup[groupId] ?? 0) : 0;
      const partnerCut = (gross * partnerPct) / 100;
      const afterPartner = gross - partnerCut;
      const agencyCut = (afterPartner * agencyPct) / 100;
      return { partnerCut, agencyCut, net: afterPartner - agencyCut };
    };

    deals.forEach((d) => {
      const gross = Number(d.commission_value ?? 0);
      if (!gross) return;
      const closed = d.stage === "closed_won";
      if (closed) {
        const date = d.actual_close_date ?? d.updated_at.slice(0, 10);
        if (date < startIso) return;
        const s = split(gross, d.property_id);
        out.push({ kind: "closed", date, label: d.client_name, clientName: d.client_name, gross, ...s });
      } else {
        const date = d.expected_close_date;
        if (!date || date < todayIso) return;
        const s = split(gross, d.property_id);
        out.push({ kind: "forecast", date, label: d.client_name, clientName: d.client_name, gross, ...s });
      }
    });

    charges.forEach((c) => {
      const date = c.paid_at ?? c.competence;
      if (date < startIso) return;
      const gross = Number(c.admin_fee_amount ?? 0);
      if (!gross) return;
      const agencyCut = (gross * agencyPct) / 100;
      out.push({
        kind: "rental",
        date,
        label: pt ? `Administração ${c.competence.slice(0, 7)}` : `Management ${c.competence.slice(0, 7)}`,
        gross,
        partnerCut: 0,
        agencyCut,
        net: gross - agencyCut,
      });
    });

    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [deals, charges, period, groupByProperty, splitByGroup, agencyPct, pt]);

  const totals = useMemo(() => {
    const sum = (list: Row[], f: (r: Row) => number) => list.reduce((s, r) => s + f(r), 0);
    const forecast = rows.filter((r) => r.kind === "forecast");
    const closed = rows.filter((r) => r.kind === "closed");
    const rental = rows.filter((r) => r.kind === "rental");
    const realized = [...closed, ...rental];
    return {
      forecastGross: sum(forecast, (r) => r.gross),
      forecastNet: sum(forecast, (r) => r.net),
      closedGross: sum(closed, (r) => r.gross),
      closedNet: sum(closed, (r) => r.net),
      rentalGross: sum(rental, (r) => r.gross),
      rentalNet: sum(rental, (r) => r.net),
      gross: sum(realized, (r) => r.gross),
      partnerCut: sum(realized, (r) => r.partnerCut),
      agencyCut: sum(realized, (r) => r.agencyCut),
      net: sum(realized, (r) => r.net),
    };
  }, [rows]);

  const kindLabel = (kind: Row["kind"]) =>
    kind === "forecast"
      ? pt ? "Comissão prevista" : "Forecast commission"
      : kind === "closed"
        ? pt ? "Comissão realizada" : "Closed commission"
        : pt ? "Administração de locação" : "Rental management";

  const exportCsv = () => {
    const header = pt
      ? ["Tipo", "Data", "Descrição", "Bruto", "Parceiro", "Imobiliária", "Líquido"]
      : ["Type", "Date", "Description", "Gross", "Partner", "Agency", "Net"];
    const lines = [
      header.join(";"),
      ...rows.map((r) =>
        [
          kindLabel(r.kind),
          r.date,
          `"${r.label.replace(/"/g, '""')}"`,
          r.gross.toFixed(2),
          r.partnerCut.toFixed(2),
          r.agencyCut.toFixed(2),
          r.net.toFixed(2),
        ].join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro-${period}-${iso(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Financeiro" : "Finance"}
        description={pt
          ? "Comissões previstas, comissões realizadas e receita de administração de locação, com rateio de parceiros e imobiliária."
          : "Forecast and closed commissions plus rental management revenue, with partner and agency splits."}
        action={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">{pt ? "Últimos 30 dias" : "Last 30 days"}</SelectItem>
                <SelectItem value="90d">{pt ? "Últimos 90 dias" : "Last 90 days"}</SelectItem>
                <SelectItem value="12m">{pt ? "Últimos 12 meses" : "Last 12 months"}</SelectItem>
                <SelectItem value="ytd">{pt ? "Ano corrente" : "Year to date"}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: pt ? "Comissões previstas" : "Forecast commissions", gross: totals.forecastGross, net: totals.forecastNet },
          { title: pt ? "Comissões realizadas" : "Closed commissions", gross: totals.closedGross, net: totals.closedNet },
          { title: pt ? "Administração de locação" : "Rental management", gross: totals.rentalGross, net: totals.rentalNet },
          { title: pt ? "Recebido líquido" : "Net received", gross: totals.gross, net: totals.net },
        ].map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{kpi.title}</p>
              <p className="mt-1 font-display text-xl font-semibold text-foreground">{brl(kpi.net)}</p>
              <p className="text-xs text-muted-foreground">{pt ? "Bruto" : "Gross"} {brl(kpi.gross)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{pt ? "Bruto no período" : "Gross in period"}</p>
              <p className="font-semibold">{brl(totals.gross)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{pt ? "Parte do parceiro" : "Partner share"}</p>
              <p className="font-semibold text-destructive">- {brl(totals.partnerCut)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{pt ? "Parte da imobiliária" : "Agency share"}</p>
              <p className="font-semibold text-destructive">- {brl(totals.agencyCut)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{pt ? "Líquido" : "Net"}</p>
              <p className="font-semibold text-primary">{brl(totals.net)}</p>
            </div>
          </div>
          {agency && !isOwner && (
            <div className="flex items-end gap-2 border-t border-border pt-3">
              <div className="w-40">
                <Label htmlFor="agency-share" className="text-xs">
                  {pt ? `Repasse para ${agency.name} (%)` : `Share to ${agency.name} (%)`}
                </Label>
                <Input
                  id="agency-share"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={agencyShare}
                  onChange={(e) => setAgencyShare(Math.min(100, Math.max(0, Number(e.target.value))))}
                />
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                {pt ? "Aplicado sobre o valor após o rateio do parceiro." : "Applied after the partner split."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title={pt ? "Nada no período" : "Nothing in this period"}
          description={pt
            ? "Registre comissões nas negociações e dê baixa nos aluguéis para ver os valores aqui."
            : "Add commissions to your deals and settle rental charges to see values here."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{pt ? "Tipo" : "Type"}</th>
                <th className="px-3 py-2 text-left">{pt ? "Data" : "Date"}</th>
                <th className="px-3 py-2 text-left">{pt ? "Descrição" : "Description"}</th>
                <th className="px-3 py-2 text-right">{pt ? "Bruto" : "Gross"}</th>
                <th className="px-3 py-2 text-right">{pt ? "Parceiro" : "Partner"}</th>
                <th className="px-3 py-2 text-right">{pt ? "Imobiliária" : "Agency"}</th>
                <th className="px-3 py-2 text-right">{pt ? "Líquido" : "Net"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.kind}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2">{kindLabel(r.kind)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.date.slice(0, 10).split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2">
                    {r.clientName ? <ClientLink name={r.clientName} /> : r.label}
                  </td>
                  <td className="px-3 py-2 text-right">{brl(r.gross)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.partnerCut ? `- ${brl(r.partnerCut)}` : "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{r.agencyCut ? `- ${brl(r.agencyCut)}` : "—"}</td>
                  <td className="px-3 py-2 text-right font-medium">{brl(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DashboardFinance;
