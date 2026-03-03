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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, User, Building2, Trash2, Edit, Plus, TrendingUp, Eye, Camera, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import DashboardSalesTab from "@/components/dashboard/DashboardSalesTab";
import type { Tables } from "@/integrations/supabase/types";

type PropertyWithImages = Tables<"properties"> & { property_images: Tables<"property_images">[] };

interface BrokerPhoto {
  id: string;
  url: string;
  position: number;
  is_cover: boolean;
}

const Dashboard = () => {
  const { locale } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pt = locale === "pt-BR";

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [properties, setProperties] = useState<PropertyWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBroker, setIsBroker] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [creci, setCreci] = useState("");
  const [bio, setBio] = useState("");

  // Broker photos
  const [photos, setPhotos] = useState<BrokerPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  // Status dialog for properties
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PropertyWithImages | null>(null);
  const [statusAction, setStatusAction] = useState("active");
  const [soldPrice, setSoldPrice] = useState("");
  const [soldCommission, setSoldCommission] = useState("");
  const [soldByOtherPrice, setSoldByOtherPrice] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login"); return; }

    const fetchAll = async () => {
      setLoading(true);
      const [profileRes, propsRes, brokerRes, photosRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("properties").select("*, property_images(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "broker" }),
        supabase.from("broker_photos").select("*").eq("user_id", user.id).order("position"),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setFullName(profileRes.data.full_name ?? "");
        setCommercialName((profileRes.data as any).commercial_name ?? "");
        setUsername((profileRes.data as any).username ?? "");
        setPhone(profileRes.data.phone ?? "");
        setEmail(user.email ?? "");
        setCreci(profileRes.data.creci ?? "");
        setBio(profileRes.data.bio ?? "");
      }
      setProperties((propsRes.data as PropertyWithImages[]) ?? []);
      setIsBroker(!!brokerRes.data);
      setPhotos((photosRes.data as BrokerPhoto[]) ?? []);
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
    if (!phone.trim()) {
      toast({ title: pt ? "Telefone é obrigatório" : "Phone is required", variant: "destructive" });
      return;
    }
    if (!fullName.trim()) {
      toast({ title: pt ? "Nome completo é obrigatório" : "Full name is required", variant: "destructive" });
      return;
    }
    if (username.trim() && !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
      toast({ title: pt ? "Username inválido (3-30 caracteres, letras, números, . _ -)" : "Invalid username (3-30 chars, letters, numbers, . _ -)", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ 
        full_name: fullName, 
        commercial_name: commercialName || null,
        username: username.trim().toLowerCase() || null,
        phone, 
        creci, 
        bio 
      } as any)
      .eq("user_id", user.id);

    if (error) {
      if (error.message?.includes("profiles_username_unique")) {
        toast({ title: pt ? "Username já em uso" : "Username already taken", variant: "destructive" });
      } else {
        toast({ title: pt ? "Erro ao salvar" : "Error saving", description: error.message, variant: "destructive" });
      }
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

  const handleOpenStatusDialog = (p: PropertyWithImages) => {
    setStatusTarget(p);
    setStatusAction(p.status);
    setSoldPrice("");
    setSoldCommission("");
    setSoldByOtherPrice("");
    setStatusDialogOpen(true);
  };

  const handleStatusConfirm = async () => {
    if (!statusTarget || !user) return;
    if (statusAction === "sold" && (!soldPrice || !soldCommission)) {
      toast({ title: pt ? "Informe o valor e a comissão" : "Enter value and commission", variant: "destructive" });
      return;
    }
    const isSoldByOther = statusAction === "sold_by_other";
    const finalStatus = isSoldByOther ? "sold" : statusAction;

    const updateData: Record<string, unknown> = { status: finalStatus };
    if (statusAction === "sold") {
      updateData.sold_price = Number(soldPrice);
      updateData.sold_commission = Number(soldCommission);
    }
    if (isSoldByOther && soldByOtherPrice) {
      updateData.sold_by_other_price = Number(soldByOtherPrice);
    }

    const { error } = await supabase.from("properties").update(updateData as any).eq("id", statusTarget.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Close matching pipeline entries if sold by broker
      if (statusAction === "sold") {
        await supabase
          .from("sales_pipeline")
          .update({ stage: "closed_won" as any, actual_close_date: new Date().toISOString().split("T")[0], commission_value: Number(soldCommission) })
          .eq("broker_id", user.id)
          .eq("property_id", statusTarget.id);
      }
      toast({ title: pt ? "Status atualizado!" : "Status updated!" });
      // Refresh properties
      const { data } = await supabase.from("properties").select("*, property_images(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      setProperties((data as PropertyWithImages[]) ?? []);
    }
    setStatusDialogOpen(false);
  };

  // Photo handlers
  const fetchPhotos = async () => {
    if (!user) return;
    const { data } = await supabase.from("broker_photos").select("*").eq("user_id", user.id).order("position");
    setPhotos((data as BrokerPhoto[]) ?? []);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 10) {
      toast({ title: pt ? "Máximo 10 fotos no álbum" : "Max 10 album photos", variant: "destructive" });
      return;
    }
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("broker-photos").upload(path, file, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("broker-photos").getPublicUrl(path);
        const isCover = photos.length === 0;
        await supabase.from("broker_photos").insert({ user_id: user.id, url: urlData.publicUrl, position: photos.length, is_cover: isCover });
        if (isCover) await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", user.id);
      }
    }
    await fetchPhotos();
    setUploading(false);
  };

  const handleSetCover = async (photo: BrokerPhoto) => {
    if (!user) return;
    await supabase.from("broker_photos").update({ is_cover: false }).eq("user_id", user.id);
    await supabase.from("broker_photos").update({ is_cover: true }).eq("id", photo.id);
    await supabase.from("profiles").update({ avatar_url: photo.url }).eq("user_id", user.id);
    await fetchPhotos();
    toast({ title: pt ? "Foto de capa atualizada!" : "Cover photo updated!" });
  };

  const handleDeletePhoto = async (photo: BrokerPhoto) => {
    if (!user) return;
    await supabase.from("broker_photos").delete().eq("id", photo.id);
    const urlParts = photo.url.split("/broker-photos/");
    if (urlParts[1]) await supabase.storage.from("broker-photos").remove([decodeURIComponent(urlParts[1])]);
    if (photo.is_cover) await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
    await fetchPhotos();
  };

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalViews = properties.reduce((sum, p) => sum + (p.view_count ?? 0), 0);

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl font-bold text-foreground">{pt ? "Meu Painel" : "My Dashboard"}</h1>

      <Tabs defaultValue={isBroker ? "sales" : "properties"} className="mt-6">
        <TabsList className="flex-wrap">
          {isBroker && (
            <TabsTrigger value="sales" className="gap-1"><TrendingUp className="h-4 w-4" /> {pt ? "Gestão de Vendas" : "Sales Management"}</TabsTrigger>
          )}
          <TabsTrigger value="properties" className="gap-1"><Building2 className="h-4 w-4" /> {pt ? "Imóveis" : "Properties"}</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" /> {pt ? "Perfil" : "Profile"}</TabsTrigger>
        </TabsList>

        {/* Sales Management Tab */}
        {isBroker && user && (
          <TabsContent value="sales">
            <DashboardSalesTab userId={user.id} />
          </TabsContent>
        )}

        {/* Properties Tab */}
        <TabsContent value="properties">
          <div className="space-y-4">
            {/* Quick stats */}
            {isBroker && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Eye className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Visualizações totais" : "Total views"}</p>
                      <p className="text-xl font-bold">{totalViews}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <Building2 className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">{pt ? "Imóveis cadastrados" : "Listed properties"}</p>
                      <p className="text-xl font-bold">{properties.length}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{properties.length} {pt ? "imóveis cadastrados" : "listed properties"}</p>
              <Link to="/anunciar"><Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> {pt ? "Novo imóvel" : "New property"}</Button></Link>
            </div>

            {properties.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">{pt ? "Nenhum imóvel cadastrado" : "No properties listed"}</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {properties.map((p) => {
                  const statusColors: Record<string, string> = { active: "default", inactive: "secondary", sold: "outline", rented: "outline" };
                  const statusLabels: Record<string, string> = pt
                    ? { active: "Ativo", inactive: "Fora de negociação", sold: "Vendido", rented: "Alugado" }
                    : { active: "Active", inactive: "Withdrawn", sold: "Sold", rented: "Rented" };
                  return (
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground truncate">{p.title}</p>
                            <Badge variant={statusColors[p.status] as any ?? "secondary"} className="text-[10px] shrink-0">
                              {statusLabels[p.status] ?? p.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{p.city} - {p.state}</p>
                          <p className="text-sm font-bold text-primary">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.price)}
                          </p>
                        </div>
                        {isBroker && (
                          <div className="flex items-center gap-1.5 shrink-0 mr-2">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-semibold">{p.view_count ?? 0}</span>
                          </div>
                        )}
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleOpenStatusDialog(p)}>
                            {pt ? "Status" : "Status"}
                          </Button>
                          <Link to={`/imovel/${p.id}`}>
                            <Button size="icon" variant="ghost"><Edit className="h-4 w-4" /></Button>
                          </Link>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteProperty(p.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>{pt ? "Dados Pessoais" : "Personal Info"}</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <div>
                  <label className="text-sm font-medium">{pt ? "Nome completo *" : "Full name *"}</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm font-medium">{pt ? "Nome comercial" : "Commercial name"}</label>
                  <Input value={commercialName} onChange={(e) => setCommercialName(e.target.value)} placeholder={pt ? "Como deseja ser conhecido" : "How you want to be known"} />
                </div>
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">@</span>
                    <Input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="seu.username" />
                  </div>
                  {username.trim() && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pt ? "Seu perfil público: " : "Your public profile: "}{window.location.origin}/corretor/{username.trim().toLowerCase()}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">{pt ? "E-mail *" : "Email *"}</label>
                  <Input value={email} disabled className="bg-muted" />
                  <p className="mt-1 text-xs text-muted-foreground">{pt ? "E-mail da conta, não pode ser alterado aqui" : "Account email, cannot be changed here"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{pt ? "Telefone *" : "Phone *"}</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" required />
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

            {/* Photo Album (broker only) */}
            {isBroker && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Camera className="h-4 w-4" /> {pt ? "Álbum de Fotos" : "Photo Album"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative h-24 w-32 overflow-hidden rounded-lg border group">
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                        {photo.is_cover && (
                          <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                            {pt ? "Capa" : "Cover"}
                          </span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!photo.is_cover && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => handleSetCover(photo)}>
                              <Camera className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => handleDeletePhoto(photo)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {photos.length < 10 && (
                      <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                        <div className="text-center">
                          {uploading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /> : <Plus className="mx-auto h-5 w-5 text-muted-foreground" />}
                          <span className="text-xs text-muted-foreground">{pt ? "Adicionar" : "Add"}</span>
                        </div>
                      </label>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pt ? "A foto de capa será sua foto de perfil. Máximo 10 fotos." : "Cover photo will be your profile picture. Max 10 photos."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Status change dialog for properties */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pt ? "Alterar Status do Imóvel" : "Change Property Status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {statusTarget && <p className="text-sm text-muted-foreground truncate">{statusTarget.title}</p>}
            <Select value={statusAction} onValueChange={setStatusAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{pt ? "Ativo (disponível)" : "Active"}</SelectItem>
                <SelectItem value="sold">{pt ? "Vendido (por mim)" : "Sold (by me)"}</SelectItem>
                <SelectItem value="inactive">{pt ? "Fora de negociação" : "Withdrawn"}</SelectItem>
                <SelectItem value="sold_by_other">{pt ? "Vendido por outro corretor" : "Sold by other"}</SelectItem>
              </SelectContent>
            </Select>

            {statusAction === "sold" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda (R$) *" : "Sale price (R$) *"}</label>
                  <Input type="number" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} min="0" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">{pt ? "Comissão (R$) *" : "Commission (R$) *"}</label>
                  <Input type="number" value={soldCommission} onChange={(e) => setSoldCommission(e.target.value)} min="0" />
                </div>
              </>
            )}

            {statusAction === "sold_by_other" && (
              <div>
                <label className="mb-1 block text-sm font-medium">{pt ? "Valor de venda informado (R$)" : "Reported sale price (R$)"}</label>
                <Input type="number" value={soldByOtherPrice} onChange={(e) => setSoldByOtherPrice(e.target.value)} min="0" />
                <p className="mt-1 text-xs text-muted-foreground">{pt ? "Usado como referência de mercado." : "Used as market reference."}</p>
              </div>
            )}

            {statusAction === "inactive" && (
              <p className="text-sm text-muted-foreground">{pt ? "O imóvel não aparecerá mais nas buscas." : "Property won't appear in searches."}</p>
            )}

            <Button onClick={handleStatusConfirm} className="w-full">{pt ? "Confirmar" : "Confirm"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
