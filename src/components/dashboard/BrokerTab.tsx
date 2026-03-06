import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Eye, Upload, X, Plus, Users, Handshake, Camera, Search,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import BrokerAnalytics from "./BrokerAnalytics";

interface BrokerTabProps {
  userId: string;
}

interface BrokerPhoto {
  id: string;
  url: string;
  position: number;
  is_cover: boolean;
}

interface PropertyWithViews {
  id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  view_count: number | null;
  property_images: { url: string }[];
}

interface BrokerProfile {
  user_id: string;
  full_name: string | null;
  creci: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface Partnership {
  id: string;
  status: string;
  commission_split: number | null;
  broker_a_id: string;
  broker_b_id: string;
  created_at: string;
}

const BrokerTab = ({ userId }: BrokerTabProps) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [properties, setProperties] = useState<PropertyWithViews[]>([]);
  const [photos, setPhotos] = useState<BrokerPhoto[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<Record<string, BrokerProfile>>({});
  const [brokerSearch, setBrokerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BrokerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Partnership dialog
  const [selectedBroker, setSelectedBroker] = useState<BrokerProfile | null>(null);
  const [commSplit, setCommSplit] = useState("50");
  const [partnerTerms, setPartnerTerms] = useState("");
  const [sendingProposal, setSendingProposal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    setLoading(true);
    const [propsRes, photosRes, partnershipsRes] = await Promise.all([
      supabase
        .from("properties")
        .select("id, title, city, state, price, view_count, property_images(url)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("broker_photos")
        .select("*")
        .eq("user_id", userId)
        .order("position"),
      supabase
        .from("broker_partnerships")
        .select("*")
        .or(`broker_a_id.eq.${userId},broker_b_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);

    setProperties((propsRes.data as any) ?? []);
    setPhotos((photosRes.data as BrokerPhoto[]) ?? []);
    const parts = (partnershipsRes.data as Partnership[]) ?? [];
    setPartnerships(parts);

    // Fetch partner profiles
    const partnerIds = parts.map((p) =>
      p.broker_a_id === userId ? p.broker_b_id : p.broker_a_id
    );
    if (partnerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, creci, avatar_url, phone")
        .in("user_id", partnerIds);
      const map: Record<string, BrokerProfile> = {};
      profiles?.forEach((p) => { map[p.user_id] = p as BrokerProfile; });
      setPartnerProfiles(map);
    }

    setLoading(false);
  };

  const totalViews = properties.reduce((sum, p) => sum + (p.view_count ?? 0), 0);

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 10) {
      toast({ title: pt ? "Máximo 10 fotos no álbum" : "Max 10 album photos", variant: "destructive" });
      return;
    }
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("broker-photos")
        .upload(path, file, { upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("broker-photos").getPublicUrl(path);
        const isCover = photos.length === 0;
        await supabase.from("broker_photos").insert({
          user_id: userId,
          url: urlData.publicUrl,
          position: photos.length,
          is_cover: isCover,
        });
        if (isCover) {
          await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", userId);
        }
      }
    }
    await fetchData();
    setUploading(false);
  };

  const handleSetCover = async (photo: BrokerPhoto) => {
    await supabase.from("broker_photos").update({ is_cover: false }).eq("user_id", userId);
    await supabase.from("broker_photos").update({ is_cover: true }).eq("id", photo.id);
    await supabase.from("profiles").update({ avatar_url: photo.url }).eq("user_id", userId);
    await fetchData();
    toast({ title: pt ? "Foto de capa atualizada!" : "Cover photo updated!" });
  };

  const handleDeletePhoto = async (photo: BrokerPhoto) => {
    await supabase.from("broker_photos").delete().eq("id", photo.id);
    // Extract path from URL for storage deletion
    const urlParts = photo.url.split("/broker-photos/");
    if (urlParts[1]) {
      await supabase.storage.from("broker-photos").remove([decodeURIComponent(urlParts[1])]);
    }
    if (photo.is_cover) {
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", userId);
    }
    await fetchData();
  };

  // Search brokers
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

    // Use RPC to create partnership group (property_groups has no INSERT RLS for regular users)
    const { data: groupId, error: groupErr } = await supabase.rpc("create_partnership_group", {
      _broker_a: userId,
      _broker_b: selectedBroker.user_id,
    });

    if (groupErr || !groupId) {
      toast({ title: pt ? "Erro ao criar grupo" : "Error creating group", description: groupErr?.message, variant: "destructive" });
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

  const coverPhoto = photos.find((p) => p.is_cover);
  const statusLabels: Record<string, string> = pt
    ? { pending: "Pendente", active: "Ativa", declined: "Recusada", completed: "Concluída" }
    : { pending: "Pending", active: "Active", declined: "Declined", completed: "Completed" };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Eye className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-1 text-2xl font-bold">{totalViews}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Visualizações totais" : "Total views"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-1 text-2xl font-bold">{partnerships.length}</p>
            <p className="text-xs text-muted-foreground">{pt ? "Parcerias" : "Partnerships"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Camera className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-1 text-2xl font-bold">{photos.length}/10</p>
            <p className="text-xs text-muted-foreground">{pt ? "Fotos no álbum" : "Album photos"}</p>
          </CardContent>
        </Card>
      </div>

      {/* View counts per property */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" /> {pt ? "Visualizações por imóvel" : "Views per property"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pt ? "Nenhum imóvel" : "No properties"}</p>
          ) : (
            <div className="space-y-2">
              {properties.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-muted">
                      {p.property_images?.[0]?.url ? (
                        <img src={p.property_images[0].url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">—</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.city} - {p.state}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{p.view_count ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Album */}
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

      {/* Analytics & Reports */}
      <BrokerAnalytics userId={userId} />

      {/* Partner Brokers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4" /> {pt ? "Corretores Parceiros" : "Partner Brokers"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
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

          {/* Search results */}
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

          {/* Existing partnerships */}
          {partnerships.length === 0 ? (
            <p className="text-sm text-muted-foreground">{pt ? "Nenhuma parceria" : "No partnerships"}</p>
          ) : (
            <div className="space-y-2">
              {partnerships.map((p) => {
                const partnerId = p.broker_a_id === userId ? p.broker_b_id : p.broker_a_id;
                const partner = partnerProfiles[partnerId];
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={partner?.avatar_url ?? undefined} />
                        <AvatarFallback>{(partner?.full_name ?? "?")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{partner?.full_name ?? pt ? "Corretor" : "Broker"}</p>
                        {partner?.creci && <p className="text-xs text-muted-foreground">CRECI: {partner.creci}</p>}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === "active" ? "bg-green-100 text-green-800" :
                      p.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {statusLabels[p.status] ?? p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BrokerTab;
