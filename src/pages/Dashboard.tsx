import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, User, Building2, Mail, Trash2, Edit, Plus, Briefcase, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BrokerTab from "@/components/dashboard/BrokerTab";
import DashboardSalesTab from "@/components/dashboard/DashboardSalesTab";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & { property_images: Tables<"property_images">[] };

const Dashboard = () => {
  const { locale } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [contacts, setContacts] = useState<(Tables<"contact_requests"> & { properties?: { title: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBroker, setIsBroker] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const fetchAll = async () => {
      setLoading(true);
      const [profileRes, propsRes, contactsRes, brokerRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("properties").select("*, property_images(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("contact_requests").select("*, properties:property_id(title)").order("created_at", { ascending: false }).limit(50),
        supabase.rpc("has_role", { _user_id: user.id, _role: "broker" }),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setFullName(profileRes.data.full_name ?? "");
        setPhone(profileRes.data.phone ?? "");
        setCreci(profileRes.data.creci ?? "");
        setBio(profileRes.data.bio ?? "");
      }
      setProperties((propsRes.data as PropertyWithImages[]) ?? []);
      setContacts((contactsRes.data as any) ?? []);
      setIsBroker(!!brokerRes.data);
      setLoading(false);
    };
    fetchAll();
  }, [user, authLoading, navigate]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!creci.trim()) {
      toast({ title: pt ? "CRECI é obrigatório" : "CRECI is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, creci, bio })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: pt ? "Erro ao salvar" : "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: pt ? "Perfil atualizado!" : "Profile updated!" });
    }
    setSaving(false);
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm(pt ? "Tem certeza que deseja excluir este imóvel?" : "Are you sure you want to delete this property?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", propId);
    if (error) {
      toast({ title: pt ? "Erro" : "Error", description: error.message, variant: "destructive" });
    } else {
      setProperties((prev) => prev.filter((p) => p.id !== propId));
      toast({ title: pt ? "Imóvel excluído" : "Property deleted" });
    }
  };

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">{pt ? "Meu Painel" : "My Dashboard"}</h1>

      <Tabs defaultValue={isBroker ? "sales" : "profile"} className="mt-6">
        <TabsList className="flex-wrap">
          {isBroker && (
            <TabsTrigger value="sales" className="gap-1"><TrendingUp className="h-4 w-4" /> {pt ? "Gestão de Vendas" : "Sales Management"}</TabsTrigger>
          )}
          <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" /> {pt ? "Perfil" : "Profile"}</TabsTrigger>
          <TabsTrigger value="properties" className="gap-1"><Building2 className="h-4 w-4" /> {pt ? "Imóveis" : "Properties"}</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1"><Mail className="h-4 w-4" /> {pt ? "Contatos" : "Contacts"}</TabsTrigger>
          {isBroker && (
            <TabsTrigger value="broker" className="gap-1"><Briefcase className="h-4 w-4" /> {pt ? "Corretor" : "Broker"}</TabsTrigger>
          )}
        </TabsList>

        {/* Sales Management Tab (main for brokers) */}
        {isBroker && user && (
          <TabsContent value="sales">
            <DashboardSalesTab userId={user.id} />
          </TabsContent>
        )}

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>{pt ? "Dados Pessoais" : "Personal Info"}</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div>
                <label className="text-sm font-medium">{pt ? "Nome completo" : "Full name"}</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">{pt ? "Telefone" : "Phone"}</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="text-sm font-medium">CRECI *</label>
                <Input value={creci} onChange={(e) => setCreci(e.target.value)} placeholder={pt ? "Obrigatório" : "Required"} required />
              </div>
              <div>
                <label className="text-sm font-medium">Bio</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder={pt ? "Fale sobre você..." : "Tell us about yourself..."} />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pt ? "Salvar" : "Save"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Properties Tab */}
        <TabsContent value="properties">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{properties.length} {pt ? "imóveis cadastrados" : "listed properties"}</p>
            <Link to="/anunciar"><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo imóvel" : "New property"}</Button></Link>
          </div>
          {properties.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">{pt ? "Nenhum imóvel cadastrado" : "No properties listed"}</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {properties.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.property_images?.[0]?.url ? (
                        <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{p.city} - {p.state}</p>
                      <p className="text-sm font-bold text-primary">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link to={`/imovel/${p.id}`}>
                        <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteProperty(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          {contacts.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">{pt ? "Nenhum contato recebido" : "No contacts received"}</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.email} {c.phone && `• ${c.phone}`}</p>
                        {(c as any).properties?.title && (
                          <p className="text-xs text-primary mt-1">{(c as any).properties.title}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString(locale)}</span>
                    </div>
                    {c.message && <p className="mt-2 text-sm text-muted-foreground">{c.message}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Broker Tab */}
        {isBroker && user && (
          <TabsContent value="broker">
            <BrokerTab userId={user.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Dashboard;
