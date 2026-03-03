import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, DollarSign, FileText, Building2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BrokerProposalsProps {
  userId: string;
}

interface PropertyOption {
  id: string;
  title: string;
  price: number;
  city: string;
  state: string;
}

interface PipelineItem {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  stage: string;
  commission_value: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  property_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { key: "lead", labelPt: "Lead", labelEn: "Lead" },
  { key: "visit_scheduled", labelPt: "Visita Agendada", labelEn: "Visit Scheduled" },
  { key: "visited", labelPt: "Visitado", labelEn: "Visited" },
  { key: "proposal", labelPt: "Proposta", labelEn: "Proposal" },
  { key: "negotiation", labelPt: "Negociação", labelEn: "Negotiation" },
  { key: "documentation", labelPt: "Documentação", labelEn: "Documentation" },
  { key: "closed_won", labelPt: "Fechado ✓", labelEn: "Closed Won" },
  { key: "closed_lost", labelPt: "Perdido ✗", labelEn: "Closed Lost" },
];

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  visit_scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  visited: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  negotiation: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  documentation: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  closed_won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed_lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const BrokerProposals = ({ userId }: BrokerProposalsProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [items, setItems] = useState<PipelineItem[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [formClientName, setFormClientName] = useState("");
  const [formClientEmail, setFormClientEmail] = useState("");
  const [formClientPhone, setFormClientPhone] = useState("");
  const [formPropertyId, setFormPropertyId] = useState("");
  const [formStage, setFormStage] = useState("lead");
  const [formCommission, setFormCommission] = useState("");
  const [formExpectedClose, setFormExpectedClose] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pipeRes, propsRes] = await Promise.all([
      supabase
        .from("sales_pipeline")
        .select("id, client_name, client_email, client_phone, stage, commission_value, expected_close_date, actual_close_date, property_id, notes, created_at, updated_at")
        .eq("broker_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("properties")
        .select("id, title, price, city, state")
        .eq("user_id", userId),
    ]);
    setItems((pipeRes.data as PipelineItem[]) ?? []);
    setProperties((propsRes.data as PropertyOption[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormClientName("");
    setFormClientEmail("");
    setFormClientPhone("");
    setFormPropertyId("");
    setFormStage("lead");
    setFormCommission("");
    setFormExpectedClose("");
    setFormNotes("");
    setEditId(null);
  };

  const openEdit = (item: PipelineItem) => {
    setFormClientName(item.client_name);
    setFormClientEmail(item.client_email ?? "");
    setFormClientPhone(item.client_phone ?? "");
    setFormPropertyId(item.property_id ?? "");
    setFormStage(item.stage);
    setFormCommission(item.commission_value?.toString() ?? "");
    setFormExpectedClose(item.expected_close_date ?? "");
    setFormNotes(item.notes ?? "");
    setEditId(item.id);
    setShowNew(true);
  };

  const handleSave = async () => {
    if (!formClientName.trim()) return;
    setSubmitting(true);

    const data: Record<string, unknown> = {
      client_name: formClientName,
      client_email: formClientEmail || null,
      client_phone: formClientPhone || null,
      property_id: formPropertyId && formPropertyId !== "none" ? formPropertyId : null,
      stage: formStage,
      commission_value: formCommission ? Number(formCommission) : null,
      expected_close_date: formExpectedClose || null,
      notes: formNotes || null,
    };

    if (formStage === "closed_won" || formStage === "closed_lost") {
      data.actual_close_date = new Date().toISOString().split("T")[0];
    }

    let error;
    if (editId) {
      ({ error } = await supabase.from("sales_pipeline").update(data as any).eq("id", editId));
    } else {
      ({ error } = await supabase.from("sales_pipeline").insert({ ...data, broker_id: userId } as any));
    }

    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? (pt ? "Atualizado!" : "Updated!") : (pt ? "Proposta criada!" : "Proposal created!") });
      setShowNew(false);
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(pt ? "Excluir esta proposta?" : "Delete this proposal?")) return;
    await supabase.from("sales_pipeline").delete().eq("id", id);
    fetchData();
    toast({ title: pt ? "Excluído" : "Deleted" });
  };

  const stageLabel = (key: string) => {
    const s = STAGES.find((s) => s.key === key);
    return s ? (pt ? s.labelPt : s.labelEn) : key;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Summary
  const activeDeals = items.filter((i) => !["closed_won", "closed_lost"].includes(i.stage));
  const closedWon = items.filter((i) => i.stage === "closed_won");
  const closedLost = items.filter((i) => i.stage === "closed_lost");
  const totalCommission = closedWon.reduce((sum, i) => sum + (i.commission_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          {pt ? "Propostas e Fechamentos" : "Proposals & Closings"}
        </h2>
        <Dialog open={showNew} onOpenChange={(open) => { setShowNew(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Nova Proposta" : "New Proposal"}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? (pt ? "Editar Proposta" : "Edit Proposal") : (pt ? "Nova Proposta" : "New Proposal")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder={pt ? "Nome do cliente *" : "Client name *"} value={formClientName} onChange={(e) => setFormClientName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Email" value={formClientEmail} onChange={(e) => setFormClientEmail(e.target.value)} />
                <Input placeholder={pt ? "Telefone" : "Phone"} value={formClientPhone} onChange={(e) => setFormClientPhone(e.target.value)} />
              </div>
              {properties.length > 0 && (
                <Select value={formPropertyId} onValueChange={setFormPropertyId}>
                  <SelectTrigger><SelectValue placeholder={pt ? "Vincular imóvel" : "Link property"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{pt ? "Nenhum" : "None"}</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} — {formatCurrency(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={formStage} onValueChange={setFormStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{pt ? s.labelPt : s.labelEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Comissão (R$)" : "Commission (R$)"}</label>
                  <Input type="number" value={formCommission} onChange={(e) => setFormCommission(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Previsão fechamento" : "Expected close"}</label>
                  <Input type="date" value={formExpectedClose} onChange={(e) => setFormExpectedClose(e.target.value)} />
                </div>
              </div>
              <Textarea placeholder={pt ? "Observações" : "Notes"} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
              <Button onClick={handleSave} disabled={submitting || !formClientName.trim()} className="w-full">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editId ? (pt ? "Salvar" : "Save") : (pt ? "Criar" : "Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold">{activeDeals.length}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Em andamento" : "Active"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold">{closedWon.length}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Fechados" : "Won"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-xl font-bold">{formatCurrency(totalCommission)}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Comissões" : "Commissions"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="mx-auto h-5 w-5 text-destructive" />
            <p className="mt-1 text-xl font-bold">{closedLost.length}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Perdidos" : "Lost"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Proposals list */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {pt ? "Nenhuma proposta cadastrada. Crie uma para começar a acompanhar." : "No proposals yet. Create one to start tracking."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const prop = properties.find((p) => p.id === item.property_id);
            return (
              <Card key={item.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(item)}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{item.client_name}</p>
                      <Badge className={`text-[10px] ${STAGE_COLORS[item.stage] ?? ""}`}>
                        {stageLabel(item.stage)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {prop && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {prop.title}
                        </span>
                      )}
                      {item.commission_value != null && item.commission_value > 0 && (
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <DollarSign className="h-3 w-3" /> {formatCurrency(item.commission_value)}
                        </span>
                      )}
                      {item.expected_close_date && (
                        <span>{pt ? "Prev:" : "Exp:"} {format(new Date(item.expected_close_date), "dd/MM/yy")}</span>
                      )}
                    </div>
                    {item.notes && <p className="mt-1 text-xs text-muted-foreground truncate">{item.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    ✕
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrokerProposals;
