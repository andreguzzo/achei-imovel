import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, UserPlus, Phone, AlarmClock, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type ContactRequest = Tables<"contact_requests"> & {
  properties?: { title: string } | null;
};

type LeadStatus = "new" | "contacted" | "scheduled" | "converted" | "discarded";

const STATUSES: LeadStatus[] = ["new", "contacted", "scheduled", "converted", "discarded"];

interface Props {
  userId: string;
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

const SalesContacts = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  const statusLabel = useMemo<Record<LeadStatus, string>>(() => ({
    new: pt ? "Novo" : "New",
    contacted: pt ? "Contatado" : "Contacted",
    scheduled: pt ? "Visita agendada" : "Visit scheduled",
    converted: pt ? "Convertido" : "Converted",
    discarded: pt ? "Descartado" : "Discarded",
  }), [pt]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_requests")
      .select("*, properties:property_id(title)")
      .eq("broker_id", userId)
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data as unknown as ContactRequest[]) ?? [];
    setContacts(rows);
    setNotes(Object.fromEntries(rows.map((r) => [r.id, r.broker_notes ?? ""])));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const patchLead = async (id: string, patch: Partial<Tables<"contact_requests">>) => {
    const { error } = await supabase.from("contact_requests").update(patch).eq("id", id);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return false;
    }
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } as ContactRequest : c)));
    return true;
  };

  const handleStatus = async (contact: ContactRequest, status: LeadStatus) => {
    const ok = await patchLead(contact.id, {
      status,
      responded_at: status === "new" ? null : new Date().toISOString(),
    });
    if (ok) toast({ title: pt ? "Situação atualizada" : "Status updated" });
  };

  const handleSaveNote = async (contact: ContactRequest) => {
    setSavingNote(contact.id);
    const ok = await patchLead(contact.id, { broker_notes: notes[contact.id] || null });
    setSavingNote(null);
    if (ok) toast({ title: pt ? "Anotação salva" : "Note saved" });
  };

  const handleConvert = async (contact: ContactRequest) => {
    setConverting(contact.id);
    const { error } = await supabase.from("sales_pipeline").insert({
      broker_id: userId,
      client_name: contact.name,
      client_email: contact.email || null,
      client_phone: contact.phone || null,
      property_id: contact.property_id || null,
      notes: contact.message || null,
    });
    if (error) {
      setConverting(null);
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    await patchLead(contact.id, { status: "converted", responded_at: new Date().toISOString() });
    setConverting(null);
    toast({ title: pt ? "Contato convertido em negociação!" : "Contact converted into a deal!" });
  };

  const filtered = filter === "all" ? contacts : contacts.filter((c) => c.status === filter);
  const newCount = contacts.filter((c) => c.status === "new").length;

  const isStale = (c: ContactRequest) =>
    c.status === "new" && Date.now() - new Date(c.created_at).getTime() > TWO_HOURS;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Contatos recebidos" : "Incoming contacts"}
        description={pt ? "Interessados que entraram em contato pelos seus anúncios." : "People who reached out through your listings."}
        count={contacts.length}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as LeadStatus | "all")}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{pt ? "Todas as situações" : "All statuses"}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {newCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {newCount} {pt ? "sem resposta" : "awaiting reply"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-8 w-8" />}
          title={pt ? "Nenhum contato encontrado" : "No contacts found"}
          description={pt ? "Quando alguém enviar uma mensagem em um anúncio, ela aparece aqui." : "Messages sent from your listings show up here."}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border bg-card p-4",
                isStale(c) ? "border-destructive/60 bg-destructive/5" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <Badge variant={c.status === "new" ? "default" : "secondary"}>
                      {statusLabel[(c.status as LeadStatus) ?? "new"]}
                    </Badge>
                    {isStale(c) && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlarmClock className="h-3.5 w-3.5" />
                        {pt ? "Aguardando há mais de 2h" : "Waiting over 2h"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.email}{c.phone && ` • ${c.phone}`}
                  </p>
                  {c.properties?.title && (
                    <p className="mt-1 text-xs text-primary">
                      {pt ? "Imóvel:" : "Property:"} {c.properties.title}
                    </p>
                  )}
                  {c.message && (
                    <p className="mt-2 border-l-2 border-muted pl-3 text-sm text-muted-foreground">{c.message}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Select value={(c.status as LeadStatus) ?? "new"} onValueChange={(v) => handleStatus(c, v as LeadStatus)}>
                    <SelectTrigger className="h-9 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {c.phone && (
                    <Button asChild size="sm" variant="ghost" className="gap-1">
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="gap-1" disabled={converting === c.id} onClick={() => handleConvert(c)}>
                    {converting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {pt ? "Converter" : "Convert"}
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Textarea
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder={pt ? "Anotações do atendimento..." : "Follow-up notes..."}
                  rows={2}
                  className="min-w-[240px] flex-1"
                />
                <Button size="sm" variant="secondary" className="gap-1" disabled={savingNote === c.id} onClick={() => handleSaveNote(c)}>
                  {savingNote === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {pt ? "Salvar" : "Save"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesContacts;
