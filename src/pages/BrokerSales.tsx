import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Users, TrendingUp, Calendar, DollarSign, FileText, Handshake, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import BrokerAgenda from "@/components/dashboard/BrokerAgenda";
import BrokerProposals from "@/components/dashboard/BrokerProposals";
import type { Tables } from "@/integrations/supabase/types";

type PipelineItem = Tables<"sales_pipeline"> & {
  property?: { title: string; city: string } | null;
};

type Partnership = Tables<"broker_partnerships"> & {
  partner_name?: string;
};

const STAGES = [
  { key: "lead", label: "Leads", color: "bg-blue-100 text-blue-800" },
  { key: "visit_scheduled", label: "Visita Agendada", color: "bg-yellow-100 text-yellow-800" },
  { key: "visited", label: "Visitado", color: "bg-orange-100 text-orange-800" },
  { key: "proposal", label: "Proposta", color: "bg-purple-100 text-purple-800" },
  { key: "negotiation", label: "Negociação", color: "bg-indigo-100 text-indigo-800" },
  { key: "documentation", label: "Documentação", color: "bg-cyan-100 text-cyan-800" },
  { key: "closed_won", label: "Fechado ✓", color: "bg-green-100 text-green-800" },
  { key: "closed_lost", label: "Perdido", color: "bg-red-100 text-red-800" },
] as const;

const BrokerSales = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);

  // New deal form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: pipeline } = await supabase
      .from("sales_pipeline")
      .select("*, property:properties(title, city)")
      .eq("broker_id", user.id)
      .order("created_at", { ascending: false });

    setItems((pipeline as PipelineItem[]) ?? []);

    const { data: parts } = await supabase
      .from("broker_partnerships")
      .select("*")
      .or(`broker_a_id.eq.${user.id},broker_b_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (parts && parts.length > 0) {
      const partnerIds = parts.map((p) =>
        p.broker_a_id === user.id ? p.broker_b_id : p.broker_a_id
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", partnerIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.user_id] = p.full_name ?? "Corretor"; });
      setPartnerships(parts.map((p) => {
        const partnerId = p.broker_a_id === user.id ? p.broker_b_id : p.broker_a_id;
        return { ...p, partner_name: nameMap[partnerId] ?? "Corretor" };
      }));
    } else {
      setPartnerships([]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateDeal = async () => {
    if (!user || !clientName.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("sales_pipeline").insert({
      broker_id: user.id,
      client_name: clientName,
      client_email: clientEmail || null,
      client_phone: clientPhone || null,
      notes: notes || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead criado!" });
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
      toast({ title: pt ? "Erro ao atualizar estágio" : "Error updating stage", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handlePartnershipAction = async (partnershipId: string, action: "active" | "declined") => {
    await supabase.from("broker_partnerships").update({ status: action }).eq("id", partnershipId);
    toast({ title: action === "active" ? "Parceria aceita!" : "Parceria recusada." });
    fetchData();
  };

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // KPIs
  const totalLeads = items.filter((i) => i.stage === "lead").length;
  const visitsScheduled = items.filter((i) => i.stage === "visit_scheduled").length;
  const activeProposals = items.filter((i) => ["proposal", "negotiation"].includes(i.stage)).length;
  const closedWon = items.filter((i) => i.stage === "closed_won").length;
  const totalCommission = items.filter((i) => i.stage === "closed_won").reduce((acc, i) => acc + (i.commission_value ?? 0), 0);

  // Funnel data
  const funnelData = STAGES.filter((s) => s.key !== "closed_lost").map((s) => ({
    name: s.label,
    value: items.filter((i) => i.stage === s.key).length,
  }));

  // Group by stage for kanban
  const byStage = STAGES.reduce<Record<string, PipelineItem[]>>((acc, s) => {
    acc[s.key] = items.filter((i) => i.stage === s.key);
    return acc;
  }, {});

  return (
    <div className="container py-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">
        {pt ? "Gestão de Vendas" : "Sales Management"}
      </h1>

      <Tabs defaultValue="pipeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pipeline" className="gap-1"><TrendingUp className="h-4 w-4" /> Pipeline</TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1"><FileText className="h-4 w-4" /> {pt ? "Propostas" : "Proposals"}</TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1"><CalendarDays className="h-4 w-4" /> {pt ? "Agenda" : "Calendar"}</TabsTrigger>
          <TabsTrigger value="partnerships" className="gap-1"><Handshake className="h-4 w-4" /> {pt ? "Parcerias" : "Partnerships"}</TabsTrigger>
        </TabsList>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-6">
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Leads", value: totalLeads, icon: Users, color: "text-primary" },
              { label: pt ? "Visitas" : "Visits", value: visitsScheduled, icon: Calendar, color: "text-primary" },
              { label: pt ? "Propostas" : "Proposals", value: activeProposals, icon: FileText, color: "text-primary" },
              { label: pt ? "Fechados" : "Closed", value: closedWon, icon: TrendingUp, color: "text-primary" },
              { label: pt ? "Comissão" : "Commission", value: `R$ ${totalCommission.toLocaleString("pt-BR")}`, icon: DollarSign, color: "text-primary" },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-bold">{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funnel chart */}
          {items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{pt ? "Funil de Conversão" : "Conversion Funnel"}</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* New deal */}
          <Dialog open={showNewDeal} onOpenChange={setShowNewDeal}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo Lead" : "New Lead"}</Button>
            </DialogTrigger>
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

          {/* Kanban */}
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4" style={{ minWidth: STAGES.length * 240 }}>
              {STAGES.map((stage) => (
                <div key={stage.key} className="w-60 shrink-0">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge className={stage.color}>{stage.label}</Badge>
                    <span className="text-xs text-muted-foreground">{byStage[stage.key]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(byStage[stage.key] ?? []).map((item) => (
                      <Card key={item.id} className="cursor-pointer">
                        <CardContent className="p-3 space-y-2">
                          <p className="font-medium text-sm">{item.client_name}</p>
                          {item.property && (
                            <p className="text-xs text-muted-foreground truncate">{item.property.title} — {item.property.city}</p>
                          )}
                          {item.client_phone && <p className="text-xs text-muted-foreground">{item.client_phone}</p>}
                          {item.commission_value != null && item.commission_value > 0 && (
                            <p className="text-xs font-medium text-primary">R$ {item.commission_value.toLocaleString("pt-BR")}</p>
                          )}
                          <Select value={item.stage} onValueChange={(v) => handleStageChange(item.id, v)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STAGES.map((s) => (
                                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals">
          <BrokerProposals userId={user.id} />
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda">
          <BrokerAgenda userId={user.id} />
        </TabsContent>

        {/* Partnerships Tab */}
        <TabsContent value="partnerships">
          <div className="space-y-4">
            {partnerships.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                {pt ? "Nenhuma parceria encontrada." : "No partnerships found."}
              </p>
            ) : (
              partnerships.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{p.partner_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pt ? "Comissão" : "Commission"}: {p.commission_split}% / {100 - (p.commission_split ?? 50)}%
                      </p>
                      {p.terms && <p className="mt-1 text-xs text-muted-foreground">{p.terms}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "active" ? "default" : p.status === "pending" ? "secondary" : "outline"}>
                        {p.status}
                      </Badge>
                      {p.status === "pending" && p.broker_b_id === user?.id && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handlePartnershipAction(p.id, "active")}>
                            {pt ? "Aceitar" : "Accept"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handlePartnershipAction(p.id, "declined")}>
                            {pt ? "Recusar" : "Decline"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrokerSales;
