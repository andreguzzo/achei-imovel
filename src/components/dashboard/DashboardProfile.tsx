import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Camera, Plus, X, ExternalLink, Instagram } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import EmailVerification from "@/components/dashboard/EmailVerification";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import MyDataCard from "@/components/dashboard/MyDataCard";
import type { Tables } from "@/integrations/supabase/types";

interface BrokerPhoto {
  id: string;
  url: string;
  position: number;
  is_cover: boolean;
  is_banner: boolean;
}

interface Props {
  userId: string;
  email: string;
  isBroker: boolean;
  profile: Tables<"profiles"> | null;
  onProfileSaved: () => void;
}

const DashboardProfile = ({ userId, email, isBroker, profile, onProfileSaved }: Props) => {
  const { locale } = useLanguage();
  const pt = locale === "pt-BR";

  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [commercialName, setCommercialName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);

  const [photos, setPhotos] = useState<BrokerPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setCommercialName(profile.commercial_name ?? "");
    setUsername(profile.username ?? "");
    setPhone(profile.phone ?? "");
    setCreci(profile.creci ?? "");
    setBio(profile.bio ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    setInstagram(profile.instagram ?? "");
    setFacebook(profile.facebook ?? "");
    setYoutube(profile.youtube ?? "");
    setTiktok(profile.tiktok ?? "");
    setLinkedin(profile.linkedin ?? "");
    setEmailVerified(profile.email_verified ?? false);
  }, [profile]);

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from("broker_photos")
      .select("*")
      .eq("user_id", userId)
      .order("position");
    setPhotos((data as BrokerPhoto[]) ?? []);
  }, [userId]);

  useEffect(() => { if (isBroker) fetchPhotos(); }, [isBroker, fetchPhotos]);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast({ title: pt ? "Nome completo é obrigatório" : "Full name is required", variant: "destructive" });
      return;
    }
    if (!creci.trim()) {
      toast({ title: pt ? "CRECI é obrigatório" : "CRECI is required", variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: pt ? "Telefone é obrigatório" : "Phone is required", variant: "destructive" });
      return;
    }
    if (username.trim() && !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
      toast({
        title: pt ? "Username inválido (3-30 caracteres, letras, números, . _ -)" : "Invalid username (3-30 chars, letters, numbers, . _ -)",
        variant: "destructive",
      });
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
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        youtube: youtube || null,
        tiktok: tiktok || null,
        linkedin: linkedin || null,
        creci,
        bio,
      })
      .eq("user_id", userId);

    if (error) {
      if (error.message?.includes("profiles_username_unique")) {
        toast({ title: pt ? "Username já em uso" : "Username already taken", variant: "destructive" });
      } else {
        toast({ title: pt ? "Erro ao salvar" : "Error saving", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: pt ? "Perfil atualizado!" : "Profile updated!" });
      onProfileSaved();
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (photos.length + files.length > 10) {
      toast({ title: pt ? "Máximo 10 fotos no álbum" : "Max 10 album photos", variant: "destructive" });
      return;
    }
    setUploading(true);
    let currentCount = photos.length;
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("broker-photos").upload(path, file, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("broker-photos").getPublicUrl(path);
        const isCover = currentCount === 0;
        await supabase.from("broker_photos").insert({
          user_id: userId, url: urlData.publicUrl, position: currentCount, is_cover: isCover,
        });
        if (isCover) await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("user_id", userId);
        currentCount++;
      }
    }
    await fetchPhotos();
    setUploading(false);
  };

  const handleSetCover = async (photo: BrokerPhoto) => {
    await supabase.from("broker_photos").update({ is_cover: false }).eq("user_id", userId);
    await Promise.all([
      supabase.from("broker_photos").update({ is_cover: true }).eq("id", photo.id),
      supabase.from("profiles").update({ avatar_url: photo.url }).eq("user_id", userId),
    ]);
    await fetchPhotos();
    toast({ title: pt ? "Foto de perfil atualizada!" : "Profile photo updated!" });
  };

  const handleSetBanner = async (photo: BrokerPhoto) => {
    await supabase.from("broker_photos").update({ is_banner: false }).eq("user_id", userId);
    await supabase.from("broker_photos").update({ is_banner: true }).eq("id", photo.id);
    await fetchPhotos();
    toast({ title: pt ? "Banner atualizado!" : "Banner updated!" });
  };

  const handleDeletePhoto = async (photo: BrokerPhoto) => {
    await supabase.from("broker_photos").delete().eq("id", photo.id);
    const urlParts = photo.url.split("/broker-photos/");
    if (urlParts[1]) await supabase.storage.from("broker-photos").remove([decodeURIComponent(urlParts[1])]);
    if (photo.is_cover) await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", userId);
    await fetchPhotos();
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={pt ? "Perfil e fotos" : "Profile & photos"}
        description={pt ? "Estes dados aparecem na sua página pública e nos seus anúncios." : "This information appears on your public page and listings."}
        action={
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pt ? "Salvar" : "Save"}
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">{pt ? "Dados pessoais" : "Personal info"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">{pt ? "Nome completo *" : "Full name *"}</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">{pt ? "Nome comercial" : "Commercial name"}</label>
            <Input value={commercialName} onChange={(e) => setCommercialName(e.target.value)} placeholder={pt ? "Como deseja ser conhecido" : "How you want to be known"} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Username</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="seu.username" />
            </div>
            {username.trim() && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{pt ? "Sua página pública:" : "Your public page:"}</span>
                <a
                  href={`/corretor/${username.trim().toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  {window.location.origin}/corretor/{username.trim().toLowerCase()}
                </a>
                <a
                  href={`/corretor/${username.trim().toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-input hover:bg-accent"
                  title={pt ? "Visitar página" : "Visit page"}
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">{pt ? "E-mail *" : "Email *"}</label>
            <Input value={email} disabled className="bg-muted" />
            <p className="mt-1 text-xs text-muted-foreground">
              {pt ? "E-mail da conta, não pode ser alterado aqui" : "Account email, cannot be changed here"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">CRECI *</label>
            <Input value={creci} onChange={(e) => setCreci(e.target.value)} placeholder={pt ? "Obrigatório" : "Required"} />
          </div>
          <div>
            <label className="text-sm font-medium">{pt ? "Telefone *" : "Phone *"}</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="text-sm font-medium">WhatsApp</label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5511999999999" />
            <p className="mt-1 text-xs text-muted-foreground">
              {pt ? "Número com código do país (ex: 5511999999999)" : "Number with country code (e.g. 5511999999999)"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder={pt ? "Fale sobre você..." : "Tell us about yourself..."} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{pt ? "Redes sociais" : "Social media"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Instagram</label>
            <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seuusuario" />
          </div>
          <div>
            <label className="text-sm font-medium">Facebook</label>
            <Input value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/seuperfil" />
          </div>
          <div>
            <label className="text-sm font-medium">YouTube</label>
            <Input value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="https://youtube.com/@seucanal" />
          </div>
          <div>
            <label className="text-sm font-medium">TikTok</label>
            <Input value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@seuusuario" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">LinkedIn</label>
            <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/seuperfil" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-2 border-t border-border pt-4">
            <p className="w-full text-sm text-muted-foreground">
              {pt
                ? "Você já pode exportar cada imóvel como post pronto em Meus anúncios. A publicação automática será liberada em breve."
                : "You can already export each property as a ready-to-post image in My listings. Automatic publishing is coming soon."}
            </p>
            <Button variant="outline" size="sm" disabled className="gap-1.5">
              <Instagram className="h-4 w-4" /> {pt ? "Conectar Instagram (em breve)" : "Connect Instagram (soon)"}
            </Button>
            <Button variant="outline" size="sm" disabled className="gap-1.5">
              <ExternalLink className="h-4 w-4" /> {pt ? "Conectar Facebook (em breve)" : "Connect Facebook (soon)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <EmailVerification email={email} verified={emailVerified} onVerified={() => setEmailVerified(true)} />

      <MyDataCard userId={userId} email={email} />

      {isBroker && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4" /> {pt ? "Álbum de fotos" : "Photo album"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative h-24 w-32 overflow-hidden rounded-lg border">
                  <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {photo.is_cover && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {pt ? "Perfil" : "Profile"}
                    </span>
                  )}
                  {photo.is_banner && (
                    <span className="absolute right-1 top-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      Banner
                    </span>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex items-center gap-1">
                      {!photo.is_cover && (
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-background" onClick={() => handleSetCover(photo)}>
                          {pt ? "Perfil" : "Profile"}
                        </Button>
                      )}
                      {!photo.is_banner && (
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-background" onClick={() => handleSetBanner(photo)}>
                          Banner
                        </Button>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-background" onClick={() => handleDeletePhoto(photo)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {photos.length < 10 && (
                <label className="flex h-24 w-32 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                  <div className="text-center">
                    {uploading
                      ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      : <Plus className="mx-auto h-5 w-5 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{pt ? "Adicionar" : "Add"}</span>
                  </div>
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {pt
                ? "Escolha qual foto será o perfil e qual será o banner da sua página pública. Máximo 10 fotos."
                : "Choose which photo is your profile pic and which is the banner. Max 10 photos."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardProfile;
