import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Copy, Link2, Loader2, QrCode, Receipt, Undo2, MessageCircle, Zap } from "lucide-react";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import {
  brl, chargeMessage, chargeStatusClass, chargeStatusLabel, effectiveChargeStatus,
  formatCompetence, formatDate, monthKey,
  type ChargeStatus, type RentalCharge,
} from "@/lib/rentals";
import { buildPixPayload } from "@/lib/pix";
import { canGeneratePix, canIssueCharges, fetchBillingSettings, type RentalBillingSettings } from "./RentalBilling";
import { buildWhatsAppUrl, formatBrPhone } from "@/lib/phone";

interface ChargeRow extends RentalCharge {
  rental_contracts: {
    tenant_name: string;
    tenant_phone: string | null;
    tenant_email: string | null;
    property_label: string | null;
  } | null;
}

interface Props {
  userId: string;
}

const RentalCharges = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(monthKey(new Date()));
  const [status, setStatus] = useState<ChargeStatus | "all">("all");
  const [payTarget, setPayTarget] = useState<ChargeRow | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [linkTarget, setLinkTarget] = useState<ChargeRow | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState<RentalBillingSettings | null>(null);

  useEffect(() => { fetchBillingSettings(userId).then(setBilling); }, [userId]);

  const [issuing, setIssuing] = useState<string | null>(null);

  const issueCharge = async (charge: ChargeRow) => {
    setIssuing(charge.id);
    const { data, error } = await supabase.functions.invoke("rental-billing", {
      body: { action: "charge", chargeId: charge.id },
    });
    setIssuing(null);
    if (error || data?.error) {
      toast.error(pt ? "Não foi possível emitir a cobrança." : "Could not issue the charge.");
      return;
    }
    toast.success(pt ? "Cobrança emitida e enviada ao provedor." : "Charge issued with your provider.");
    fetchCharges();
  };

  const pixFor = useCallback(
    (charge: ChargeRow) =>
      charge.pix_payload
        ? charge.pix_payload
        : canGeneratePix(billing)
        ? buildPixPayload({
            key: billing!.pix_key!,
            beneficiaryName: billing!.beneficiary_name!,
            beneficiaryCity: billing!.beneficiary_city ?? "",
            amount: Number(charge.total_amount),
            reference: `ALUGUEL${charge.competence.replace("-", "")}`,
          })
        : null,
    [billing],
  );

  const fetchCharges = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rental_charges")
      .select("*, rental_contracts(tenant_name, tenant_phone, tenant_email, property_label)")
      .eq("broker_id", userId)
      .order("due_date", { ascending: true });
    if (error) toast.error(pt ? "Não foi possível carregar os aluguéis." : "Could not load charges.");
    setCharges((data ?? []) as ChargeRow[]);
    setLoading(false);
  }, [userId, pt]);

  useEffect(() => { fetchCharges(); }, [fetchCharges]);

  const months = useMemo(() => {
    const set = new Set(charges.map((c) => c.competence));
    set.add(monthKey(new Date()));
    return Array.from(set).sort().reverse();
  }, [charges]);

  const visible = useMemo(
    () =>
      charges.filter(
        (c) =>
          (month === "all" || c.competence === month) &&
          (status === "all" || effectiveChargeStatus(c) === status),
      ),
    [charges, month, status],
  );

  const totals = useMemo(() => {
    let expected = 0, received = 0, overdue = 0, fees = 0, payout = 0;
    visible.forEach((c) => {
      const s = effectiveChargeStatus(c);
      if (s === "cancelled") return;
      expected += Number(c.total_amount);
      fees += Number(c.admin_fee_amount);
      payout += Number(c.payout_amount);
      if (s === "paid") received += Number(c.paid_amount ?? c.total_amount);
      if (s === "overdue") overdue += Number(c.total_amount);
    });
    return { expected, received, overdue, fees, payout };
  }, [visible]);

  const openPay = (charge: ChargeRow) => {
    setPayTarget(charge);
    setPaidAmount(String(charge.total_amount));
    setPaidDate(new Date().toISOString().slice(0, 10));
  };

  const confirmPay = async () => {
    if (!payTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("rental_charges")
      .update({
        status: "paid",
        paid_amount: Number(paidAmount.replace(",", ".")) || Number(payTarget.total_amount),
        paid_at: paidDate || new Date().toISOString().slice(0, 10),
      })
      .eq("id", payTarget.id);
    setSaving(false);
    if (error) {
      toast.error(pt ? "Não foi possível registrar o pagamento." : "Could not record the payment.");
      return;
    }
    toast.success(pt ? "Pagamento registrado." : "Payment recorded.");
    setPayTarget(null);
    fetchCharges();
  };

  const reopen = async (charge: ChargeRow) => {
    const { error } = await supabase
      .from("rental_charges")
      .update({ status: "pending", paid_amount: null, paid_at: null })
      .eq("id", charge.id);
    if (error) {
      toast.error(pt ? "Não foi possível reabrir a cobrança." : "Could not reopen the charge.");
      return;
    }
    fetchCharges();
  };

  const saveLink = async () => {
    if (!linkTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("rental_charges")
      .update({ payment_link: linkValue.trim() || null })
      .eq("id", linkTarget.id);
    setSaving(false);
    if (error) {
      toast.error(pt ? "Não foi possível salvar o link." : "Could not save the link.");
      return;
    }
    toast.success(pt ? "Link de pagamento salvo." : "Payment link saved.");
    setLinkTarget(null);
    fetchCharges();
  };

  const extrasFor = (charge: ChargeRow) => ({
    pixCode: pixFor(charge),
    instructions: billing?.instructions ?? null,
  });

  const sendWhatsapp = (charge: ChargeRow) => {
    const contract = charge.rental_contracts;
    if (!contract?.tenant_phone) {
      toast.error(pt ? "Este inquilino não tem WhatsApp cadastrado." : "This tenant has no WhatsApp number.");
      return;
    }
    const url = buildWhatsAppUrl(contract.tenant_phone, chargeMessage(charge, contract, pt, extrasFor(charge)));
    if (!url) {
      toast.error(
        pt
          ? `O telefone ${formatBrPhone(contract.tenant_phone)} não é válido para WhatsApp.`
          : `The phone ${formatBrPhone(contract.tenant_phone)} is not valid for WhatsApp.`,
      );
      return;
    }
    window.open(url, "_blank");
  };

  const copyMessage = async (charge: ChargeRow) => {
    const contract = charge.rental_contracts ?? { tenant_name: "", property_label: null };
    await navigator.clipboard.writeText(chargeMessage(charge, contract, pt, extrasFor(charge)));
    toast.success(pt ? "Cobrança copiada." : "Invoice copied.");
  };

  const copyPix = async (charge: ChargeRow) => {
    const code = pixFor(charge);
    if (!code) {
      toast.error(pt
        ? "Cadastre sua chave Pix em Locação › Cobrança e recebimento."
        : "Add your Pix key under Rentals › Billing setup.");
      return;
    }
    await navigator.clipboard.writeText(code);
    toast.success(pt ? "Pix copia e cola copiado." : "Pix code copied.");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Aluguéis do mês" : "Monthly charges"}
        description={pt
          ? "Acompanhe recebimentos, atrasos e o repasse devido ao proprietário."
          : "Track receipts, overdue rent and the amount owed to the owner."}
        count={visible.length}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label className="text-xs">{pt ? "Competência" : "Period"}</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{pt ? "Todas" : "All"}</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{formatCompetence(m, pt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">{pt ? "Situação" : "Status"}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ChargeStatus | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{pt ? "Todas" : "All"}</SelectItem>
              {(["pending", "overdue", "paid", "cancelled"] as ChargeStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{chargeStatusLabel(s, pt)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: pt ? "Previsto" : "Expected", value: totals.expected },
          { label: pt ? "Recebido" : "Received", value: totals.received },
          { label: pt ? "Em atraso" : "Overdue", value: totals.overdue },
          { label: pt ? "Taxa de administração" : "Management fees", value: totals.fees },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-xl font-semibold">{brl(kpi.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title={pt ? "Nenhum aluguel nesta seleção" : "No charges in this selection"}
          description={pt
            ? "Cadastre um contrato de locação para gerar automaticamente os aluguéis mensais."
            : "Add a rental contract to generate the monthly charges automatically."}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const s = effectiveChargeStatus(c);
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{c.rental_contracts?.tenant_name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${chargeStatusClass(s)}`}>
                        {chargeStatusLabel(s, pt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.rental_contracts?.property_label || formatCompetence(c.competence, pt)}
                      {" • "}
                      {pt ? "vence " : "due "}{formatDate(c.due_date, pt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-display text-lg font-semibold">{brl(Number(c.total_amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        {pt ? "repasse " : "payout "}{brl(Number(c.payout_amount))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => sendWhatsapp(c)}>
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copyMessage(c)} title={pt ? "Copiar cobrança" : "Copy invoice"}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => copyPix(c)}
                        title={pt ? "Copiar Pix copia e cola" : "Copy Pix code"}>
                        <QrCode className={`h-3.5 w-3.5 ${canGeneratePix(billing) ? "text-primary" : ""}`} />
                      </Button>
                      {canIssueCharges(billing) && !c.provider_charge_id && s !== "paid" && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => issueCharge(c)}
                          disabled={issuing === c.id}>
                          {issuing === c.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Zap className="h-3.5 w-3.5" />}
                          {pt ? "Emitir" : "Issue"}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setLinkTarget(c); setLinkValue(c.payment_link ?? ""); }}
                        title={pt ? "Link de pagamento" : "Payment link"}>
                        <Link2 className={`h-3.5 w-3.5 ${c.payment_link ? "text-primary" : ""}`} />
                      </Button>
                      {s === "paid" ? (
                        <Button size="sm" variant="ghost" onClick={() => reopen(c)} title={pt ? "Reabrir" : "Reopen"}>
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" className="gap-1" onClick={() => openPay(c)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {pt ? "Dar baixa" : "Mark paid"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? "Registrar pagamento" : "Record payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{pt ? "Valor recebido (R$)" : "Amount received (R$)"}</Label>
              <Input inputMode="decimal" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </div>
            <div>
              <Label>{pt ? "Data do pagamento" : "Payment date"}</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={confirmPay} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Confirmar" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pt ? "Link de pagamento" : "Payment link"}</DialogTitle>
          </DialogHeader>
          <div>
            <Label>{pt ? "Cole o link do Pix, boleto ou checkout" : "Paste the Pix, bank slip or checkout link"}</Label>
            <Input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="https://" />
            <p className="mt-2 text-xs text-muted-foreground">
              {pt
                ? "O link entra na mensagem enviada ao inquilino por WhatsApp."
                : "The link is included in the WhatsApp message sent to the tenant."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>{pt ? "Cancelar" : "Cancel"}</Button>
            <Button onClick={saveLink} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Salvar" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RentalCharges;
