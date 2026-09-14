import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users, Calendar, FileText, TrendingUp, DollarSign, History, AlertTriangle, Clock, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import type { Tables } from "@/integrations/supabase/types";
import {
  ACTIVITY_TYPES,
  activityLabel,
  formatDateTime,
  formatDay,
  todayIso,
  type ActivityTypeKey,
} from "@/lib/pipelineActivities";

type PipelineItem = Tables<"sales_pipeline"> & {
  property?: { title: string; city: string } | null;
};

type Activity = Tables<"pipeline_activities">;

interface PropertyOption {
  id: string;
  title: string;
  price: number;
}

interface Props {
  userId: string;
}

export const STAGES = [
  { key: "lead", label: "Leads", labelEn: "Leads" },
  { key: "visit_scheduled", label: "Visita Agendada", labelEn: "Visit scheduled" },
  { key: "visited", label: "Visitado", labelEn: "Visited" },
  { key: "proposal", label: "Proposta", labelEn: "Proposal" },
  { key: "negotiation", label: "Negociação", labelEn: "Negotiation" },
  { key: "documentation", label: "Documentação", labelEn: "Documentation" },
  { key: "closed_won", label: "Fechado", labelEn: "Closed won" },
  { key: "closed_lost", label: "Perdido", labelEn: "Lost" },
] as const;

// Proposal and negotiation are the money stages — highlight them in the board.
const HIGHLIGHT_STAGES = ["proposal", "negotiation"];

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const SalesPipeline = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Deal detail + interaction history
  const [selected, setSelected] = useState<PipelineItem | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityType, setActivityType] = useState<ActivityTypeKey>("ligacao");
  const [activityDesc, setActivityDesc] = useState("");
  const [activityDate, setActivityDate] = useState(todayIso());
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");

  // Deal edit fields (migrated from the old Proposals screen)
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPropertyId, setEditPropertyId] = useState("none");
  const [editStage, setEditStage] = useState("lead");
  const [editCommission, setEditCommission] = useState("");
  const [editExpectedClose, setEditExpectedClose] = useState("");
  const [editActualClose, setEditActualClose] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingDeal, setSavingDeal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [pipeRes, propsRes] = await Promise.all([
      supabase
        .from("sales_pipeline")
        .select("*, property:properties(title, city)")
        .eq("broker_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("properties").select("id, title, price").eq("user_id", userId),
    ]);
    setItems((pipeRes.data as PipelineItem[]) ?? []);
    setProperties((propsRes.data as PropertyOption[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateDeal = async () => {
    if (!clientName.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("sales_pipeline").insert({
      broker_id: userId,
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      notes: notes || null,
    });
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Lead criado!" : "Lead created!" });
      setClientName(""); setClientEmail(""); setClientPhone(""); setNotes("");
      setShowNewDeal(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleStageChange = async (itemId: string, newStage: string) => {
    const updateData: Record<string, unknown> = { stage: newStage };
    if (newStage === "closed_won" || newStage === "closed_lost") {
      updateData.actual_close_date = new Date().toISOString().split("T")[0];
    }
    const { error } = await supabase.from("sales_pipeline").update(updateData).eq("id", itemId);
    if (error) {
      toast({
        title: pt ? "Erro ao atualizar estágio" : "Error updating stage",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    fetchData();
  };

  const openDeal = async (item: PipelineItem) => {
    setSelected(item);
    setActivityType("ligacao");
    setActivityDesc("");
    setActivityDate(todayIso());
    setNextAction(item.next_action ?? "");
    setNextActionDate(item.next_action_date ?? "");
    setEditName(item.client_name ?? "");
    setEditEmail(item.client_email ?? "");
    setEditPhone(item.client_phone ?? "");
    setEditPropertyId(item.property_id ?? "none");
    setEditStage(item.stage);
    setEditCommission(item.commission_value?.toString() ?? "");
    setEditExpectedClose(item.expected_close_date ?? "");
    setEditActualClose(item.actual_close_date ?? "");
    setEditNotes(item.notes ?? "");
    setLoadingActivities(true);
    const { data } = await supabase
      .from("pipeline_activities")
      .select("*")
      .eq("pipeline_id", item.id)
      .order("occurred_at", { ascending: false });
    setActivities(data ?? []);
    setLoadingActivities(false);
  };

  const handleSaveDeal = async () => {
    if (!selected || !editName.trim()) return;
    setSavingDeal(true);
    const { error } = await supabase
      .from("sales_pipeline")
      .update({
        client_name: editName,
        client_email: editEmail || null,
        client_phone: editPhone || null,
        property_id: editPropertyId !== "none" ? editPropertyId : null,
        stage: editStage,
        commission_value: editCommission ? Number(editCommission) : null,
        expected_close_date: editExpectedClose || null,
        actual_close_date:
          editActualClose ||
          (editStage === "closed_won" || editStage === "closed_lost"
            ? new Date().toISOString().split("T")[0]
            : null),
        notes: editNotes || null,
      })
      .eq("id", selected.id);

    if (error) {
      toast({ title: pt ? "Erro ao salvar" : "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Negociação atualizada" : "Deal updated" });
      setSelected(null);
      fetchData();
    }
    setSavingDeal(false);
  };

  const handleDeleteDeal = async () => {
    if (!selected) return;
    if (!confirm(pt ? "Excluir esta negociação?" : "Delete this deal?")) return;
    const { error } = await supabase.from("sales_pipeline").delete().eq("id", selected.id);
    if (error) {
      toast({ title: pt ? "Erro ao excluir" : "Error deleting", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: pt ? "Excluído" : "Deleted" });
    setSelected(null);
    fetchData();
  };

  const handleAddActivity = async () => {
    if (!selected) return;
    setSavingActivity(true);
    const occurredAt = activityDate
      ? new Date(`${activityDate}T${new Date().toTimeString().slice(0, 8)}`).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("pipeline_activities").insert({
      pipeline_id: selected.id,
      broker_id: userId,
      activity_type: activityType,
      description: activityDesc || null,
      occurred_at: occurredAt,
    });

    if (error) {
      toast({ title: pt ? "Erro ao registrar" : "Error saving", description: error.message, variant: "destructive" });
      setSavingActivity(false);
      return;
    }

    const { error: upErr } = await supabase
      .from("sales_pipeline")
      .update({ next_action: nextAction || null, next_action_date: nextActionDate || null })
      .eq("id", selected.id);
    if (upErr) {
      toast({ title: pt ? "Erro ao salvar próxima ação" : "Error saving next action", description: upErr.message, variant: "destructive" });
    }

    toast({ title: pt ? "Interação registrada" : "Interaction saved" });
    setActivityDesc("");
    const refreshed = { ...selected, next_action: nextAction || null, next_action_date: nextActionDate || null };
    setSelected(refreshed);
    const { data } = await supabase
      .from("pipeline_activities")
      .select("*")
      .eq("pipeline_id", selected.id)
      .order("occurred_at", { ascending: false });
    setActivities(data ?? []);
    setSavingActivity(false);
    fetchData();
  };

  const stageLabel = (s: typeof STAGES[number]) => (pt ? s.label : s.labelEn);

  const totalLeads = items.filter((i) => i.stage === "lead").length;
  const visitsScheduled = items.filter((i) => i.stage === "visit_scheduled").length;
  const activeProposals = items.filter((i) => ["proposal", "negotiation"].includes(i.stage)).length;
  const closedWon = items.filter((i) => i.stage === "closed_won").length;
  const totalCommission = items
    .filter((i) => i.stage === "closed_won")
    .reduce((acc, i) => acc + (i.commission_value ?? 0), 0);

  const funnelData = STAGES.filter((s) => s.key !== "closed_lost").map((s) => ({
    name: stageLabel(s),
    value: items.filter((i) => i.stage === s.key).length,
  }));

  const byStage = STAGES.reduce<Record<string, PipelineItem[]>>((acc, s) => {
    acc[s.key] = items.filter((i) => i.stage === s.key);
    return acc;
  }, {});

  // Total amount in play per stage: linked property price, falling back to commission.
  const stageValue = (stageKey: string) =>
    (byStage[stageKey] ?? []).reduce((sum, item) => {
      const prop = properties.find((p) => p.id === item.property_id);
      return sum + (prop?.price ?? item.commission_value ?? 0);
    }, 0);

  const newDealDialog = (
    <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt ? "Adicionar Lead" : "Add Lead"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder={pt ? "Nome do cliente *" : "Client name *"} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <Input placeholder="Email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          <Input placeholder={pt ? "Telefone" : "Phone"} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          <Textarea placeholder={pt ? "Observações" : "Notes"} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button onClick={handleCreateDeal} disabled={submitting || !clientName.trim()} className="w-full">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pt ? "Criar Lead" : "Create Lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const dealDialog = (
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            {selected?.client_name}
          </DialogTitle>
        </DialogHeader>

        {selected && (
          <div className="space-y-6">
            {/* Deal data */}
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {pt ? "Dados da negociação" : "Deal details"}
              </p>
              <Input
                placeholder={pt ? "Nome do cliente *" : "Client name *"}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                <Input placeholder={pt ? "Telefone" : "Phone"} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Imóvel vinculado" : "Linked property"}</label>
                  <Select value={editPropertyId} onValueChange={setEditPropertyId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{pt ? "Nenhum" : "None"}</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title} — {formatBRL(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Estágio" : "Stage"}</label>
                  <Select value={editStage} onValueChange={setEditStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{stageLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Comissão (R$)" : "Commission (R$)"}</label>
                  <Input type="number" value={editCommission} onChange={(e) => setEditCommission(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Previsão fechamento" : "Expected close"}</label>
                  <Input type="date" value={editExpectedClose} onChange={(e) => setEditExpectedClose(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{pt ? "Fechamento efetivo" : "Actual close"}</label>
                  <Input type="date" value={editActualClose} onChange={(e) => setEditActualClose(e.target.value)} />
                </div>
              </div>
              <Textarea
                placeholder={pt ? "Observações" : "Notes"}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSaveDeal} disabled={savingDeal || !editName.trim()} className="flex-1">
                  {savingDeal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {pt ? "Salvar negociação" : "Save deal"}
                </Button>
                <Button variant="outline" className="gap-1 text-destructive" onClick={handleDeleteDeal}>
                  <Trash2 className="h-4 w-4" /> {pt ? "Excluir" : "Delete"}
                </Button>
              </div>
            </div>

            {selected.next_action && (
              <p className="text-xs text-muted-foreground">
                {pt ? "Próxima ação" : "Next action"}: {selected.next_action}
                {selected.next_action_date ? ` — ${formatDay(selected.next_action_date, pt)}` : ""}
              </p>
            )}

            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">
                {pt ? "Registrar interação" : "Log interaction"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityTypeKey)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((a) => (
                      <SelectItem key={a.key} value={a.key}>{pt ? a.label : a.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} />
              </div>
              <Textarea
                placeholder={pt ? "O que aconteceu nessa interação?" : "What happened in this interaction?"}
                value={activityDesc}
                onChange={(e) => setActivityDesc(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder={pt ? "Próxima ação (ex: enviar proposta)" : "Next action (e.g. send proposal)"}
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                />
                <Input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
              </div>
              <Button onClick={handleAddActivity} disabled={savingActivity} className="w-full">
                {savingActivity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pt ? "Salvar interação" : "Save interaction"}
              </Button>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">
                {pt ? "Histórico" : "History"}
              </p>
              {loadingActivities ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {pt ? "Nenhuma interação registrada ainda." : "No interactions logged yet."}
                </p>
              ) : (
                <ol className="space-y-3 border-l border-border pl-4">
                  {activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {activityLabel(a.activity_type, pt)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.occurred_at, pt)}</span>
                      </div>
                      {a.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{a.description}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );


  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Negociações" : "Deals"}
        description={pt ? "Acompanhe cada cliente da primeira conversa até o fechamento." : "Follow each client from first contact to closing."}
        count={items.length}
        action={
          <Button className="gap-1" onClick={() => setShowNewDeal(true)}>
            <Plus className="h-4 w-4" /> {pt ? "Novo lead" : "New lead"}
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Leads", value: totalLeads, icon: Users },
              { label: pt ? "Visitas" : "Visits", value: visitsScheduled, icon: Calendar },
              { label: pt ? "Propostas" : "Proposals", value: activeProposals, icon: FileText },
              { label: pt ? "Fechados" : "Closed", value: closedWon, icon: TrendingUp },
              { label: pt ? "Comissão" : "Commission", value: `R$ ${totalCommission.toLocaleString("pt-BR")}`, icon: DollarSign },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <kpi.icon className="h-4 w-4" />
                  <p className="text-xs">{kpi.label}</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={pt ? "Nenhuma negociação por aqui" : "No deals yet"}
              description={pt ? "Crie um lead manualmente ou converta um contato recebido." : "Create a lead manually or convert an incoming contact."}
              action={<Button onClick={() => setShowNewDeal(true)} className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo lead" : "New lead"}</Button>}
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{pt ? "Funil de conversão" : "Conversion funnel"}</CardTitle>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4" style={{ minWidth: STAGES.length * 240 }}>
                  {STAGES.map((stage) => {
                    const highlighted = HIGHLIGHT_STAGES.includes(stage.key);
                    const total = stageValue(stage.key);
                    return (
                      <div
                        key={stage.key}
                        className={`w-60 shrink-0 rounded-xl p-2 ${
                          highlighted ? "border-2 border-primary/60 bg-primary/5" : "border border-transparent"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <Badge variant={highlighted ? "default" : "secondary"}>{stageLabel(stage)}</Badge>
                          <span className="text-xs text-muted-foreground">{byStage[stage.key]?.length ?? 0}</span>
                        </div>
                        <p className={`mb-2 text-xs ${highlighted ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {pt ? "Em negociação" : "In play"}: {formatBRL(total)}
                        </p>
                        <div className="space-y-2">
                          {(byStage[stage.key] ?? []).map((item) => (
                            <div key={item.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                              <button
                                type="button"
                                onClick={() => openDeal(item)}
                                className="w-full space-y-1 text-left"
                              >
                                <p className="text-sm font-medium text-foreground hover:text-primary">{item.client_name}</p>
                                {item.property && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {item.property.title} — {item.property.city}
                                  </p>
                                )}
                                {item.client_phone && <p className="text-xs text-muted-foreground">{item.client_phone}</p>}
                                {item.commission_value != null && item.commission_value > 0 && (
                                  <p className="text-xs font-medium text-primary">
                                    R$ {item.commission_value.toLocaleString("pt-BR")}
                                  </p>
                                )}
                                {item.expected_close_date && (
                                  <p className="text-xs text-muted-foreground">
                                    {pt ? "Prev." : "Exp."} {formatDay(item.expected_close_date, pt)}
                                  </p>
                                )}
                                {item.next_action_date && (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      item.next_action_date < todayIso()
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                    }`}
                                  >
                                    {item.next_action_date < todayIso() ? (
                                      <AlertTriangle className="h-3 w-3" />
                                    ) : (
                                      <Clock className="h-3 w-3" />
                                    )}
                                    {item.next_action ?? (pt ? "Follow-up" : "Follow-up")} • {formatDay(item.next_action_date, pt)}
                                  </span>
                                )}
                              </button>
                              <Select value={item.stage} onValueChange={(v) => handleStageChange(item.id, v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STAGES.map((s) => (
                                    <SelectItem key={s.key} value={s.key}>{stageLabel(s)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {newDealDialog}
      {dealDialog}
    </div>
  );
};

export default SalesPipeline;
