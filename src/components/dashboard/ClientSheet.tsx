import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Phone, Mail, MapPin, CalendarDays, TrendingUp, Inbox, Home, Save, Target,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchClientDossier, buildTimeline, stageLabel, activityTypeLabel,
  type ClientDossier, type ClientIdentity,
} from "@/lib/clientSheet";
import {
  fetchAvailableStock, propertyMatchesLead, parseCriteria, urgencyLabel, statusLabel,
  type MatchableProperty,
} from "@/lib/buyerLeads";
import { featureLabel } from "@/lib/propertyFeatures";

const ACTIVITY_TYPES = ["ligacao", "whatsapp", "email", "visita", "proposta", "observacao"];

interface Ctx {
  openClient: (identity: ClientIdentity) => void;
}

const ClientSheetContext = createContext<Ctx | null>(null);

export const useClientSheet = () => useContext(ClientSheetContext);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Client name rendered as a button that opens the single client sheet. */
export const ClientLink = ({
  name, phone, email, className,
}: ClientIdentity & { className?: string }) => {
  const ctx = useClientSheet();
  if (!name || !ctx) return <span className={className}>{name}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); ctx.openClient({ name, phone, email }); }}
      className={cn("text-left underline decoration-dotted underline-offset-2 hover:text-primary", className)}
    >
      {name}
    </button>
  );
};

const Section = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="space-y-2">
    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon} {title}</p>
    {children}
  </div>
);

const ClientSheetDialog = ({
  brokerId, identity, onClose,
}: { brokerId: string; identity: ClientIdentity; onClose: () => void }) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [dossier, setDossier] = useState<ClientDossier | null>(null);
  const [stock, setStock] = useState<MatchableProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState("observacao");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      fetchClientDossier(brokerId, identity),
      fetchAvailableStock(brokerId),
    ]);
    setDossier(d);
    setStock(s);
    setLoading(false);
  }, [brokerId, identity]);

  useEffect(() => { load(); }, [load]);

  const phone = dossier
    ? identity.phone
      || dossier.deals.find((d) => d.client_phone)?.client_phone
      || dossier.leads.find((l) => l.phone)?.phone
      || dossier.buyerLeads.find((b) => b.phone)?.phone
      || null
    : identity.phone ?? null;

  const email = dossier
    ? identity.email
      || dossier.deals.find((d) => d.client_email)?.client_email
      || dossier.leads.find((l) => l.email)?.email
      || dossier.buyerLeads.find((b) => b.email)?.email
      || null
    : identity.email ?? null;

  const firstContact = useMemo(() => {
    if (!dossier) return null;
    const all = [
      ...dossier.leads.map((l) => ({
        at: l.created_at,
        label: pt ? "Formulário do anúncio" : "Listing form",
        extra: l.properties?.title ?? null,
      })),
      ...dossier.deals.map((d) => ({
        at: d.created_at,
        label: pt ? "Cadastro manual no funil" : "Manually added to pipeline",
        extra: d.properties?.title ?? null,
      })),
      ...dossier.buyerLeads.map((b) => ({
        at: b.created_at,
        label: pt ? "Carteira de clientes" : "Buyer book",
        extra: null,
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return all[0] ?? null;
  }, [dossier, pt]);

  const timeline = useMemo(() => (dossier ? buildTimeline(dossier, pt) : []), [dossier, pt]);

  const matches = useMemo(() => {
    if (!dossier || !dossier.buyerLeads.length) return [];
    const byId = new Map<string, MatchableProperty>();
    dossier.buyerLeads.forEach((lead) => {
      stock.filter((p) => propertyMatchesLead(p, lead)).forEach((p) => byId.set(p.id, p));
    });
    return Array.from(byId.values());
  }, [dossier, stock]);

  const upcoming = useMemo(
    () =>
      (dossier?.appointments ?? [])
        .slice()
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date)),
    [dossier],
  );

  const handleSaveNote = async () => {
    if (!dossier || !note.trim()) return;
    const deal = dossier.deals[0];
    if (!deal) {
      toast({
        title: pt ? "Sem negociação" : "No deal",
        description: pt
          ? "Abra uma negociação para este cliente antes de registrar anotações."
          : "Open a deal for this client before adding notes.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pipeline_activities").insert({
      pipeline_id: deal.id,
      broker_id: brokerId,
      activity_type: noteType,
      description: note.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setNote("");
    toast({ title: pt ? "Anotação registrada" : "Note saved" });
    load();
  };

  const kindStyle: Record<string, string> = {
    lead: "bg-primary/10 text-primary",
    deal: "bg-emerald-500/10 text-emerald-600",
    activity: "bg-muted text-muted-foreground",
    appointment: "bg-amber-500/10 text-amber-600",
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{identity.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-6">
            {/* Contact */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                {phone && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {phone}</p>}
                {email && <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {email}</p>}
                {firstContact && (
                  <p className="text-xs text-muted-foreground">
                    {pt ? "Primeiro contato" : "First contact"}: {firstContact.label}
                    {firstContact.extra ? ` — ${firstContact.extra}` : ""} ·{" "}
                    {new Date(firstContact.at).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
              {phone && (
                <Button asChild className="gap-1">
                  <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>

            {/* Quick note */}
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">{pt ? "Anotação rápida" : "Quick note"}</p>
              <div className="flex flex-wrap items-end gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{activityTypeLabel(t, pt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={pt ? "O que aconteceu no atendimento..." : "What happened in this interaction..."}
                  className="min-w-[220px] flex-1"
                />
                <Button className="gap-1" disabled={saving || !note.trim()} onClick={handleSaveNote}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {pt ? "Registrar" : "Save"}
                </Button>
              </div>
            </div>

            {/* Buyer criteria */}
            {dossier?.buyerLeads.length ? (
              <Section icon={<Target className="h-4 w-4" />} title={pt ? "Critérios de busca" : "Search criteria"}>
                {dossier.buyerLeads.map((b) => {
                  const c = parseCriteria(b.criteria);
                  return (
                    <div key={b.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{statusLabel(b.status, pt)}</Badge>
                        <span className="text-xs text-muted-foreground">{urgencyLabel(b.urgency, pt)}</span>
                      </div>
                      <p className="text-muted-foreground">
                        {[
                          c.city,
                          c.neighborhoods?.length ? c.neighborhoods.join(", ") : null,
                          c.bedrooms_min ? `${c.bedrooms_min}+ ${pt ? "quartos" : "bed"}` : null,
                          c.area_min ? `${c.area_min}+ m²` : null,
                          (c.price_max ?? b.budget_max) ? `${pt ? "até" : "up to"} ${brl(Number(c.price_max ?? b.budget_max))}` : null,
                        ].filter(Boolean).join(" · ") || (pt ? "Sem critérios detalhados" : "No detailed criteria")}
                      </p>
                      {!!c.features?.length && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.features.map((f) => featureLabel(f, pt)).join(", ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </Section>
            ) : null}

            {/* Matching stock */}
            {matches.length > 0 && (
              <Section icon={<Home className="h-4 w-4" />} title={pt ? "Imóveis compatíveis" : "Matching listings"}>
                <div className="space-y-2">
                  {matches.slice(0, 8).map((p) => (
                    <Link
                      key={p.id}
                      to={`/imovel/${p.id}`}
                      target="_blank"
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:border-primary/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {p.neighborhood ? `${p.neighborhood}, ` : ""}{p.city}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium text-primary">{brl(Number(p.price))}</span>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Deals */}
            <Section icon={<TrendingUp className="h-4 w-4" />} title={pt ? "Negociações" : "Deals"}>
              {dossier?.deals.length ? (
                <div className="space-y-2">
                  {dossier.deals.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{d.properties?.title ?? (pt ? "Sem imóvel vinculado" : "No linked property")}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString(locale)}
                          {d.next_action ? ` · ${d.next_action}` : ""}
                          {d.next_action_date ? ` (${new Date(d.next_action_date).toLocaleDateString(locale)})` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.commission_value != null && (
                          <span className="text-xs text-muted-foreground">{brl(Number(d.commission_value))}</span>
                        )}
                        <Badge variant="outline">{stageLabel(d.stage, pt)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{pt ? "Nenhuma negociação registrada." : "No deals yet."}</p>
              )}
            </Section>

            {/* Appointments */}
            <Section icon={<CalendarDays className="h-4 w-4" />} title={pt ? "Visitas e compromissos" : "Visits & appointments"}>
              {upcoming.length ? (
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(`${a.appointment_date}T00:00:00`).toLocaleDateString(locale)}
                          {a.start_time ? ` · ${a.start_time.slice(0, 5)}` : ""}
                          {a.location ? ` · ${a.location}` : ""}
                        </p>
                      </div>
                      <Badge variant={a.completed ? "secondary" : "default"}>
                        {a.completed ? (pt ? "Realizada" : "Done") : (pt ? "Agendada" : "Scheduled")}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{pt ? "Nenhum compromisso registrado." : "No appointments yet."}</p>
              )}
            </Section>

            {/* Timeline */}
            <Section icon={<Inbox className="h-4 w-4" />} title={pt ? "Linha do tempo" : "Timeline"}>
              {timeline.length ? (
                <ol className="space-y-3 border-l border-border pl-4">
                  {timeline.map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-border" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", kindStyle[t.kind])}>
                          {t.kind === "lead" ? (pt ? "Lead" : "Lead")
                            : t.kind === "deal" ? (pt ? "Funil" : "Pipeline")
                            : t.kind === "appointment" ? (pt ? "Agenda" : "Calendar")
                            : (pt ? "Atividade" : "Activity")}
                        </span>
                        <span className="text-sm font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.at).toLocaleString(locale)}
                        </span>
                      </div>
                      {t.detail && <p className="mt-0.5 text-sm text-muted-foreground">{t.detail}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{pt ? "Sem histórico ainda." : "No history yet."}</p>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ClientSheetProvider = ({ brokerId, children }: { brokerId: string; children: ReactNode }) => {
  const [identity, setIdentity] = useState<ClientIdentity | null>(null);
  const openClient = useCallback((next: ClientIdentity) => setIdentity(next), []);
  const value = useMemo(() => ({ openClient }), [openClient]);

  return (
    <ClientSheetContext.Provider value={value}>
      {children}
      {identity && (
        <ClientSheetDialog brokerId={brokerId} identity={identity} onClose={() => setIdentity(null)} />
      )}
    </ClientSheetContext.Provider>
  );
};

export default ClientSheetProvider;
