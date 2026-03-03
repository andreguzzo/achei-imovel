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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Users, TrendingUp, Calendar, DollarSign, FileText, Handshake,
  CalendarDays, Mail, UserPlus, Search, BarChart3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import BrokerAgenda from "@/components/dashboard/BrokerAgenda";
import BrokerProposals from "@/components/dashboard/BrokerProposals";
import BrokerAnalytics from "@/components/dashboard/BrokerAnalytics";
import type { Tables } from "@/integrations/supabase/types";

type PipelineItem = Tables<"sales_pipeline"> & {
  property?: { title: string; city: string } | null;
};

type Partnership = Tables<"broker_partnerships"> & {
  partner_name?: string;
};

type ContactRequest = Tables<"contact_requests"> & {
  properties?: { title: string } | null;
};

interface BrokerProfile {
  user_id: string;
  full_name: string | null;
  creci: string | null;
  avatar_url: string | null;
  phone: string | null;
}

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

interface DashboardSalesTabProps {
  userId: string;
}

const DashboardSalesTab = ({ userId }: DashboardSalesTabProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDeal, setShowNewDeal] = useState(false);

  // Partner search
  const [brokerSearch, setBrokerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BrokerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerProfile | null>(null);
  const [commSplit, setCommSplit] = useState("50");
  const [partnerTerms, setPartnerTerms] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [pipelineRes, partsRes, contactsRes] = await Promise.all([
      supabase
        .from("sales_pipeline")
        .select("*")
        .eq("broker_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("broker_partnerships")
        .select("*")
        .or(`broker_a_id.eq.${userId},broker_b_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_requests")
        .select("*, properties:property_id(title, user_id)")
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setItems((pipelineRes.data as PipelineItem[]) ?? []);
    setContacts((contactsRes.data as any) ?? []);

    if (partsRes.data) {
      const enriched: Partnership[] = [];
      for (const p of partsRes.data) {
        const partnerId = p.broker_a_id === userId ? p.broker_b_id : p.broker_a_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", partnerId)
          .single();
        enriched.push({ ...p, partner_name: profile?.full_name ?? "Corretor" });
      }
      setPartnerships(enriched);
    }

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
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Lead criado!" : "Lead created!" });
      setClientName(""); setClientEmail(""); setClientPhone(""); setNotes("");
      setShowNewDeal(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleConvertContactToLead = async (contact: ContactRequest) => {
    const { error } = await supabase.from("sales_pipeline").insert({
      broker_id: userId,
      client_name: contact.name,
      client_email: contact.email || null,
      client_phone: contact.phone || null,
      property_id: contact.property_id || null,
      notes: contact.message || null,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Contato convertido em lead!" : "Contact converted to lead!" });
      fetchData();
    }
  };

  const handleStageChange = async (itemId: string, newStage: string) => {
    const updateData: Record<string, unknown> = { stage: newStage };
    if (newStage === "closed_won" || newStage === "closed_lost") {
      updateData.actual_close_date = new Date().toISOString().split("T")[0];
    }
    await supabase.from("sales_pipeline").update(updateData).eq("id", itemId);
    fetchData();
  };

  const handlePartnershipAction = async (partnershipId: string, action: "active" | "declined") => {
    await supabase.from("broker_partnerships").update({ status: action }).eq("id", partnershipId);
    toast({ title: action === "active" ? (pt ? "Parceria aceita!" : "Partnership accepted!") : (pt ? "Parceria recusada." : "Partnership declined.") });
    fetchData();
  };

  const handleSearchBrokers = async () => {
    if (brokerSearch.trim().length < 2) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, creci, avatar_url, phone")
      .neq("user_id", userId)
      .or(`full_name.ilike.%${brokerSearch}%,creci.ilike.%${brokerSearch}%`)
      .limit(10);
    setSearchResults((data as BrokerProfile[]) ?? []);
    setSearching(false);
  };

  const handleSendPartnership = async () => {
    if (!selectedBroker) return;
    setSendingProposal(true);
    const { data: groupId, error: groupError } = await supabase
      .rpc("create_partnership_group", { _broker_a: userId, _broker_b: selectedBroker.user_id });

    if (groupError || !groupId) {
      toast({ title: pt ? "Erro" : "Error", variant: "destructive" });
      setSendingProposal(false);
      return;
    }

    const { error } = await supabase.from("broker_partnerships").insert({
      group_id: groupId,
      broker_a_id: userId,
      broker_b_id: selectedBroker.user_id,
      commission_split: Number(commSplit),
      terms: partnerTerms || null,
    });

    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Proposta enviada!" : "Proposal sent!" });
      setSelectedBroker(null);
      setPartnerTerms("");
      await fetchData();
    }
    setSendingProposal(false);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const totalLeads = items.filter((i) => i.stage === "lead").length;
  const visitsScheduled = items.filter((i) => i.stage === "visit_scheduled").length;
  const activeProposals = items.filter((i) => ["proposal", "negotiation"].includes(i.stage)).length;
  const closedWon = items.filter((i) => i.stage === "closed_won").length;
  const totalCommission = items.filter((i) => i.stage === "closed_won").reduce((acc, i) => acc + (i.commission_value ?? 0), 0);

  const funnelData = STAGES.filter((s) => s.key !== "closed_lost").map((s) => ({
    name: s.label,
    value: items.filter((i) => i.stage === s.key).length,
  }));

  const byStage = STAGES.reduce<Record<string, PipelineItem[]>>((acc, s) => {
    acc[s.key] = items.filter((i) => i.stage === s.key);
    return acc;
  }, {});

  const statusLabels: Record<string, string> = pt
    ? { pending: "Pendente", active: "Ativa", declined: "Recusada", completed: "Concluída" }
    : { pending: "Pending", active: "Active", declined: "Declined", completed: "Completed" };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="pipeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pipeline" className="gap-1"><TrendingUp className="h-4 w-4" /> Pipeline</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1"><Mail className="h-4 w-4" /> {pt ? "Contatos" : "Contacts"}</TabsTrigger>
          <TabsTrigger value="proposals" className="gap-1"><FileText className="h-4 w-4" /> {pt ? "Propostas" : "Proposals"}</TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1"><CalendarDays className="h-4 w-4" /> {pt ? "Agenda" : "Calendar"}</TabsTrigger>
          <TabsTrigger value="partnerships" className="gap-1"><Handshake className="h-4 w-4" /> {pt ? "Parcerias" : "Partnerships"}</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-4 w-4" /> {pt ? "Relatórios" : "Reports"}</TabsTrigger>
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

          {/* Funnel */}
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

        {/* Contacts Tab - integrated with leads */}
        <TabsContent value="contacts">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {contacts.length} {pt ? "contatos recebidos" : "contacts received"}
              </p>
              <p className="text-xs text-muted-foreground">
                {pt ? "Converta contatos em leads para o pipeline" : "Convert contacts to leads for the pipeline"}
              </p>
            </div>
            {contacts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{pt ? "Nenhum contato recebido" : "No contacts received"}</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-sm text-muted-foreground">{c.email} {c.phone && `• ${c.phone}`}</p>
                          {(c as any).properties?.title && (
                            <p className="text-xs text-primary mt-1">{pt ? "Imóvel:" : "Property:"} {(c as any).properties.title}</p>
                          )}
                          {c.message && <p className="mt-2 text-sm text-muted-foreground border-l-2 border-muted pl-3">{c.message}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString(locale)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => handleConvertContactToLead(c)}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            {pt ? "Converter em Lead" : "Convert to Lead"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals">
          <BrokerProposals userId={userId} />
        </TabsContent>

        {/* Agenda Tab */}
        <TabsContent value="agenda">
          <BrokerAgenda userId={userId} />
        </TabsContent>

        {/* Partnerships Tab */}
        <TabsContent value="partnerships">
          <div className="space-y-6">
            {/* Search brokers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4" /> {pt ? "Buscar Corretores" : "Find Brokers"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder={pt ? "Buscar por nome ou CRECI..." : "Search by name or CRECI..."}
                    value={brokerSearch}
                    onChange={(e) => setBrokerSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchBrokers()}
                  />
                  <Button size="icon" onClick={handleSearchBrokers} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">{pt ? "Resultados" : "Results"}</p>
                    {searchResults.map((b) => (
                      <div key={b.user_id} className="flex items-center justify-between rounded p-2 hover:bg-accent">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={b.avatar_url ?? undefined} />
                            <AvatarFallback>{(b.full_name ?? "?")[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{b.full_name}</p>
                            {b.creci && <p className="text-xs text-muted-foreground">CRECI: {b.creci}</p>}
                          </div>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelectedBroker(b)}>
                              <Handshake className="h-3.5 w-3.5" /> {pt ? "Parceria" : "Partner"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{pt ? "Propor Parceria" : "Propose Partnership"}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                {pt ? `Parceria com ${b.full_name}` : `Partnership with ${b.full_name}`}
                              </p>
                              <div>
                                <label className="text-sm font-medium">{pt ? "Sua comissão (%)" : "Your commission (%)"}</label>
                                <Input type="number" value={commSplit} onChange={(e) => setCommSplit(e.target.value)} min="0" max="100" />
                              </div>
                              <div>
                                <label className="text-sm font-medium">{pt ? "Termos" : "Terms"}</label>
                                <Textarea value={partnerTerms} onChange={(e) => setPartnerTerms(e.target.value)} placeholder={pt ? "Descreva os termos..." : "Describe the terms..."} />
                              </div>
                              <Button onClick={handleSendPartnership} disabled={sendingProposal} className="w-full">
                                {sendingProposal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {pt ? "Enviar Proposta" : "Send Proposal"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Existing partnerships */}
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
                        {statusLabels[p.status] ?? p.status}
                      </Badge>
                      {p.status === "pending" && p.broker_b_id === userId && (
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

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <BrokerAnalytics userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardSalesTab;
