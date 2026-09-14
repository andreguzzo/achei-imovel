import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSignature, Loader2, Pencil, Plus, RefreshCw, Trash2, TrendingUp, KeyRound } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import RentalContractForm from "./RentalContractForm";
import {
  adminFee, brl, contractStatusLabel, daysUntil, formatDate, guaranteeLabel, indexLabel,
  type ContractStatus, type RentalContract,
} from "@/lib/rentals";

interface Props {
  userId: string;
}

const RentalContracts = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContractStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RentalContract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RentalContract | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<RentalContract | null>(null);
  const [adjustPercent, setAdjustPercent] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rental_contracts")
      .select("*")
      .eq("broker_id", userId)
      .order("created_at", { ascending: false });
    if (error) toast.error(pt ? "Não foi possível carregar os contratos." : "Could not load contracts.");
    setContracts(data ?? []);
    setLoading(false);
  }, [userId, pt]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const visible = useMemo(
    () => (filter === "all" ? contracts : contracts.filter((c) => c.status === filter)),
    [contracts, filter],
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("rental_contracts").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast.error(pt ? "Não foi possível excluir o contrato." : "Could not delete the contract.");
      return;
    }
    toast.success(pt ? "Contrato excluído." : "Contract deleted.");
    fetchContracts();
  };

  const regenerate = async (contract: RentalContract) => {
    const { data, error } = await supabase.rpc("generate_rental_charges", { _contract_id: contract.id });
    if (error) {
      toast.error(pt ? "Não foi possível gerar as parcelas." : "Could not generate charges.");
      return;
    }
    toast.success(
      pt ? `${data ?? 0} aluguéis criados (os já existentes foram mantidos).`
         : `${data ?? 0} charges created (existing ones were kept).`,
    );
  };

  const applyAdjustment = async () => {
    if (!adjustTarget) return;
    const percent = Number(adjustPercent.replace(",", "."));
    if (!percent || percent <= -100) {
      toast.error(pt ? "Informe o percentual do reajuste." : "Enter the adjustment percentage.");
      return;
    }
    setAdjustSaving(true);
    const newRent = Math.round(Number(adjustTarget.rent_amount) * (1 + percent / 100) * 100) / 100;
    const nextDate = adjustTarget.next_adjustment_date
      ? new Date(`${adjustTarget.next_adjustment_date}T00:00:00`)
      : new Date();
    nextDate.setFullYear(nextDate.getFullYear() + 1);
    const today = new Date().toISOString().slice(0, 10);
    const fee = adminFee(newRent, Number(adjustTarget.admin_fee_percent));
    const charges =
      Number(adjustTarget.condo_fee) + Number(adjustTarget.iptu) + Number(adjustTarget.other_charges);

    const [contractRes, chargesRes] = await Promise.all([
      supabase
        .from("rental_contracts")
        .update({ rent_amount: newRent, next_adjustment_date: nextDate.toISOString().slice(0, 10) })
        .eq("id", adjustTarget.id),
      supabase
        .from("rental_charges")
        .update({
          rent_amount: newRent,
          total_amount: newRent + charges,
          admin_fee_amount: fee,
          payout_amount: newRent - fee,
        })
        .eq("contract_id", adjustTarget.id)
        .eq("status", "pending")
        .gte("due_date", today),
    ]);
    setAdjustSaving(false);

    if (contractRes.error || chargesRes.error) {
      toast.error(pt ? "Não foi possível aplicar o reajuste." : "Could not apply the adjustment.");
      return;
    }
    toast.success(
      pt ? `Novo aluguel: ${brl(newRent)}. Parcelas futuras atualizadas.`
         : `New rent: ${brl(newRent)}. Future charges updated.`,
    );
    setAdjustTarget(null);
    setAdjustPercent("");
    fetchContracts();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Contratos de locação" : "Rental contracts"}
        description={pt
          ? "Inquilino, valores, garantia, reajuste e prazo de cada locação administrada."
          : "Tenant, amounts, guarantee, adjustment and term of every managed rental."}
        count={contracts.length}
        action={
          <Button size="sm" className="gap-1" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> {pt ? "Novo contrato" : "New contract"}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "active", "notice", "ended", "draft"] as (ContractStatus | "all")[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "all" ? (pt ? "Todos" : "All") : contractStatusLabel(s, pt)}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="h-7 w-7" />}
          title={pt ? "Nenhum contrato por aqui" : "No contracts yet"}
          description={pt
            ? "Cadastre uma locação para acompanhar aluguéis, repasses e reajustes pela plataforma."
            : "Add a rental to track charges, payouts and adjustments here."}
          action={
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              {pt ? "Cadastrar locação" : "Add rental"}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const remaining = daysUntil(c.end_date);
            const fee = adminFee(Number(c.rent_amount), Number(c.admin_fee_percent));
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{c.tenant_name}</p>
                        <Badge variant={c.status === "active" ? "default" : "secondary"}>
                          {contractStatusLabel(c.status, pt)}
                        </Badge>
                        {c.status !== "ended" && remaining <= 90 && (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">
                            {remaining < 0
                              ? (pt ? "Prazo vencido" : "Term expired")
                              : pt ? `Vence em ${remaining} dias` : `Ends in ${remaining} days`}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {c.property_label || (pt ? "Imóvel não identificado" : "Unnamed property")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setAdjustTarget(c)}>
                        <TrendingUp className="h-3.5 w-3.5" /> {pt ? "Reajustar" : "Adjust"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => regenerate(c)}
                        title={pt ? "Gerar parcelas que faltam" : "Generate missing charges"}>
                        <RefreshCw className="h-3.5 w-3.5" /> {pt ? "Parcelas" : "Charges"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Aluguel" : "Rent"}</p>
                      <p className="font-medium">{brl(Number(c.rent_amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Taxa de adm." : "Mgmt fee"}</p>
                      <p className="font-medium">{brl(fee)} <span className="text-xs text-muted-foreground">({Number(c.admin_fee_percent)}%)</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Vigência" : "Term"}</p>
                      <p className="font-medium">{formatDate(c.start_date, pt)} – {formatDate(c.end_date, pt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Reajuste" : "Adjustment"}</p>
                      <p className="font-medium">
                        {indexLabel(c.adjustment_index, pt)}
                        {c.next_adjustment_date ? ` • ${formatDate(c.next_adjustment_date, pt)}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Garantia" : "Guarantee"}</p>
                      <p className="font-medium">{guaranteeLabel(c.guarantee_type, pt)}</p>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                      <FileSignature className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {c.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <RentalContractForm
        userId={userId}
        open={formOpen}
        onOpenChange={setFormOpen}
        contract={editing}
        onSaved={fetchContracts}
      />

      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? "Aplicar reajuste" : "Apply adjustment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {pt
                ? `Aluguel atual: ${brl(Number(adjustTarget?.rent_amount ?? 0))}. O novo valor vale para as parcelas futuras ainda não pagas.`
                : `Current rent: ${brl(Number(adjustTarget?.rent_amount ?? 0))}. The new amount applies to future unpaid charges.`}
            </p>
            <div>
              <Label>{pt ? "Percentual do índice (%)" : "Index percentage (%)"}</Label>
              <Input inputMode="decimal" value={adjustPercent} onChange={(e) => setAdjustPercent(e.target.value)} placeholder="4,5" />
            </div>
            {adjustTarget && adjustPercent && (
              <p className="text-sm">
                {pt ? "Novo aluguel: " : "New rent: "}
                <span className="font-semibold">
                  {brl(Number(adjustTarget.rent_amount) * (1 + (Number(adjustPercent.replace(",", ".")) || 0) / 100))}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={applyAdjustment} disabled={adjustSaving}>
              {adjustSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Aplicar" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pt ? "Excluir contrato?" : "Delete contract?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pt
                ? "Os aluguéis e vistorias vinculados a este contrato também serão excluídos."
                : "Charges and inspections linked to this contract will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{pt ? "Cancelar" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{pt ? "Excluir" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RentalContracts;
