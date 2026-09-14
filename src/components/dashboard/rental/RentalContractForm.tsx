import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  contractStatusLabel, guaranteeLabel, indexLabel,
  type ContractStatus, type GuaranteeType, type RentalContract, type RentalIndex,
} from "@/lib/rentals";
import RentalDocumentsVault, { type PendingDocument } from "./RentalDocumentsVault";
import { MaskedCpfInput } from "@/components/MaskedCpf";

interface PropertyOption {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  price: number;
  condo_fee: number | null;
  iptu: number | null;
}

interface Props {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: RentalContract | null;
  onSaved: () => void;
}

const emptyForm = {
  property_id: "",
  property_label: "",
  tenant_name: "",
  tenant_email: "",
  tenant_phone: "",
  tenant_cpf: "",
  owner_name: "",
  owner_phone: "",
  rent_amount: "",
  condo_fee: "",
  iptu: "",
  other_charges: "",
  admin_fee_percent: "10",
  adjustment_index: "igpm" as RentalIndex,
  next_adjustment_date: "",
  guarantee_type: "none" as GuaranteeType,
  guarantee_details: "",
  start_date: "",
  end_date: "",
  due_day: "5",
  status: "active" as ContractStatus,
  notes: "",
};

const RentalContractForm = ({ userId, open, onOpenChange, contract, onSaved }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [form, setForm] = useState(emptyForm);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("properties")
      .select("id, title, city, neighborhood, price, condo_fee, iptu")
      .eq("user_id", userId)
      .eq("listing_type", "rent")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProperties(data ?? []));
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    if (contract) {
      setForm({
        property_id: contract.property_id ?? "",
        property_label: contract.property_label ?? "",
        tenant_name: contract.tenant_name,
        tenant_email: contract.tenant_email ?? "",
        tenant_phone: contract.tenant_phone ?? "",
        tenant_cpf: contract.tenant_cpf ?? "",
        owner_name: contract.owner_name ?? "",
        owner_phone: contract.owner_phone ?? "",
        rent_amount: String(contract.rent_amount ?? ""),
        condo_fee: String(contract.condo_fee ?? ""),
        iptu: String(contract.iptu ?? ""),
        other_charges: String(contract.other_charges ?? ""),
        admin_fee_percent: String(contract.admin_fee_percent ?? ""),
        adjustment_index: contract.adjustment_index,
        next_adjustment_date: contract.next_adjustment_date ?? "",
        guarantee_type: contract.guarantee_type,
        guarantee_details: contract.guarantee_details ?? "",
        start_date: contract.start_date,
        end_date: contract.end_date,
        due_day: String(contract.due_day ?? 5),
        status: contract.status,
        notes: contract.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setPendingDocs([]);
  }, [open, contract]);

  const set = (key: keyof typeof emptyForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickProperty = (id: string) => {
    const p = properties.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      property_id: id,
      property_label: p ? `${p.title} — ${[p.neighborhood, p.city].filter(Boolean).join(", ")}` : f.property_label,
      rent_amount: f.rent_amount || (p ? String(p.price) : ""),
      condo_fee: f.condo_fee || (p?.condo_fee ? String(p.condo_fee) : ""),
      iptu: f.iptu || (p?.iptu ? String(p.iptu) : ""),
    }));
  };

  const num = (v: string) => (v === "" ? 0 : Number(v.replace(",", ".")) || 0);

  const handleSubmit = async () => {
    if (!form.tenant_name.trim()) {
      toast.error(pt ? "Informe o nome do inquilino." : "Enter the tenant name.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error(pt ? "Informe o início e o fim do contrato." : "Enter the contract start and end dates.");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error(pt ? "O fim do contrato deve ser depois do início." : "End date must be after the start date.");
      return;
    }
    if (num(form.rent_amount) <= 0) {
      toast.error(pt ? "Informe o valor do aluguel." : "Enter the rent amount.");
      return;
    }

    setSaving(true);
    const payload = {
      broker_id: userId,
      property_id: form.property_id || null,
      property_label: form.property_label.trim() || null,
      tenant_name: form.tenant_name.trim(),
      tenant_email: form.tenant_email.trim() || null,
      tenant_phone: form.tenant_phone.trim() || null,
      tenant_cpf: form.tenant_cpf.trim() || null,
      owner_name: form.owner_name.trim() || null,
      owner_phone: form.owner_phone.trim() || null,
      rent_amount: num(form.rent_amount),
      condo_fee: num(form.condo_fee),
      iptu: num(form.iptu),
      other_charges: num(form.other_charges),
      admin_fee_percent: num(form.admin_fee_percent),
      adjustment_index: form.adjustment_index,
      next_adjustment_date: form.next_adjustment_date || null,
      guarantee_type: form.guarantee_type,
      guarantee_details: form.guarantee_details.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      due_day: Math.min(Math.max(Number(form.due_day) || 5, 1), 28),
      status: form.status,
      notes: form.notes.trim() || null,
    };

    if (contract) {
      const { error } = await supabase.from("rental_contracts").update(payload).eq("id", contract.id);
      setSaving(false);
      if (error) {
        toast.error(pt ? "Não foi possível salvar o contrato." : "Could not save the contract.");
        return;
      }
      toast.success(pt ? "Contrato atualizado." : "Contract updated.");
    } else {
      const { data, error } = await supabase.from("rental_contracts").insert(payload).select("id").single();
      if (error || !data) {
        setSaving(false);
        toast.error(pt ? "Não foi possível criar o contrato." : "Could not create the contract.");
        return;
      }
      const { data: created, error: genError } = await supabase.rpc("generate_rental_charges", {
        _contract_id: data.id,
      });

      if (pendingDocs.length) {
        const { error: docError } = await supabase.from("rental_documents").insert(
          pendingDocs.map((d) => ({
            contract_id: data.id,
            broker_id: userId,
            name: d.name,
            document_type: d.document_type || null,
            file_path: d.file_path,
          })),
        );
        if (docError) {
          toast.error(pt ? "Contrato criado, mas os documentos não foram vinculados." : "Contract created, but documents were not linked.");
        }
      }

      setSaving(false);
      if (genError) {
        toast.error(pt ? "Contrato criado, mas as parcelas não foram geradas." : "Contract created, but charges were not generated.");
      } else {
        toast.success(
          pt ? `Contrato criado com ${created ?? 0} aluguéis programados.` : `Contract created with ${created ?? 0} scheduled charges.`,
        );
      }
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contract ? (pt ? "Editar contrato" : "Edit contract") : pt ? "Novo contrato de locação" : "New rental contract"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{pt ? "Imóvel anunciado" : "Listed property"}</Label>
            <Select value={form.property_id} onValueChange={pickProperty}>
              <SelectTrigger><SelectValue placeholder={pt ? "Selecione um imóvel de aluguel" : "Select a rental listing"} /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {pt ? "Opcional. Você também pode descrever o imóvel abaixo." : "Optional. You can also describe the property below."}
            </p>
          </div>

          <div className="sm:col-span-2">
            <Label>{pt ? "Identificação do imóvel" : "Property label"}</Label>
            <Input value={form.property_label} onChange={(e) => set("property_label", e.target.value)}
              placeholder={pt ? "Ex.: Apto 302 — Rua das Flores, 100" : "e.g. Unit 302 — 100 Flower St."} />
          </div>

          <div>
            <Label>{pt ? "Inquilino" : "Tenant"} *</Label>
            <Input value={form.tenant_name} onChange={(e) => set("tenant_name", e.target.value)} />
          </div>
          <div>
            <Label>CPF</Label>
            <MaskedCpfInput
              value={form.tenant_cpf}
              onChange={(v) => set("tenant_cpf", v)}
              recordType="rental_contracts"
              recordId={contract?.id ?? null}
              fieldName="tenant_cpf"
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <Label>{pt ? "WhatsApp do inquilino" : "Tenant WhatsApp"}</Label>
            <Input value={form.tenant_phone} onChange={(e) => set("tenant_phone", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "E-mail do inquilino" : "Tenant e-mail"}</Label>
            <Input type="email" value={form.tenant_email} onChange={(e) => set("tenant_email", e.target.value)} />
          </div>

          <div>
            <Label>{pt ? "Proprietário" : "Owner"}</Label>
            <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "WhatsApp do proprietário" : "Owner WhatsApp"}</Label>
            <Input value={form.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} />
          </div>

          <div>
            <Label>{pt ? "Aluguel (R$)" : "Rent (R$)"} *</Label>
            <Input inputMode="decimal" value={form.rent_amount} onChange={(e) => set("rent_amount", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "Taxa de administração (%)" : "Management fee (%)"}</Label>
            <Input inputMode="decimal" value={form.admin_fee_percent} onChange={(e) => set("admin_fee_percent", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "Condomínio (R$)" : "Condo fee (R$)"}</Label>
            <Input inputMode="decimal" value={form.condo_fee} onChange={(e) => set("condo_fee", e.target.value)} />
          </div>
          <div>
            <Label>IPTU (R$)</Label>
            <Input inputMode="decimal" value={form.iptu} onChange={(e) => set("iptu", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "Outros encargos (R$)" : "Other charges (R$)"}</Label>
            <Input inputMode="decimal" value={form.other_charges} onChange={(e) => set("other_charges", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "Dia de vencimento" : "Due day"}</Label>
            <Input inputMode="numeric" value={form.due_day} onChange={(e) => set("due_day", e.target.value)} />
          </div>

          <div>
            <Label>{pt ? "Início" : "Start"} *</Label>
            <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <Label>{pt ? "Fim" : "End"} *</Label>
            <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>

          <div>
            <Label>{pt ? "Índice de reajuste" : "Adjustment index"}</Label>
            <Select value={form.adjustment_index} onValueChange={(v) => set("adjustment_index", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["igpm", "ipca", "inpc", "none"] as RentalIndex[]).map((i) => (
                  <SelectItem key={i} value={i}>{indexLabel(i, pt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{pt ? "Próximo reajuste" : "Next adjustment"}</Label>
            <Input type="date" value={form.next_adjustment_date} onChange={(e) => set("next_adjustment_date", e.target.value)} />
          </div>

          <div>
            <Label>{pt ? "Garantia" : "Guarantee"}</Label>
            <Select value={form.guarantee_type} onValueChange={(v) => set("guarantee_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["none", "fiador", "caucao", "seguro_fianca", "titulo_capitalizacao"] as GuaranteeType[]).map((g) => (
                  <SelectItem key={g} value={g}>{guaranteeLabel(g, pt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{pt ? "Situação" : "Status"}</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["active", "notice", "ended", "draft"] as ContractStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{contractStatusLabel(s, pt)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>{pt ? "Detalhes da garantia" : "Guarantee details"}</Label>
            <Input value={form.guarantee_details} onChange={(e) => set("guarantee_details", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>{pt ? "Observações" : "Notes"}</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <RentalDocumentsVault
              userId={userId}
              contractId={contract?.id ?? null}
              pending={pendingDocs}
              onPendingChange={setPendingDocs}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{pt ? "Cancelar" : "Cancel"}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {contract ? (pt ? "Salvar" : "Save") : pt ? "Criar contrato" : "Create contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RentalContractForm;
