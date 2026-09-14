import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { buildPixPayload, providerLabel } from "@/lib/pix";

export interface RentalBillingSettings {
  provider: string;
  provider_account_id: string | null;
  provider_connected_at: string | null;
  environment: string;
  api_key: string | null;
  webhook_token: string | null;
  auto_charge_enabled: boolean;
  pix_key: string | null;
  pix_key_type: string | null;
  beneficiary_name: string | null;
  beneficiary_city: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  instructions: string | null;
}

export const emptyBillingSettings: RentalBillingSettings = {
  provider: "manual",
  provider_account_id: null,
  provider_connected_at: null,
  environment: "sandbox",
  api_key: null,
  webhook_token: null,
  auto_charge_enabled: false,
  pix_key: null,
  pix_key_type: null,
  beneficiary_name: null,
  beneficiary_city: null,
  bank_name: null,
  bank_agency: null,
  bank_account: null,
  instructions: null,
};

const SELECT_COLUMNS =
  "provider, provider_account_id, provider_connected_at, environment, api_key, webhook_token, auto_charge_enabled, pix_key, pix_key_type, beneficiary_name, beneficiary_city, bank_name, bank_agency, bank_account, instructions";

export const fetchBillingSettings = async (userId: string): Promise<RentalBillingSettings | null> => {
  const { data } = await supabase
    .from("rental_payment_settings")
    .select(SELECT_COLUMNS)
    .eq("broker_id", userId)
    .maybeSingle();
  return data ?? null;
};

export const canGeneratePix = (s: RentalBillingSettings | null) =>
  !!s?.pix_key && !!s.beneficiary_name;

/** The broker connected a real billing account, so charges can be issued automatically. */
export const canIssueCharges = (s: RentalBillingSettings | null) =>
  !!s && s.provider !== "manual" && !!s.api_key && s.auto_charge_enabled;

interface Props {
  userId: string;
}

const RentalBilling = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [form, setForm] = useState<RentalBillingSettings>(emptyBillingSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBillingSettings(userId);
    if (data) setForm(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof RentalBillingSettings>(key: K, value: RentalBillingSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("rental_payment_settings").upsert(
      {
        broker_id: userId,
        provider: form.provider,
        environment: form.environment || "sandbox",
        api_key: form.provider === "manual" ? null : form.api_key?.trim() || null,
        auto_charge_enabled: form.provider === "manual" ? false : form.auto_charge_enabled,
        pix_key: form.pix_key?.trim() || null,
        pix_key_type: form.pix_key_type || null,
        beneficiary_name: form.beneficiary_name?.trim() || null,
        beneficiary_city: form.beneficiary_city?.trim() || null,
        bank_name: form.bank_name?.trim() || null,
        bank_agency: form.bank_agency?.trim() || null,
        bank_account: form.bank_account?.trim() || null,
        instructions: form.instructions?.trim() || null,
      },
      { onConflict: "broker_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(pt ? "Não foi possível salvar a configuração." : "Could not save the settings.");
      return;
    }
    toast.success(pt ? "Configuração de cobrança salva." : "Billing settings saved.");
    load();
  };

  const testConnection = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("rental-billing", { body: { action: "test" } });
    setTesting(false);
    if (error || data?.error) {
      toast.error(
        pt
          ? "Não foi possível conectar. Confira a chave e o ambiente escolhido."
          : "Could not connect. Check the key and the selected environment.",
      );
      return;
    }
    toast.success(
      pt ? `Conta conectada: ${data.account}` : `Account connected: ${data.account}`,
    );
    load();
  };

  const webhookUrl = form.webhook_token
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rental-webhook?token=${form.webhook_token}`
    : null;

  const preview = canGeneratePix(form)
    ? buildPixPayload({
        key: form.pix_key!,
        beneficiaryName: form.beneficiary_name!,
        beneficiaryCity: form.beneficiary_city ?? "",
        amount: 1500,
        reference: "EXEMPLO",
      })
    : null;

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Cobrança de aluguel" : "Rent billing"}
        description={pt
          ? "Configure como o inquilino paga. Você pode começar com sua chave Pix e ativar a cobrança automática quando quiser."
          : "Set up how tenants pay. Start with your own Pix key and enable automatic billing whenever you want."}
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{pt ? "Forma de cobrança" : "Billing method"}</Label>
              <Select value={form.provider} onValueChange={(v) => set("provider", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["manual", "mercadopago", "asaas", "pagarme"].map((p) => (
                    <SelectItem key={p} value={p}>{providerLabel(p, pt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.provider === "manual"
                  ? pt
                    ? "A plataforma gera o Pix copia e cola com sua chave e você registra o pagamento quando o dinheiro cair."
                    : "The platform generates the Pix code from your key and you record the payment when the money arrives."
                  : pt
                    ? "Cobrança automática com Pix e boleto. Falta conectar a conta — deixe os dados abaixo salvos e ativamos a conexão quando você tiver a conta."
                    : "Automatic Pix and bank slip billing. The account still needs to be connected — save the details below and we enable it once you have the account."}
              </p>
            </div>

            <div>
              <Label>{pt ? "Chave Pix" : "Pix key"}</Label>
              <Input value={form.pix_key ?? ""} onChange={(e) => set("pix_key", e.target.value)} />
            </div>
            <div>
              <Label>{pt ? "Tipo da chave" : "Key type"}</Label>
              <Select value={form.pix_key_type ?? ""} onValueChange={(v) => set("pix_key_type", v)}>
                <SelectTrigger><SelectValue placeholder={pt ? "Selecione" : "Select"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">{pt ? "E-mail" : "E-mail"}</SelectItem>
                  <SelectItem value="phone">{pt ? "Telefone" : "Phone"}</SelectItem>
                  <SelectItem value="random">{pt ? "Chave aleatória" : "Random key"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{pt ? "Nome do recebedor" : "Beneficiary name"}</Label>
              <Input value={form.beneficiary_name ?? ""} onChange={(e) => set("beneficiary_name", e.target.value)} />
            </div>
            <div>
              <Label>{pt ? "Cidade do recebedor" : "Beneficiary city"}</Label>
              <Input value={form.beneficiary_city ?? ""} onChange={(e) => set("beneficiary_city", e.target.value)} />
            </div>

            <div>
              <Label>{pt ? "Banco" : "Bank"}</Label>
              <Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} />
            </div>
            <div>
              <Label>{pt ? "Agência" : "Branch"}</Label>
              <Input value={form.bank_agency ?? ""} onChange={(e) => set("bank_agency", e.target.value)} />
            </div>
            <div>
              <Label>{pt ? "Conta" : "Account"}</Label>
              <Input value={form.bank_account ?? ""} onChange={(e) => set("bank_account", e.target.value)} />
            </div>

            <div className="sm:col-span-2">
              <Label>{pt ? "Instruções ao inquilino" : "Tenant instructions"}</Label>
              <Textarea rows={3} value={form.instructions ?? ""} onChange={(e) => set("instructions", e.target.value)}
                placeholder={pt ? "Ex.: pagamento até o dia 5, envie o comprovante por WhatsApp." : "e.g. pay by the 5th and send the receipt via WhatsApp."} />
            </div>
          </div>

          {form.provider !== "manual" && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{pt ? "Cobrança automática" : "Automatic billing"}</p>
                <p className="text-xs text-muted-foreground">
                  {pt
                    ? "Gera Pix e boleto por parcela e dá baixa sozinho. Fica pendente até a conta ser conectada."
                    : "Issues Pix and bank slips per charge and reconciles automatically. Pending until the account is connected."}
                </p>
              </div>
              <Switch checked={form.auto_charge_enabled} onCheckedChange={(v) => set("auto_charge_enabled", v)} />
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4 text-primary" />
                {pt ? "Exemplo de Pix copia e cola (R$ 1.500,00)" : "Sample Pix code (R$ 1,500.00)"}
              </div>
              <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{preview}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {pt ? "Dados visíveis apenas para você." : "Only you can see these details."}
            </p>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Salvar" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RentalBilling;
