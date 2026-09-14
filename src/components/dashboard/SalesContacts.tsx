import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, UserPlus, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SectionHeader, EmptyState } from "@/components/dashboard/SectionHeader";
import type { Tables } from "@/integrations/supabase/types";

type ContactRequest = Tables<"contact_requests"> & {
  properties?: { title: string } | null;
};

interface Props {
  userId: string;
}

const SalesContacts = ({ userId }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_requests")
      .select("*, properties:property_id!inner(title, user_id)")
      .eq("properties.user_id", userId)
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setContacts((data as unknown as ContactRequest[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    setConverting(null);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Contato salvo como lead!" : "Contact saved as lead!" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Contatos recebidos" : "Incoming contacts"}
        description={pt ? "Interessados que entraram em contato pelos seus anúncios." : "People who reached out through your listings."}
        count={contacts.length}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-8 w-8" />}
          title={pt ? "Nenhum contato recebido" : "No contacts received"}
          description={pt ? "Quando alguém enviar uma mensagem em um anúncio, ela aparece aqui." : "Messages sent from your listings show up here."}
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {contacts.map((c) => (
            <div key={c.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{c.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(locale)}
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
              <div className="flex shrink-0 gap-2">
                {c.phone && (
                  <Button asChild size="sm" variant="ghost" className="gap-1">
                    <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Phone className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1" disabled={converting === c.id} onClick={() => handleConvert(c)}>
                  {converting === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {pt ? "Salvar lead" : "Save lead"}
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
