import { useCallback, useEffect, useMemo, useState } from "react";
import { buildWhatsAppUrl, formatBrPhone } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit, Trash2, MessageCircle, Users, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import BuyerLeadMatches from "@/components/dashboard/BuyerLeadMatches";
import { PROPERTY_FEATURES } from "@/lib/propertyFeatures";
import {
  BUYER_STATUSES, BUYER_URGENCIES, FINANCING_TYPES,
  financingLabel, parseCriteria, statusLabel, urgencyLabel,
  fetchAvailableStock, propertyMatchesLead,
  type BuyerCriteria, type BuyerLead, type MatchableProperty,
} from "@/lib/buyerLeads";
import type { Enums } from "@/integrations/supabase/types";
import { ClientLink } from "@/components/dashboard/ClientSheet";

const PROPERTY_TYPES: Enums<"property_type">[] = ["apartment", "house", "land", "commercial"];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  userId: string;
}

interface FormState {
  id?: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  neighborhoods: string;
  property_types: Enums<"property_type">[];
  listing_type: string;
  bedrooms_min: string;
  area_min: string;
  features: string[];
  budget_min: string;
  budget_max: string;
  financing_type: string;
  urgency: string;
  status: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  name: "", phone: "", email: "", city: "", neighborhoods: "",
  property_types: [], listing_type: "sale", bedrooms_min: "", area_min: "",
  features: [], budget_min: "", budget_max: "", financing_type: "financiado",
  urgency: "pesquisando", status: "ativo", notes: "",
});

const BuyerLeads = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [leads, setLeads] = useState<BuyerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<BuyerLead | null>(null);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [stock, setStock] = useState<MatchableProperty[]>([]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("buyer_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: pt ? "Erro ao carregar clientes" : "Error loading clients", description: error.message, variant: "destructive" });
    setLeads(data ?? []);
    setLoading(false);
  }, [pt]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc("current_agency_id");
      const aid = (data as string | null) ?? null;
      if (cancelled) return;
      setAgencyId(aid);
      const rows = await fetchAvailableStock(userId, aid);
      if (!cancelled) setStock(rows);
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const matchCount = useCallback(
    (lead: BuyerLead) => stock.filter((p) => propertyMatchesLead(p, lead)).length,
    [stock],
  );

  const filtered = useMemo(
    () => leads.filter(
      (l) => (statusFilter === "all" || l.status === statusFilter) &&
        (urgencyFilter === "all" || l.urgency === urgencyFilter),
    ),
    [leads, statusFilter, urgencyFilter],
  );

  const openNew = () => { setForm(emptyForm()); setFormOpen(true); };

  const openEdit = (lead: BuyerLead) => {
    const c = parseCriteria(lead.criteria);
    setForm({
      id: lead.id,
      name: lead.name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      city: c.city ?? "",
      neighborhoods: (c.neighborhoods ?? []).join(", "),
      property_types: c.property_types ?? [],
      listing_type: c.listing_type ?? "sale",
      bedrooms_min: c.bedrooms_min != null ? String(c.bedrooms_min) : "",
      area_min: c.area_min != null ? String(c.area_min) : "",
      features: c.features ?? [],
      budget_min: lead.budget_min != null ? String(lead.budget_min) : "",
      budget_max: lead.budget_max != null ? String(lead.budget_max) : "",
      financing_type: lead.financing_type ?? "financiado",
      urgency: lead.urgency,
      status: lead.status,
      notes: lead.notes ?? "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: pt ? "Informe o nome do cliente" : "Enter the client name", variant: "destructive" });
      return;
    }
    setSaving(true);
    const criteria: BuyerCriteria = {
      city: form.city.trim() || null,
      neighborhoods: form.neighborhoods.split(",").map((n) => n.trim()).filter(Boolean),
      property_types: form.property_types,
      listing_type: (form.listing_type as Enums<"listing_type">) || null,
      bedrooms_min: form.bedrooms_min ? Number(form.bedrooms_min) : null,
      area_min: form.area_min ? Number(form.area_min) : null,
      features: form.features,
    };
    const payload = {
      broker_id: userId,
      agency_id: agencyId,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      criteria: JSON.parse(JSON.stringify(criteria)),
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      financing_type: form.financing_type || null,
      urgency: form.urgency,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    const { error } = form.id
      ? await supabase.from("buyer_leads").update(payload).eq("id", form.id)
      : await supabase.from("buyer_leads").insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: pt ? "Erro ao salvar" : "Error saving", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: form.id ? (pt ? "Cliente atualizado" : "Client updated") : (pt ? "Cliente cadastrado" : "Client created") });
    setFormOpen(false);
    fetchLeads();
  };

  const handleDelete = async (lead: BuyerLead) => {
    if (!confirm(pt ? `Excluir ${lead.name} da carteira?` : `Remove ${lead.name} from your book?`)) return;
    const { error } = await supabase.from("buyer_leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: pt ? "Erro ao excluir" : "Error deleting", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
  };

  const registerContact = async (lead: BuyerLead) => {
    const now = new Date().toISOString();
    await supabase.from("buyer_leads").update({ last_contact_at: now }).eq("id", lead.id);
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, last_contact_at: now } : l)));
  };

  const toggleFeature = (slug: string) =>
    setForm((f) => ({
      ...f,
      features: f.features.includes(slug) ? f.features.filter((s) => s !== slug) : [...f.features, slug],
    }));

  const toggleType = (type: Enums<"property_type">) =>
    setForm((f) => ({
      ...f,
      property_types: f.property_types.includes(type)
        ? f.property_types.filter((t) => t !== type)
        : [...f.property_types, type],
    }));

  const typeLabel: Record<Enums<"property_type">, string> = pt
    ? { apartment: "Apartamento", house: "Casa", land: "Terreno", commercial: "Comercial" }
    : { apartment: "Apartment", house: "House", land: "Land", commercial: "Commercial" };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Carteira de clientes" : "Buyer book"}
        description={pt
          ? "Cadastre compradores, o que cada um procura e envie os imóveis que combinam."
          : "Register buyers, what each one wants and send matching listings."}
        count={leads.length}
        action={<Button className="gap-1" onClick={openNew}><Plus className="h-4 w-4" /> {pt ? "Novo cliente" : "New client"}</Button>}
      />

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pt ? "Todas as situações" : "All statuses"}</SelectItem>
            {BUYER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s, pt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pt ? "Qualquer urgência" : "Any urgency"}</SelectItem>
            {BUYER_URGENCIES.map((u) => (
              <SelectItem key={u} value={u}>{urgencyLabel(u, pt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={pt ? "Nenhum cliente na carteira" : "No clients yet"}
          description={pt
            ? "Cadastre quem está comprando para receber os imóveis que combinam com cada perfil."
            : "Register your buyers to see which listings fit each profile."}
          action={<Button className="gap-1" onClick={openNew}><Plus className="h-4 w-4" /> {pt ? "Novo cliente" : "New client"}</Button>}
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((lead) => {
            const c = parseCriteria(lead.criteria);
            const count = matchCount(lead);
            return (
              <div key={lead.id} className="flex flex-wrap items-center gap-4 p-4">
                <div
                  role="button"
                  tabIndex={0}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => setDetail(lead)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setDetail(lead); }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ClientLink
                      name={lead.name}
                      phone={lead.phone}
                      email={lead.email}
                      className="truncate font-medium text-foreground"
                    />
                    <Badge variant={lead.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                      {statusLabel(lead.status, pt)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{urgencyLabel(lead.urgency, pt)}</Badge>
                    {count > 0 && (
                      <Badge className="gap-1 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">
                        <Building2 className="h-3 w-3" /> {count} {pt ? "imóveis" : "matches"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[c.city, (c.property_types ?? []).map((t) => typeLabel[t]).join("/")].filter(Boolean).join(" • ") || (pt ? "Sem critérios definidos" : "No criteria set")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {lead.budget_max ? `${pt ? "Até" : "Up to"} ${brl(Number(lead.budget_max))}` : ""}
                    {lead.financing_type ? ` • ${financingLabel(lead.financing_type, pt)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  {lead.phone && (buildWhatsAppUrl(lead.phone) ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      title={pt ? "Falar no WhatsApp" : "Chat on WhatsApp"}
                      onClick={() => {
                        const url = buildWhatsAppUrl(lead.phone, pt ? `Olá ${lead.name}!` : `Hi ${lead.name}!`);
                        if (!url) return;
                        window.open(url, "_blank");
                        registerContact(lead);
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="self-center text-xs text-muted-foreground" title={pt ? "Número não válido para WhatsApp" : "Number not valid for WhatsApp"}>
                      {formatBrPhone(lead.phone)}
                    </span>
                  ))}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(lead)}><Edit className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(lead)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client detail with matching properties */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">{pt ? "Telefone" : "Phone"}: </span>{detail.phone || "—"}</p>
                <p><span className="text-muted-foreground">E-mail: </span>{detail.email || "—"}</p>
                <p><span className="text-muted-foreground">{pt ? "Orçamento" : "Budget"}: </span>
                  {detail.budget_min ? brl(Number(detail.budget_min)) : "—"} – {detail.budget_max ? brl(Number(detail.budget_max)) : "—"}
                </p>
                <p><span className="text-muted-foreground">{pt ? "Pagamento" : "Payment"}: </span>{financingLabel(detail.financing_type, pt)}</p>
                <p><span className="text-muted-foreground">{pt ? "Urgência" : "Urgency"}: </span>{urgencyLabel(detail.urgency, pt)}</p>
                <p><span className="text-muted-foreground">{pt ? "Último contato" : "Last contact"}: </span>
                  {detail.last_contact_at ? new Date(detail.last_contact_at).toLocaleDateString(pt ? "pt-BR" : "en-US") : "—"}
                </p>
              </div>
              {detail.notes && <p className="rounded-lg bg-muted p-3 text-sm">{detail.notes}</p>}

              <div>
                <p className="mb-2 font-medium text-foreground">{pt ? "Imóveis que combinam" : "Matching properties"}</p>
                <BuyerLeadMatches lead={detail} brokerId={userId} agencyId={agencyId} stock={stock} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? (pt ? "Editar cliente" : "Edit client") : (pt ? "Novo cliente comprador" : "New buyer")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Nome *" : "Name *"}</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Telefone / WhatsApp" : "Phone / WhatsApp"}</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-mail</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Cidade" : "City"}</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Bairros de interesse" : "Neighborhoods"}</label>
                <Input
                  placeholder={pt ? "Separe por vírgula" : "Comma separated"}
                  value={form.neighborhoods}
                  onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">{pt ? "Tipo de imóvel" : "Property type"}</label>
              <div className="flex flex-wrap gap-3">
                {PROPERTY_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.property_types.includes(t)} onCheckedChange={() => toggleType(t)} />
                    {typeLabel[t]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Modalidade" : "Listing type"}</label>
                <Select value={form.listing_type} onValueChange={(v) => setForm({ ...form, listing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">{pt ? "Venda" : "Sale"}</SelectItem>
                    <SelectItem value="rent">{pt ? "Aluguel" : "Rent"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Forma de pagamento" : "Payment"}</label>
                <Select value={form.financing_type} onValueChange={(v) => setForm({ ...form, financing_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FINANCING_TYPES.map((f) => (
                      <SelectItem key={f} value={f}>{financingLabel(f, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Valor mínimo" : "Min price"}</label>
                <Input type="number" min="0" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Valor máximo" : "Max price"}</label>
                <Input type="number" min="0" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Quartos mín." : "Min bedrooms"}</label>
                <Input type="number" min="0" value={form.bedrooms_min} onChange={(e) => setForm({ ...form, bedrooms_min: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Área mín. (m²)" : "Min area (m²)"}</label>
                <Input type="number" min="0" value={form.area_min} onChange={(e) => setForm({ ...form, area_min: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">{pt ? "Características desejadas" : "Desired features"}</label>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-3">
                {PROPERTY_FEATURES.map((f) => (
                  <label key={f.slug} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.features.includes(f.slug)} onCheckedChange={() => toggleFeature(f.slug)} />
                    <span className="truncate">{pt ? f.pt : f.en}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Urgência" : "Urgency"}</label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUYER_URGENCIES.map((u) => (
                      <SelectItem key={u} value={u}>{urgencyLabel(u, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Situação" : "Status"}</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUYER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel(s, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt ? "Anotações" : "Notes"}</label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pt ? "Salvar cliente" : "Save client"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuyerLeads;
