import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, UserPlus, Phone, AlarmClock, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/dashboard/SectionHeader";
import { ClientLink } from "@/components/dashboard/ClientSheet";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { buildWhatsAppUrl, formatBrPhone } from "@/lib/phone";

type ContactRequest = Tables<"contact_requests"> & {
  properties?: { title: string } | null;
};

interface Props {
  userId: string;
  onConverted?: () => void;
}

const TWO_HOURS = 2 * 60 * 60 * 1000;

const SalesInbox = ({ userId, onConverted }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_requests")
      .select("*, properties:property_id(title)")
      .eq("broker_id", userId)
      .neq("sender_id", userId)
      .in("status", ["new", "contacted"])
      .order("created_at", { ascending: true })
      .limit(200);
    setContacts((data as unknown as ContactRequest[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const removeFromInbox = (id: string) =>
    setContacts((prev) => prev.filter((c) => c.id !== id));

  const handleDiscard = async (contact: ContactRequest) => {
    setBusy(contact.id);
    const { error } = await supabase
      .from("contact_requests")
      .update({ status: "discarded", responded_at: new Date().toISOString() })
      .eq("id", contact.id);
    setBusy(null);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    removeFromInbox(contact.id);
    toast({ title: pt ? "Contato descartado" : "Contact discarded" });
  };

  const handleConvert = async (contact: ContactRequest) => {
    setBusy(contact.id);
    const { error } = await supabase.from("sales_pipeline").insert({
      broker_id: userId,
      client_name: contact.name,
      client_email: contact.email || null,
      client_phone: contact.phone || null,
      property_id: contact.property_id || null,
      notes: contact.message || null,
    });
    if (error) {
      setBusy(null);
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    await supabase
      .from("contact_requests")
      .update({ status: "converted", responded_at: new Date().toISOString() })
      .eq("id", contact.id);
    setBusy(null);
    removeFromInbox(contact.id);
    onConverted?.();
    toast({ title: pt ? "Negociação criada no funil!" : "Deal created in the pipeline!" });
  };

  const isStale = (c: ContactRequest) =>
    Date.now() - new Date(c.created_at).getTime() > TWO_HOURS;

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Mail className="h-8 w-8" />}
        title={pt ? "Caixa de entrada vazia" : "Inbox is empty"}
        description={pt ? "Novos interessados nos seus anúncios aparecem aqui, do mais antigo para o mais novo." : "New leads from your listings show up here, oldest first."}
      />
    );
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
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
                <ClientLink name={c.name} phone={c.phone} email={c.email} className="font-medium text-foreground" />
                <Badge variant={c.status === "new" ? "default" : "secondary"}>
                  {c.status === "new" ? (pt ? "Novo" : "New") : (pt ? "Contatado" : "Contacted")}
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
              {c.phone && (buildWhatsAppUrl(c.phone, inboxGreeting(c.name, pt)) ? (
                <Button asChild size="sm" variant="secondary" className="gap-1">
                  <a href={buildWhatsAppUrl(c.phone, inboxGreeting(c.name, pt))!} target="_blank" rel="noopener noreferrer">
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {formatBrPhone(c.phone)} — {pt ? "sem WhatsApp válido" : "no valid WhatsApp"}
                </span>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={busy === c.id}
                onClick={() => handleConvert(c)}
              >
                {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                {pt ? "Abrir negociação" : "Open deal"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-muted-foreground"
                disabled={busy === c.id}
                onClick={() => handleDiscard(c)}
              >
                <XCircle className="h-3.5 w-3.5" />
                {pt ? "Descartar" : "Discard"}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SalesInbox;
