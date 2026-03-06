import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Mail, UserPlus, BarChart3,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BrokerAnalytics from "@/components/dashboard/BrokerAnalytics";
import type { Tables } from "@/integrations/supabase/types";

type ContactRequest = Tables<"contact_requests"> & {
  properties?: { title: string } | null;
};

interface DashboardSalesTabProps {
  userId: string;
}

const DashboardSalesTab = ({ userId }: DashboardSalesTabProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contact_requests")
      .select("*, properties:property_id(title, user_id)")
      .neq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setContacts((data as any) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      toast({ title: pt ? "Contato salvo como lead!" : "Contact saved as lead!" });
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts" className="gap-1"><Mail className="h-4 w-4" /> {pt ? "Contatos" : "Contacts"}</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><BarChart3 className="h-4 w-4" /> {pt ? "Relatórios" : "Reports"}</TabsTrigger>
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {contacts.length} {pt ? "contatos recebidos" : "contacts received"}
            </p>
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
                            {pt ? "Salvar Lead" : "Save Lead"}
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

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <BrokerAnalytics userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardSalesTab;
